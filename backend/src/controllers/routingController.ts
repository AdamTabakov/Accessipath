import type {
  ProfilePreferences,
  RouteMode,
  RouteResult,
} from "../types/index.js";
import { getCandidateRoutes } from "../services/routing.js";
import { buildEvidence, scoreRoute } from "../services/scoring.js";
import { computeConfidence } from "../services/confidence.js";
import type { DataStore } from "../services/store.js";
import { DEFAULT_PROFILE } from "../services/store.js";

function sortKey(
  mode: RouteMode,
  r: { accessibilityScore: number; distanceMeters: number; durationMinutes: number },
): number {
  if (mode === "most_accessible") {
    return -(r.accessibilityScore * 1000 - r.distanceMeters);
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

  const { routes, provider, warning } = await getCandidateRoutes(start, end);
  const points = await store.getAllAccessibilityPoints();

  const results: RouteResult[] = routes.map((route) => {
    const evidenceResult = buildEvidence(route, points, profile);
    const scored = scoreRoute(route, evidenceResult, profile);
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
      scored.penalties.push({
        label: "Longer than your preferred walking distance",
        points: 10,
        severity: "info",
      });
      scored.score = Math.max(0, scored.score - 10);
    }

    return {
      id: route.id,
      mode,
      provider: route.provider,
      distanceMeters: route.distanceMeters,
      durationMinutes: route.durationMinutes,
      accessibilityScore: scored.score,
      dataConfidence: confidenceResult.confidence,
      confidenceBreakdown: confidenceResult.breakdown,
      factors: evidenceResult.factors,
      penalties: scored.penalties,
      bonuses: scored.bonuses,
      evidence: evidenceResult.evidence,
      unknownCoordinates: evidenceResult.unknownCoordinates,
      geometry: route.geometry,
    };
  });

  results.sort((a, b) => sortKey(mode, a) - sortKey(mode, b));

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

  return { routes: results, warnings };
}

export function profileFromDefaults(overrides: Partial<ProfilePreferences>): ProfilePreferences {
  return { ...DEFAULT_PROFILE, ...overrides };
}