import { createApp } from "./app.js";
import { createStore } from "./services/store.js";
import { config } from "./config.js";

async function main(): Promise<void> {
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