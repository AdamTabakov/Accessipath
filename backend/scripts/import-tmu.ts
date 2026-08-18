import { config } from "../src/config.js";
import { TMU_ACCESSIBILITY_POINTS, TMU_BUILDINGS } from "../src/data/tmuAccessibility.js";
import { PostgresStore } from "../src/services/postgres.js";

/**
 * Import the curated TMU accessibility dataset into Postgres/PostGIS.
 * Requires DATABASE_URL. Idempotent (ON CONFLICT DO NOTHING).
 */
async function main(): Promise<void> {
  if (!config.databaseUrl) {
    console.error("DATABASE_URL is not set. Configure Postgres (with PostGIS) and retry.");
    process.exit(1);
  }
  const store = new PostgresStore(config.databaseUrl);
  await store.initialize();
  await store.close();
  console.log(`Imported ${TMU_BUILDINGS.length} buildings and ${TMU_ACCESSIBILITY_POINTS.length} accessibility points.`);
}

main().catch((error) => {
  console.error("TMU import failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});