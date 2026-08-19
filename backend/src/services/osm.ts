import type { AccessibilityPoint, AccessibilityStatus, Coordinates } from "../types/index.js";
import { config } from "../config.js";

export interface OsmElement {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

export interface OsmQueryResult {
  elements: OsmElement[];
}

export interface CorridorData {
  points: AccessibilityPoint[];
  ways: Coordinates[][];
}

/** Bounding box for the City of Toronto - used only by the optional import script. */
export const TORONTO_BBOX = { minLat: 43.581, minLon: -79.639, maxLat: 43.855, maxLon: -79.116 };

type Bbox = { minLat: number; minLon: number; maxLat: number; maxLon: number };

/** Rich corridor query: dense, detailed features within a small bbox around a route. */
function buildQuery(bbox: Bbox): string {
  return `[out:json][timeout:60];
(
  way["highway"="steps"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["highway"="elevator"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="elevator"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["ramp"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["highway"="crossing"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="crossing"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["kerb"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["tactile_paving"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="footway"]["wheelchair"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"~"^(footway|path|pedestrian|steps)$"]["incline"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"~"^(footway|path|pedestrian|steps)$"]["surface"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"~"^(residential|service|unclassified|living_street|pedestrian|footway|path)$"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["barrier"]["wheelchair"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
);
out body;
>;
out skel qt;`;
}

/**
 * Whole-city query. Sized to stay within public Overpass limits (no broad
 * footway surface/incline dump) while covering the features mapped densely
 * across Toronto: crossings, kerbs, tactile paving, steps, elevators, ramps
 * and wheelchair-tagged footways.
 */
function buildCityQuery(bbox: Bbox): string {
  return `[out:json][timeout:180];
(
  way["highway"="steps"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["highway"="elevator"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="elevator"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["ramp"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["highway"="crossing"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="crossing"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["kerb"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["tactile_paving"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="footway"]["wheelchair"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="pedestrian"]["wheelchair"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["barrier"]["wheelchair"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
);
out body;
>;
out skel qt;`;
}

/**
 * Query Overpass for accessibility-relevant OSM features. Result is treated
 * as untrusted input and validated before use.
 */
export async function queryOsmAccessibility(
  bbox: Bbox = TORONTO_BBOX,
  timeoutMs = 90000,
  query = buildQuery,
): Promise<OsmQueryResult> {
  const url = new URL(config.overpassUrl);
  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "AccessiPath/1.0 (hackathon; accessibility routing)",
    },
    body: new URLSearchParams({ data: query(bbox) }).toString(),
  });
  if (!res.ok) throw new Error(`Overpass responded with HTTP ${res.status}`);
  const data = (await res.json()) as OsmQueryResult;
  if (!Array.isArray(data.elements)) throw new Error("Overpass returned malformed JSON");
  return data;
}

/** Expand a bbox by a margin (degrees) around two points so it covers the corridor between them. */
function corridorBbox(a: Coordinates, b: Coordinates, marginDeg = 0.004): Bbox {
  const minLat = Math.min(a.latitude, b.latitude) - marginDeg;
  const maxLat = Math.max(a.latitude, b.latitude) + marginDeg;
  const minLon = Math.min(a.longitude, b.longitude) - marginDeg;
  const maxLon = Math.max(a.longitude, b.longitude) + marginDeg;
  return { minLat, minLon, maxLat, maxLon };
}

const ROUGH_SURFACES = new Set([
  "cobblestone",
  "unpaved",
  "gravel",
  "grass",
  "sand",
  "dirt",
  "mud",
  "pebblestone",
  "sett",
  "ground",
]);

function safeWheelchair(tags: Record<string, string>): AccessibilityStatus | undefined {
  const v = tags["wheelchair"] ?? tags["access"];
  if (v === "yes" || v === "designated" || v === "permissive") return "accessible";
  if (v === "no" || v === "limited") return "inaccessible";
  return undefined;
}

type NodePoint = { id: string; latitude: number; longitude: number };

function pointFromNode(el: OsmElement): NodePoint | null {
  if (typeof el.lat !== "number" || typeof el.lon !== "number") return null;
  return {
    id: `osm-node-${el.id}`,
    latitude: el.lat,
    longitude: el.lon,
  };
}

function buildNodeCoords(elements: OsmElement[]): Map<number, Coordinates> {
  const nodeCoords = new Map<number, Coordinates>();
  for (const el of elements) {
    if (el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number") {
      nodeCoords.set(el.id, { latitude: el.lat, longitude: el.lon });
    }
  }
  return nodeCoords;
}

/**
 * Convert raw Overpass elements (which may include the recursion skeleton) into
 * typed AccessibilityPoints. Ways are located by the centroid of their member
 * nodes. The output is treated as untrusted external data.
 */
export function osmElementsToAccessibilityPoints(elements: OsmElement[]): AccessibilityPoint[] {
  const nodeCoords = buildNodeCoords(elements);

  const points: AccessibilityPoint[] = [];

  const centroid = (el: OsmElement): Coordinates | null => {
    if (!el.nodes || el.nodes.length === 0) return null;
    const coords = el.nodes
      .map((id) => nodeCoords.get(id))
      .filter((c): c is Coordinates => c !== undefined);
    if (coords.length === 0) return null;
    const lat = coords.reduce((s, c) => s + c.latitude, 0) / coords.length;
    const lon = coords.reduce((s, c) => s + c.longitude, 0) / coords.length;
    return { latitude: lat, longitude: lon };
  };

  for (const el of elements) {
    if (!el.tags || Object.keys(el.tags).length === 0) continue;
    const tags = el.tags;

    const base: AccessibilityPoint = {
      id: `osm-${el.type}-${el.id}`,
      buildingName: undefined,
      type: "other",
      latitude: 0,
      longitude: 0,
      sourceType: "osm",
      confidence: 0.6,
    };

    if (el.type === "node") {
      const fromNode = pointFromNode(el);
      if (!fromNode) continue;
      base.id = fromNode.id;
      base.latitude = fromNode.latitude;
      base.longitude = fromNode.longitude;
    } else {
      const c = centroid(el);
      if (!c) continue;
      base.latitude = c.latitude;
      base.longitude = c.longitude;
    }

    if (tags["highway"] === "steps") {
      base.type = "stairs";
      base.stairs = true;
      base.description = "Step way (highway=steps).";
    } else if (tags["highway"] === "elevator") {
      base.type = "elevator";
      base.elevator = true;
      base.description = "Elevator mapped in OpenStreetMap.";
    } else if (tags["ramp"] && tags["ramp"] !== "no") {
      base.type = "ramp";
      base.ramp = true;
      base.description = "Ramp mapped in OpenStreetMap.";
    } else if (tags["highway"] === "crossing") {
      base.type = "crossing";
      base.description = "Street crossing.";
      if (tags["crossing"] === "uncontrolled" || tags["crossing"] === "unmarked") {
        base.description = "Street crossing (uncontrolled).";
      }
      if (tags["crossing"] === "traffic_signals" || tags["crossing"] === "traffic_signal") {
        base.description = "Street crossing with traffic signals.";
        base.wheelchair = base.wheelchair ?? "accessible";
      }
      if (tags["tactile_paving"] === "yes") {
        base.description = `${base.description} Tactile paving present.`;
      }
      if (tags["kerb"] === "no" || tags["kerb"] === "flush" || tags["kerb"] === "lowered") {
        base.description = `${base.description} Dropped/level kerb.`;
      }
      const crossingWheelchair = safeWheelchair(tags);
      if (crossingWheelchair) base.wheelchair = crossingWheelchair;
    } else if (tags["barrier"]) {
      base.type = "barrier";
      base.description = `Barrier (${tags["barrier"]}).`;
      base.wheelchair = safeWheelchair(tags);
    } else if (tags["kerb"]) {
      base.type = "crossing";
      base.description = `Kerb (${tags["kerb"]}).`;
      if (tags["kerb"] === "no" || tags["kerb"] === "flush" || tags["kerb"] === "lowered") {
        base.wheelchair = "accessible";
        base.description = "Dropped/level kerb.";
      }
    } else {
      base.type = "other";
      let meaningful = false;
      const incline = tags["incline"];
      if (incline) {
        const numeric = parseFloat(incline.replace("%", ""));
        if (Number.isFinite(numeric) && Math.abs(numeric) > 8) {
          base.incline = "steep";
          base.description = `Steep incline (${incline}).`;
        } else {
          base.description = `Incline ${incline}.`;
        }
        meaningful = true;
      }
      const surface = tags["surface"];
      if (surface && ROUGH_SURFACES.has(surface)) {
        base.surface = "rough";
        base.description = base.description
          ? `${base.description} Rough surface (${surface}).`
          : `Rough surface (${surface}).`;
        meaningful = true;
      }
      if (tags["wheelchair"]) {
        base.wheelchair = safeWheelchair(tags);
        meaningful = true;
      }
      if (!meaningful) continue;
    }

    points.push(base);
  }

  return points;
}

const WALKABLE_HIGHWAYS = new Set([
  "footway",
  "path",
  "pedestrian",
  "steps",
  "living_street",
  "residential",
  "service",
  "unclassified",
  "cycleway",
  "track",
]);

/** Reconstruct walkable way polylines (for sidewalk-following demo routing). */
export function osmElementsToWayPolylines(elements: OsmElement[]): Coordinates[][] {
  const nodeCoords = buildNodeCoords(elements);
  const polylines: Coordinates[][] = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.tags || !el.nodes || el.nodes.length < 2) continue;
    const highway = el.tags["highway"];
    if (!highway || !WALKABLE_HIGHWAYS.has(highway)) continue;
    const line: Coordinates[] = [];
    for (const nodeId of el.nodes) {
      const c = nodeCoords.get(nodeId);
      if (c) line.push(c);
    }
    if (line.length >= 2) polylines.push(line);
  }
  return polylines;
}

const corridorCache = new Map<string, CorridorData>();
const CORRIDOR_CACHE_MAX = 64;

function corridorKey(start: Coordinates, end: Coordinates): string {
  const bbox = corridorBbox(start, end);
  return [bbox.minLat, bbox.minLon, bbox.maxLat, bbox.maxLon]
    .map((v) => v.toFixed(3))
    .join(",");
}

/**
 * Fetch real OSM accessibility data (points + walkable way polylines) for the
 * corridor between two points, cached per rounded corridor key.
 */
export async function fetchCorridorData(
  start: Coordinates,
  end: Coordinates,
): Promise<CorridorData> {
  const key = corridorKey(start, end);
  const cached = corridorCache.get(key);
  if (cached) return cached;

  const bbox = corridorBbox(start, end);
  const result = await queryOsmAccessibility(bbox, 25000);
  const data: CorridorData = {
    points: osmElementsToAccessibilityPoints(result.elements),
    ways: osmElementsToWayPolylines(result.elements),
  };
  corridorCache.set(key, data);
  if (corridorCache.size > CORRIDOR_CACHE_MAX) {
    const firstKey = corridorCache.keys().next().value;
    if (firstKey !== undefined) corridorCache.delete(firstKey);
  }
  return data;
}

/** Backwards-compatible helper returning only corridor points. */
export async function fetchCorridorAccessibility(
  start: Coordinates,
  end: Coordinates,
): Promise<AccessibilityPoint[]> {
  const data = await fetchCorridorData(start, end);
  return data.points;
}

/**
 * Region-based accessibility cache. Instead of scanning one fixed city, we
 * lazily scan a ~16 km square around each route (in the background) and cache
 * it, so the app gets the same OpenStreetMap coverage anywhere on Earth.
 * The scan never blocks route calculation: callers get cached data when it is
 * ready, otherwise an empty result (the dense corridor fetch already covers
 * the immediate route).
 */
const REGION_MARGIN_DEG = 0.15;
const regionCache = new Map<string, CorridorData>();
const REGION_CACHE_MAX = 24;
const regionPending = new Map<string, Promise<void>>();

function regionKey(center: Coordinates): string {
  return `${center.latitude.toFixed(2)},${center.longitude.toFixed(2)}`;
}

function ensureRegion(center: Coordinates): void {
  const key = regionKey(center);
  if (regionCache.has(key) || regionPending.has(key)) return;
  const bbox: Bbox = {
    minLat: center.latitude - REGION_MARGIN_DEG,
    minLon: center.longitude - REGION_MARGIN_DEG,
    maxLat: center.latitude + REGION_MARGIN_DEG,
    maxLon: center.longitude + REGION_MARGIN_DEG,
  };
  const promise = queryOsmAccessibility(bbox, 180000, buildCityQuery)
    .then((result) => {
      regionCache.set(key, {
        points: osmElementsToAccessibilityPoints(result.elements),
        ways: osmElementsToWayPolylines(result.elements),
      });
      if (regionCache.size > REGION_CACHE_MAX) {
        const firstKey = regionCache.keys().next().value;
        if (firstKey !== undefined) regionCache.delete(firstKey);
      }
    })
    .catch((error) => {
      console.error(
        "[osm] Region scan failed:",
        error instanceof Error ? error.message : error,
      );
    })
    .finally(() => {
      regionPending.delete(key);
    });
  regionPending.set(key, promise);
}

export function getRegionalAccessibility(
  start: Coordinates,
  end: Coordinates,
): CorridorData {
  const mid: Coordinates = {
    latitude: (start.latitude + end.latitude) / 2,
    longitude: (start.longitude + end.longitude) / 2,
  };
  ensureRegion(mid);
  return regionCache.get(regionKey(mid)) ?? { points: [], ways: [] };
}