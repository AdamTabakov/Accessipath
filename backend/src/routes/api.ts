import { Router } from "express";
import type { DataStore } from "../services/store.js";
import { buildRoutes, profileFromDefaults } from "../controllers/routingController.js";
import { geocode } from "../services/geocoding.js";
import { savePhoto } from "../utils/uploads.js";
import { HttpError } from "../middleware/error.js";
import { apiLimiter, strictLimiter } from "../middleware/rateLimit.js";
import {
  aiBodySchema,
  nearbyQuerySchema,
  profileBodySchema,
  reportBodySchema,
  routesQuerySchema,
} from "../middleware/validate.js";

export function createApiRouter(store: DataStore): Router {
  const router = Router();

  router.use("/api", apiLimiter);

  router.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "accessipath-api",
      version: "1.0.0",
      time: new Date().toISOString(),
      dataStore: store.kind,
    });
  });

  router.get("/api/places", async (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      res.json({ results: await store.searchPlaces(q) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/geocode", strictLimiter, async (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!q) {
        res.json({ results: [] });
        return;
      }
      const results = await geocode(q);
      res.json({ results });
    } catch (error) {
      console.error("[geocode]", error instanceof Error ? error.message : error);
      res.status(502).json({ error: "Geocoding is temporarily unavailable." });
    }
  });

  router.get("/api/routes", async (req, res, next) => {
    try {
      const query = routesQuerySchema.parse(req.query);
      const profile = profileFromDefaults({
        mobilityProfile: query.profile,
        avoidStairs:
          query.avoid_stairs !== undefined ? query.avoid_stairs === "true" : undefined,
        preferRamps:
          query.prefer_ramps !== undefined ? query.prefer_ramps === "true" : undefined,
        preferElevators:
          query.prefer_elevators !== undefined ? query.prefer_elevators === "true" : undefined,
        maxSlope: query.max_slope,
        maxWalkDistanceMeters: query.max_walk_meters,
      });
      const { routes, warnings } = await buildRoutes({
        start: query.start,
        end: query.end,
        profile,
        mode: query.mode,
        store,
      });
      res.json({ routes, warnings, profile: await store.getProfile() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/accessibility/nearby", async (req, res, next) => {
    try {
      const query = nearbyQuerySchema.parse(req.query);
      const points = await store.getAccessibilityPointsNear(query.lat, query.lon, query.radius);
      res.json({ points });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/buildings", async (_req, res, next) => {
    try {
      res.json({ buildings: await store.getBuildings() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/buildings/:id", async (req, res, next) => {
    try {
      const building = await store.getBuilding(req.params.id);
      if (!building) throw new HttpError(404, "Building not found.");
      res.json({ building });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports", async (_req, res, next) => {
    try {
      res.json({ reports: await store.getReports() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/reports", strictLimiter, async (req, res, next) => {
    try {
      const body = reportBodySchema.parse(req.body);
      let photoUrl: string | undefined;
      if (body.photo) {
        try {
          photoUrl = (await savePhoto(body.photo)).photoUrl;
        } catch (error) {
          throw new HttpError(
            400,
            error instanceof Error ? error.message : "Invalid photo upload.",
          );
        }
      }
      const report = await store.createReport({
        type: body.type,
        description: body.description,
        latitude: body.latitude,
        longitude: body.longitude,
        photoUrl,
        aiObservation: body.aiObservation
          ? {
              ...body.aiObservation,
              allDetections: body.aiObservation.allDetections ?? [],
              createdAt: new Date().toISOString(),
            }
          : undefined,
      });
      res.status(201).json({ report });
    } catch (error) {
      if (error instanceof Error && !(error as unknown as { status?: number }).status) {
        next(error);
        return;
      }
      next(error);
    }
  });

  router.post("/api/ai/analyze", strictLimiter, async (req, res, next) => {
    try {
      const body = aiBodySchema.parse(req.body);
      if (!body.observation) {
        throw new HttpError(
          400,
          "No observation provided. Analysis runs on-device (privacy-first); send the structured result.",
        );
      }
      let photoUrl: string | undefined;
      if (body.image) {
        photoUrl = (await savePhoto(body.image)).photoUrl;
      }
      const observation = await store.createAiObservation({
        ...body.observation,
        allDetections: body.observation.allDetections ?? [],
        createdAt: new Date().toISOString(),
      });
      res.status(201).json({ ok: true, observation, photoUrl });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/profile", async (_req, res, next) => {
    try {
      res.json({ profile: await store.getProfile() });
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/profile", async (req, res, next) => {
    try {
      const body = profileBodySchema.parse(req.body);
      const profile = await store.saveProfile(body);
      res.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  return router;
}