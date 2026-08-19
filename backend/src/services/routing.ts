import type { Coordinates, RouteCandidate } from "../types/index.js";
import { config } from "../config.js";
import { haversineDistance, polylineLengthM } from "../utils/spatial.js";
import { createTtlCache } from "../utils/ttlCache.js";

const WALK_SPEED_MPS = 1.25;

/** Upper bound on corridor ways used to build the walkable network graph. */
const MAX_CORRIDOR_WAYS = 8000;

/** Cap on how many path edges we try to avoid when searching for a detour. */
const MAX_DETOUR_ATTEMPTS = 24;

/** Cache raw OSRM candidates per rounded start/end so mode/profile changes are instant. */
const osrmCache = createTtlCache<string, RouteCandidate[]>(10 * 60_000);

function osrmCacheKey(start: Coordinates, end: Coordinates): string {
  return (
    `${start.latitude.toFixed(4)},${start.longitude.toFixed(4)};` +
    `${end.latitude.toFixed(4)},${end.longitude.toFixed(4)}`
  );
}

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
  const key = osrmCacheKey(start, end);
  const cached = osrmCache.get(key);
  if (cached) return cached;

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
      const distance = r.distance ?? polylineLengthM(geometry);
      return toCandidate(
        `route_${i + 1}`,
        "osrm",
        geometry,
        distance,
        distance / WALK_SPEED_MPS,
      );
    })
    .filter((r): r is RouteCandidate => r !== null);
  osrmCache.set(key, routes);
  return routes;
}

/**
 * Build sidewalk-following routes by walking the OSM way network between two
 * points (a small graph over walkable way endpoints, Dijkstra by length).
 * Returns up to two candidates, or [] when the network can't be walked.
 */
function sidewalkRoutesFromWays(
  start: Coordinates,
  end: Coordinates,
  ways: Coordinates[][],
): RouteCandidate[] {
  if (!ways || ways.length === 0) return [];

  const nodeKey = (c: Coordinates) => `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`;
  const nodeById = new Map<string, number>();
  const nodeCoord: Coordinates[] = [];
  const getNode = (c: Coordinates): number => {
    const k = nodeKey(c);
    let id = nodeById.get(k);
    if (id === undefined) {
      id = nodeCoord.length;
      nodeById.set(k, id);
      nodeCoord.push(c);
    }
    return id;
  };

  interface WayEdge {
    a: number;
    b: number;
    geom: Coordinates[];
  }
  const edges: WayEdge[] = [];
  const adj = new Map<number, number[]>();
  const addEdge = (a: number, b: number, geom: Coordinates[]) => {
    const ei = edges.length;
    edges.push({ a, b, geom });
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(ei);
    adj.get(b)!.push(ei);
  };

  interface Snap {
    wayIndex: number;
    point: Coordinates;
    segIndex: number;
    t: number;
    dist: number;
  }

  // Nearest point ON any way polyline (not just its endpoints), so start/end
  // points that sit mid-way along a street still snap onto the network.
  function nearestOnWays(p: Coordinates): Snap | null {
    let best: Snap | null = null;
    for (let wi = 0; wi < ways.length; wi++) {
      const poly = ways[wi]!;
      for (let i = 0; i < poly.length - 1; i++) {
        const a = poly[i]!;
        const b = poly[i + 1]!;
        const dLon = b.longitude - a.longitude;
        const dLat = b.latitude - a.latitude;
        const lenSq = dLon * dLon + dLat * dLat;
        let t = lenSq === 0 ? 0 : ((p.longitude - a.longitude) * dLon + (p.latitude - a.latitude) * dLat) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const point = { longitude: a.longitude + t * dLon, latitude: a.latitude + t * dLat };
        const dist = haversineDistance(p, point);
        if (!best || dist < best.dist) best = { wayIndex: wi, point, segIndex: i, t, dist };
      }
    }
    return best;
  }

  const startSnap = nearestOnWays(start);
  const endSnap = nearestOnWays(end);
  if (!startSnap || !endSnap || startSnap.dist > 500 || endSnap.dist > 500) return [];

  const splitGeometry = (
    geom: Coordinates[],
    segIndex: number,
    point: Coordinates,
  ): [Coordinates[], Coordinates[]] => {
    const left = [...geom.slice(0, segIndex + 1), point];
    const right = [point, ...geom.slice(segIndex + 1)];
    return [left, right];
  };

  // Split the ways that contain the start/end snap points so the network
  // connects at exactly where the user starts and ends.
  for (let wi = 0; wi < ways.length; wi++) {
    const w = ways[wi]!;
    if (w.length < 2) continue;
    const inStart = startSnap.wayIndex === wi && startSnap.t > 0.005 && startSnap.t < 0.995;
    const inEnd = endSnap.wayIndex === wi && endSnap.t > 0.005 && endSnap.t < 0.995;

    if (inStart && inEnd) {
      const sSeg = startSnap.segIndex;
      const eSeg = endSnap.segIndex;
      const between =
        sSeg <= eSeg ? w.slice(sSeg + 1, eSeg + 1) : w.slice(eSeg + 1, sSeg + 1).reverse();
      const geom = [startSnap.point, ...between, endSnap.point];
      addEdge(getNode(startSnap.point), getNode(endSnap.point), geom);
      continue;
    }
    if (inStart) {
      const [left, right] = splitGeometry(w, startSnap.segIndex, startSnap.point);
      addEdge(getNode(left[0]!), getNode(startSnap.point), left);
      addEdge(getNode(startSnap.point), getNode(right[right.length - 1]!), right);
      continue;
    }
    if (inEnd) {
      const [left, right] = splitGeometry(w, endSnap.segIndex, endSnap.point);
      addEdge(getNode(left[0]!), getNode(endSnap.point), left);
      addEdge(getNode(endSnap.point), getNode(right[right.length - 1]!), right);
      continue;
    }
    addEdge(getNode(w[0]!), getNode(w[w.length - 1]!), w);
  }

  if (nodeCoord.length < 2 || edges.length === 0) return [];

  const edgeLen = (e: WayEdge) => polylineLengthM(e.geom);

  const startNode = getNode(startSnap.point);
  const endNode = getNode(endSnap.point);
  if (startNode === endNode) return [];

  function dijkstra(
    s: number,
    t: number,
    bannedEdge = -1,
  ): { prevEdge: number[]; reached: boolean } | null {
    const dist = new Array<number>(nodeCoord.length).fill(Number.POSITIVE_INFINITY);
    const prevEdge = new Array<number>(nodeCoord.length).fill(-1);
    const visited = new Array<boolean>(nodeCoord.length).fill(false);
    dist[s] = 0;
    for (let iter = 0; iter < nodeCoord.length; iter++) {
      let u = -1;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < nodeCoord.length; i++) {
        if (!visited[i] && dist[i]! < best) {
          best = dist[i]!;
          u = i;
        }
      }
      if (u === -1 || u === t) break;
      visited[u] = true;
      for (const ei of adj.get(u) ?? []) {
        if (ei === bannedEdge) continue;
        const e = edges[ei]!;
        const v = e.a === u ? e.b : e.a;
        if (visited[v]) continue;
        const nd = dist[u]! + edgeLen(e);
        if (nd < dist[v]!) {
          dist[v] = nd;
          prevEdge[v] = ei;
        }
      }
    }
    if (dist[t] === Number.POSITIVE_INFINITY) return null;
    return { prevEdge, reached: true };
  }

  function reconstruct(prevEdge: number[]): Coordinates[] | null {
    const chain: number[] = [];
    let cur = endNode;
    const guard = new Set<number>();
    while (cur !== startNode) {
      if (guard.has(cur)) return null;
      guard.add(cur);
      const ei = prevEdge[cur]!;
      if (ei === -1) return null;
      chain.push(ei);
      const e = edges[ei]!;
      cur = e.a === cur ? e.b : e.a;
    }
    chain.reverse();
    const result: Coordinates[] = [];
    let prevPoint: Coordinates | null = null;
    for (const ei of chain) {
      const e = edges[ei]!;
      const geom = [...e.geom];
      if (prevPoint) {
        const d1 = haversineDistance(prevPoint, geom[0]!);
        const d2 = haversineDistance(prevPoint, geom[geom.length - 1]!);
        if (d1 > d2) geom.reverse();
      }
      const startIdx = prevPoint ? 1 : 0;
      for (let i = startIdx; i < geom.length; i++) result.push(geom[i]!);
      prevPoint = geom[geom.length - 1]!;
    }
    return result;
  }

  const primary = dijkstra(startNode, endNode);
  if (!primary) return [];
  const geom1 = reconstruct(primary.prevEdge);
  if (!geom1) return [];

  // Collect the edges along the primary path to find a good edge to avoid.
  const pathEdges: number[] = [];
  {
    let cur = endNode;
    const guard = new Set<number>();
    while (cur !== startNode) {
      if (guard.has(cur)) break;
      guard.add(cur);
      const ei = primary.prevEdge[cur]!;
      if (ei === -1) break;
      pathEdges.push(ei);
      const e = edges[ei]!;
      cur = e.a === cur ? e.b : e.a;
    }
  }
  // Try avoiding edges on the primary path until we get a genuinely different
  // detour; the corridor network may be a single route (e.g. through a tunnel),
  // in which case there is no second path. Bound attempts to keep worst-case
  // latency sane on large networks.
  let geom2: Coordinates[] | null = null;
  const primaryLen = polylineLengthM(geom1);
  let attempts = 0;
  for (const ei of pathEdges) {
    if (attempts >= MAX_DETOUR_ATTEMPTS) break;
    attempts++;
    const secondary = dijkstra(startNode, endNode, ei);
    if (!secondary) continue;
    const g = reconstruct(secondary.prevEdge);
    if (g && Math.abs(primaryLen - polylineLengthM(g)) >= 10) {
      geom2 = g;
      break;
    }
  }
  if (!geom2) {
    return [toCandidate("route_1", "demo", geom1, primaryLen, primaryLen / WALK_SPEED_MPS)];
  }
  const secondaryLen = polylineLengthM(geom2);
  return [
    toCandidate("route_1", "demo", geom1, primaryLen, primaryLen / WALK_SPEED_MPS),
    toCandidate("route_2", "demo", geom2, secondaryLen, secondaryLen / WALK_SPEED_MPS),
  ];
}

/**
 * Get candidate walking routes that follow real, walkable paths.
 * Prefers the live engine (OSRM foot profile); supplements or falls back to
 * routes built from the OpenStreetMap walkable way network. Never emits
 * "as-the-crow-flies" fallbacks that ignore walkways.
 */
export async function getCandidateRoutes(
  start: Coordinates,
  end: Coordinates,
  ways?: Coordinates[][],
): Promise<{ routes: RouteCandidate[]; provider: "osrm" | "demo"; warning?: string }> {
  const buildSidewalk = (): RouteCandidate[] =>
    ways && ways.length > 0 && ways.length <= MAX_CORRIDOR_WAYS
      ? sidewalkRoutesFromWays(start, end, ways)
      : [];

  try {
    const routes = await fetchOsrmRoutes(start, end);
    if (routes.length >= 2) {
      return { routes, provider: "osrm" };
    }
    if (routes.length === 1) {
      const extras = buildSidewalk()
        .filter((d) => Math.abs(d.distanceMeters - routes[0]!.distanceMeters) > 30)
        .map((d, i) => ({ ...d, id: `alt-${i + 1}` }));
      return {
        routes: [routes[0]!, ...extras].slice(0, 3),
        provider: "osrm",
        warning:
          extras.length === 0
            ? "Only one walkable route could be found between these points."
            : undefined,
      };
    }
    const sidewalk = buildSidewalk();
    if (sidewalk.length >= 1) {
      return {
        routes: sidewalk.slice(0, 2),
        provider: "demo",
        warning:
          "Live routing is temporarily unavailable - showing a route built from OpenStreetMap walkable paths.",
      };
    }
    return {
      routes: [],
      provider: "demo",
      warning: "Could not find a walkable route between these points.",
    };
  } catch (error) {
    console.error(
      "[routing] Live routing unavailable:",
      error instanceof Error ? error.message : error,
    );
    const sidewalk = buildSidewalk();
    if (sidewalk.length >= 1) {
      return {
        routes: sidewalk.slice(0, 2),
        provider: "demo",
        warning:
          "Live routing is temporarily unavailable - showing a route built from OpenStreetMap walkable paths.",
      };
    }
    return {
      routes: [],
      provider: "demo",
      warning:
        "Live routing is temporarily unavailable and no walkable path could be built from OpenStreetMap data.",
    };
  }
}