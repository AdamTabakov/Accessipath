import pg from "pg";
import { config } from "../src/config.js";
import { queryOsmAccessibility, TORONTO_BBOX, type OsmElement } from "../src/services/osm.js";

const { Pool } = pg;

/** Resolve a way's center point from its node ids (needs node map). */
function wayCenter(way: OsmElement, nodeMap: Map<number, { lat: number; lon: number }>): { lat: number; lon: number } | null {
  if (!way.nodes) return null;
  const coords = way.nodes
    .map((n) => nodeMap.get(n))
    .filter((c): c is { lat: number; lon: number } => Boolean(c));
  if (coords.length === 0) return null;
  const lat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
  const lon = coords.reduce((sum, c) => sum + c.lon, 0) / coords.length;
  return { lat, lon };
}

function featureFromElement(el: OsmElement): {
  type: string;
  description: string;
  tags: Record<string, string>;
} | null {
  const tags = el.tags ?? {};
  if (tags["highway"] === "steps") {
    return { type: "stairs", description: "Steps mapped in OpenStreetMap.", tags };
  }
  if (tags["highway"] === "elevator") {
    return { type: "elevator", description: "Elevator mapped in OpenStreetMap.", tags };
  }
  if (tags["ramp"]) {
    return { type: "ramp", description: "Ramp tagged in OpenStreetMap.", tags };
  }
  if (tags["highway"] === "footway" && tags["wheelchair"]) {
    return { type: "other", description: `Footway with wheelchair=${tags["wheelchair"]}.`, tags };
  }
  if (tags["incline"]) {
    return { type: "other", description: `Path with incline=${tags["incline"]}.`, tags };
  }
  if (tags["surface"]) {
    return { type: "other", description: `Path with surface=${tags["surface"]}.`, tags };
  }
  return null;
}

/**
 * Import accessibility-relevant OSM features across the City of Toronto via
 * Overpass. Data is treated as untrusted and validated; source = osm,
 * ids preserved.
 */
async function main(): Promise<void> {
  console.log(`Querying Overpass for Toronto bbox (${config.overpassUrl})...`);
  const result = await queryOsmAccessibility(TORONTO_BBOX);

  const nodeMap = new Map<number, { lat: number; lon: number }>();
  for (const el of result.elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  const features: Array<{ el: OsmElement; lat: number; lon: number; type: string; description: string; tags: Record<string, string> }> = [];
  for (const el of result.elements) {
    const feat = featureFromElement(el);
    if (!feat) continue;
    const coord =
      el.type === "node" && el.lat !== undefined && el.lon !== undefined
        ? { lat: el.lat, lon: el.lon }
        : wayCenter(el, nodeMap);
    if (!coord) continue;
    features.push({ el, ...coord, ...feat });
  }

  console.log(`Found ${features.length} accessibility features.`);

  if (!config.databaseUrl) {
    console.log("No DATABASE_URL - printing summary only:");
    for (const f of features.slice(0, 30)) {
      console.log(`  [${f.type}] ${f.el.type}/${f.el.id} (${f.lat.toFixed(5)}, ${f.lon.toFixed(5)})`);
    }
    return;
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });

  for (const f of features) {
    await pool.query(
      `INSERT INTO osm_features (osm_type, osm_id, geometry, tags_json)
       VALUES ($1,$2,ST_GeogFromText($3),$4)
       ON CONFLICT DO NOTHING`,
      [f.el.type, f.el.id, `SRID=4326;POINT(${f.lon} ${f.lat})`, JSON.stringify(f.tags)],
    );
    await pool.query(
      `INSERT INTO accessibility_points
         (id, type, geometry, source_type, confidence, description)
       VALUES ($1,$2,ST_GeogFromText($3),'osm',0.6,$4)
       ON CONFLICT DO NOTHING`,
      [`osm-${f.el.type}-${f.el.id}`, f.type, `SRID=4326;POINT(${f.lon} ${f.lat})`, f.description],
    );
  }

  await pool.end();
  console.log("Imported OSM accessibility features into PostGIS.");
}

main().catch((error) => {
  console.error("OSM import failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});