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

/** Bounding box for the TMU campus (Toronto Metropolitan University) - used for quick local imports. */
export const TMU_BBOX = { minLat: 43.652, minLon: -79.386, maxLat: 43.661, maxLon: -79.373 };

/** Bounding box for the City of Toronto (whole-city import). */
export const TORONTO_BBOX = { minLat: 43.581, minLon: -79.639, maxLat: 43.855, maxLon: -79.116 };

function buildQuery(bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number }): string {
  return `[out:json][timeout:60];
(
  way["highway"="steps"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  node["highway"="elevator"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="elevator"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["ramp"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"="footway"]["wheelchair"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"]["incline"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
  way["highway"]["surface"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
);
out body;
>;
out skel qt;`;
}

/**
 * Query Overpass for accessibility-relevant OSM features across the City of
 * Toronto by default. Result is treated as untrusted input and validated
 * before use.
 */
export async function queryOsmAccessibility(bbox = TORONTO_BBOX): Promise<OsmQueryResult> {
  const url = new URL(config.overpassUrl);
  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(90000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: buildQuery(bbox) }).toString(),
  });
  if (!res.ok) throw new Error(`Overpass responded with HTTP ${res.status}`);
  const data = (await res.json()) as OsmQueryResult;
  if (!Array.isArray(data.elements)) throw new Error("Overpass returned malformed JSON");
  return data;
}