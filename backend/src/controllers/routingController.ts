import type {
  AccessibilityPoint,
  ProfilePreferences,
  RouteMode,
  RouteResult,
} from "../types/index.js";
import { getCandidateRoutes } from "../services/routing.js";
import { buildEvidence, scoreRoute } from "../services/scoring.js";
import { computeConfidence } from "../services/confidence.js";
import { fetchCorridorData, getRegionalAccessibility } from "../services/osm.js";
import { config } from "../config.js";
import type { DataStore } from "../services/store.js";
import { DEFAULT_PROFILE } from "../services/store.js";
import { createTtlCache } from "../utils/ttlCache.js";
import type { Coordinates } from "../types/index.js";

/** Scored results cached per rounded origin/destination + profile + mode. */
const resultCache = createTtlCache<string, { routes: RouteResult[]; warnings: string[] }>(
  5 * 60_000,
);

/**
 * Scored-but-unsorted results cached per origin/destination + profile (mode
 * independent). Switching the sort mode only re-ranks these, skipping the
 * expensive corridor fetch + evidence + scoring work entirely.
 */
const scoredCache = createTtlCache<string, { results: RouteResult[]; warnings: string[] }>(
  5 * 60_000,
);

function baseRouteCacheKey(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
  profile: ProfilePreferences,
): string {
  return JSON.stringify([
    start.latitude.toFixed(4),
    start.longitude.toFixed(4),
    end.latitude.toFixed(4),
    end.longitude.toFixed(4),
    profile.mobilityProfile,
    profile.avoidStairs,
    profile.preferRamps,
    profile.preferElevators,
    profile.maxSlope,
    profile.preferSmoothSurface,
    profile.maxWalkDistanceMeters,
  ]);
}

function resultCacheKey(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
  profile: ProfilePreferences,
  mode: RouteMode,
): string {
  return `${baseRouteCacheKey(start, end, profile)}|${mode}`;
}

function sortKey(
  mode: RouteMode,
  r: { accessibilityScore: number; dataConfidence: number; distanceMeters: number; durationMinutes: number },
): number {
  if (mode === "most_accessible") {
    // Accessibility strictly dominates; confidence breaks near-ties; distance last.
    return -(r.accessibilityScore * 10000 + r.dataConfidence - r.distanceMeters / 10);
  }
  if (mode === "fastest") {
    return r.durationMinutes * 60 + r.distanceMeters / 50;
  }
  // balanced: blend accessibility and duration (0-1 normalized each)
  const scoreNorm = r.accessibilityScore / 100;
  const durationNorm = Math.min(1, r.durationMinutes / 60);
  return (0.6 * scoreNorm - 0.4 * durationNorm) * -1;
}

export interface BuildRoutesOptions {
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  profile: ProfilePreferences;
  mode: RouteMode;
  store: DataStore;
}

/**
 * Full route pipeline:
 * geocode-free candidates -> proximity evidence attachment -> scoring -> confidence -> sort.
 */
export async function buildRoutes(opts: BuildRoutesOptions): Promise<{
  routes: RouteResult[];
  warnings: string[];
}> {
  const { start, end, profile, mode, store } = opts;

  const cacheKey = resultCacheKey(start, end, profile, mode);
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult) return cachedResult;

  const scoredKey = baseRouteCacheKey(start, end, profile);
  let scored = scoredCache.get(scoredKey);
  if (!scored) {
    const emptyData = () => ({ points: [] as AccessibilityPoint[], ways: [] as Coordinates[][] });
    const corridorPromise =
      config.nodeEnv === "test"
        ? Promise.resolve(emptyData())
        : fetchCorridorData(start, end).catch((error) => {
            console.error(
              "[routing] OSM corridor fetch failed:",
              error instanceof Error ? error.message : error,
            );
            return emptyData();
          });

    const corridor = await corridorPromise;
    const city = config.nodeEnv === "test" ? emptyData() : getRegionalAccessibility(start, end);

    const [candidates, storePoints] = await Promise.all([
      getCandidateRoutes(start, end, corridor.ways),
      store.getAllAccessibilityPoints(),
    ]);
    const { routes, provider, warning } = candidates;

    const merged = [...city.points, ...corridor.points, ...storePoints];
    const seenIds = new Set<string>();
    const points = merged.filter((p) => (seenIds.has(p.id) ? false : (seenIds.add(p.id), true)));

  const results: RouteResult[] = routes.map((route) => {
      const evidenceResult = buildEvidence(route, points, profile);
      const routeScore = scoreRoute(route, evidenceResult, profile);
      const confidenceResult = computeConfidence({
        evidence: evidenceResult.evidence,
        factors: evidenceResult.factors,
        provider,
        profile,
      });

      if (
        profile.maxWalkDistanceMeters > 0 &&
        route.distanceMeters > profile.maxWalkDistanceMeters
      ) {
        routeScore.penalties.push({
          label: "Longer than your preferred walking distance",
          points: 10,
          severity: "info",
        });
        routeScore.score = Math.max(0, routeScore.score - 10);
      }

      return {
        id: route.id,
        mode,
        provider: route.provider,
        distanceMeters: route.distanceMeters,
        durationMinutes: route.durationMinutes,
        accessibilityScore: routeScore.score,
        dataConfidence: confidenceResult.confidence,
        confidenceBreakdown: confidenceResult.breakdown,
        factors: evidenceResult.factors,
        penalties: routeScore.penalties,
        bonuses: routeScore.bonuses,
        evidence: evidenceResult.evidence,
        unknownCoordinates: evidenceResult.unknownCoordinates,
        geometry: route.geometry,
      };
    });

    const warnings: string[] = [];
    if (warning) warnings.push(warning);
    const lowConfidence = results.some((r) => r.dataConfidence < 50);
    if (lowConfidence) {
      warnings.push(
        "Some route sections have little accessibility data. Unknown sections do not mean inaccessible - they mean we need more information.",
      );
    }
    const emptyEvidence = results.every((r) => r.evidence.length === 0);
    if (emptyEvidence) {
      warnings.push(
        "No accessibility features were found near these routes. Treat results as preliminary.",
      );
    }
    scored = { results, warnings };
    scoredCache.set(scoredKey, scored);
  }

  const routes = scored.results
    .map((r) => ({ ...r, mode }))
    .sort((a, b) => sortKey(mode, a) - sortKey(mode, b));
  const result: { routes: RouteResult[]; warnings: string[] } = {
    routes,
    warnings: scored.warnings,
  };
  resultCache.set(cacheKey, result);
  return result;
}

export function profileFromDefaults(overrides: Partial<ProfilePreferences>): ProfilePreferences {
  return { ...DEFAULT_PROFILE, ...overrides };
}

/** Drop all cached scored routes (called when community data changes). */
export function invalidateRouteResults(): void {
  resultCache.clear();
}