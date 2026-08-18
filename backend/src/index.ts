import { createApp } from "./app.js";
import { createStore } from "./services/store.js";
import { config, DEV_JWT_SECRET } from "./config.js";

async function main(): Promise<void> {
  if (config.isProd && config.jwtSecret === DEV_JWT_SECRET) {
    console.error("[auth] JWT_SECRET must be set to a strong secret in production.");
    process.exit(1);
  }
  const store = await createStore();
  const app = await createApp(store);

  app.listen(config.port, () => {
    console.log(`[accessipath-api] listening on :${config.port} (${config.nodeEnv})`);
    console.log(`[accessipath-api] data store: ${store.kind}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});