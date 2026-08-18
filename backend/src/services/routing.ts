import type { Coordinates, RouteCandidate } from "../types/index.js";
import { config } from "../config.js";
import { polylineLengthM } from "../utils/spatial.js";

const WALK_SPEED_MPS = 1.25;

/** Decode a GeoJSON LineString into our Coordinates shape. */
function decodeGeoJsonGeometry(coords: unknown): Coordinates[] {
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((c): c is number[] => Array.isArray(c) && c.length >= 2)
    .map((c) => ({
      longitude: Number(c[0]),
      latitude: Number(c[1]),
    }))
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
}

function toCandidate(
  id: string,
  provider: "osrm" | "demo",
  geometry: Coordinates[],
  distanceMeters: number,
  durationSeconds: number,
): RouteCandidate {
  return {
    id,
    provider,
    geometry,
    distanceMeters: Math.round(distanceMeters),
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
  };
}

/**
 * Request candidate walking routes from OSRM (public demo instance).
 * Returns routes with GeoJSON geometry; distance/duration come from the engine.
 */
async function fetchOsrmRoutes(
  start: Coordinates,
  end: Coordinates,
): Promise<RouteCandidate[]> {
  const url =
    `${config.osrmUrl}/route/v1/foot/` +
    `${start.longitude},${start.latitude};${end.longitude},${end.latitude}` +
    `?alternatives=true&overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: { "User-Agent": "AccessiPath/1.0 (hackathon; accessibility routing)" },
  });
  if (!res.ok) throw new Error(`OSRM responded with HTTP ${res.status}`);
  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  };
  if (data.code !== "Ok" || !Array.isArray(data.routes)) {
    throw new Error(`OSRM route failure: ${data.code ?? "unknown"}`);
  }
  const routes = data.routes
    .map((r, i) => {
      const geometry = decodeGeoJsonGeometry(r.geometry?.coordinates);
      if (geometry.length < 2) return null;
      return toCandidate(
        `route_${i + 1}`,
        "osrm",
        geometry,
        r.distance ?? polylineLengthM(geometry),
        r.duration ?? (polylineLengthM(geometry) / WALK_SPEED_MPS),
      );
    })
    .filter((r): r is RouteCandidate => r !== null);
  return routes;
}

/** Generic fallback path for arbitrary start/end pairs. */
function genericDemoRoutes(
  start: Coordinates,
  end: Coordinates,
): RouteCandidate[] {
  const mid1 = {
    latitude: start.latitude + (end.latitude - start.latitude) * 0.5,
    longitude: start.longitude + (end.longitude - start.longitude) * 0.4,
  };
  const mid2 = {
    latitude: start.latitude + (end.latitude - start.latitude) * 0.6,
    longitude: start.longitude + (end.longitude - start.longitude) * 0.7,
  };
  const short: Coordinates[] = [start, mid1, end];
  const detour: Coordinates[] = [start, mid1, mid2, end];
  const to = (id: string, g: Coordinates[]): RouteCandidate => {
    const distance = polylineLengthM(g);
    return toCandidate(id, "demo", g, distance, (distance / WALK_SPEED_MPS) * 1.15);
  };
  return [to("route_1", short), to("route_2", detour)];
}

/**
 * The two demo routes between SLC and ENG used when the routing provider
 * is unavailable, so the demo never depends on an external service.
 * Route A follows the Gould St sidewalk (accessible). Route B cuts through
 * the campus plaza (shorter-looking, but passes steps + a reported block).
 */
function slcToEngDemoRoutes(): RouteCandidate[] {
  const routeA: Coordinates[] = [
    { latitude: 43.6577, longitude: -79.3802 },
    { latitude: 43.65772, longitude: -79.3795 },
    { latitude: 43.65776, longitude: -79.3789 },
    { latitude: 43.65785, longitude: -79.3783 },
    { latitude: 43.6579, longitude: -79.37795 },
    { latitude: 43.65805, longitude: -79.37785 },
    { latitude: 43.658112, longitude: -79.377632 },
  ];
  const routeB: Coordinates[] = [
    { latitude: 43.6577, longitude: -79.3802 },
    { latitude: 43.65766, longitude: -79.3797 },
    { latitude: 43.6576, longitude: -79.3791 },
    { latitude: 43.65755, longitude: -79.3787 },
    { latitude: 43.65755, longitude: -79.3784 },
    { latitude: 43.6577, longitude: -79.3781 },
    { latitude: 43.65795, longitude: -79.37805 },
    { latitude: 43.6581, longitude: -79.3782 },
    { latitude: 43.65812, longitude: -79.37775 },
    { latitude: 43.658112, longitude: -79.377632 },
  ];
  const to = (id: string, g: Coordinates[]): RouteCandidate => {
    const distance = polylineLengthM(g);
    return toCandidate(id, "demo", g, distance, distance / WALK_SPEED_MPS);
  };
  return [to("route_1", routeA), to("route_2", routeB)];
}

function isSlcEng(start: Coordinates, end: Coordinates): boolean {
  const near = (a: Coordinates, b: Coordinates, m: number) =>
    Math.abs(a.latitude - b.latitude) < m && Math.abs(a.longitude - b.longitude) < m;
  const slc = { latitude: 43.6577, longitude: -79.3802 };
  const eng = { latitude: 43.658112, longitude: -79.377632 };
  return (
    (near(start, slc, 0.005) && near(end, eng, 0.005)) ||
    (near(start, eng, 0.005) && near(end, slc, 0.005))
  );
}

/**
 * Get at least two candidate walking routes.
 * Tries the real routing engine first; falls back to deterministic demo routes
 * so the demo never hard-fails on a third-party outage.
 */
export async function getCandidateRoutes(
  start: Coordinates,
  end: Coordinates,
): Promise<{ routes: RouteCandidate[]; provider: "osrm" | "demo"; warning?: string }> {
  try {
    const routes = await fetchOsrmRoutes(start, end);
    if (routes.length >= 2) {
      return { routes, provider: "osrm" };
    }
    if (routes.length === 1) {
      const demoRoutes = isSlcEng(start, end) ? slcToEngDemoRoutes() : genericDemoRoutes(start, end);
      const extras = demoRoutes
        .filter((d) => Math.abs(d.distanceMeters - routes[0]!.distanceMeters) > 30)
        .map((d, i) => ({ ...d, id: `alt-${i + 1}` }));
      return {
        routes: [routes[0]!, ...extras].slice(0, 3),
        provider: "osrm",
        warning:
          "Live routing returned a single route - supplemented with cached demo alternatives for this area.",
      };
    }
    throw new Error("OSRM returned no usable routes");
  } catch (error) {
    console.error("[routing] Falling back to demo routes:", error instanceof Error ? error.message : error);
    const fallback = isSlcEng(start, end) ? slcToEngDemoRoutes() : genericDemoRoutes(start, end);
    return {
      routes: fallback,
      provider: "demo",
      warning:
        "Live routing is temporarily unavailable - showing cached demo routes for this area.",
    };
  }
}