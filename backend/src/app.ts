import { promises as fs } from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { DataStore } from "./services/store.js";
import { config } from "./config.js";
import { createApiRouter } from "./routes/api.js";
import { createAuthRouter } from "./routes/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export async function createApp(store: DataStore): Promise<express.Express> {
  const app = express();

  await fs.mkdir(config.uploadDir, { recursive: true });

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ["GET", "POST", "PUT", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: config.bodyLimit }));

  app.use("/uploads", express.static(path.resolve(config.uploadDir), { maxAge: "1h" }));

  app.use("/api/auth", createAuthRouter(store));
  app.use(createApiRouter(store));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}