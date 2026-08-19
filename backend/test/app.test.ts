import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type express from "express";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/services/store.js";

let app: express.Express;

const osrmRoutes = {
  code: "Ok",
  routes: [
    {
      distance: 520,
      duration: 420,
      geometry: {
        type: "LineString",
        coordinates: [
          [-79.3802, 43.6577],
          [-79.3791, 43.65785],
          [-79.377632, 43.658112],
        ],
      },
    },
    {
      distance: 610,
      duration: 490,
      geometry: {
        type: "LineString",
        coordinates: [
          [-79.3802, 43.6577],
          [-79.3788, 43.658],
          [-79.3781, 43.65805],
          [-79.377632, 43.658112],
        ],
      },
    },
  ],
};

beforeAll(async () => {
  vi.stubGlobal("fetch", async (input: unknown) => {
    const url =
      typeof input === "string"
        ? input
        : typeof input === "object" && input !== null && "url" in input
          ? String((input as { url: unknown }).url)
          : "";
    if (url.includes("/route/v1/foot/")) {
      return new Response(JSON.stringify(osrmRoutes), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected network fetch in tests: ${url}`);
  });
  app = await createApp(new MemoryStore());
});

describe("API", () => {
  it("serves /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("rejects invalid route coordinates", async () => {
    const res = await request(app).get(
      "/api/routes?start=999,-79.38&end=43.658112,-79.377632",
    );
    expect(res.status).toBe(400);
  });

  it("returns at least two scored routes for SLC -> ENG", async () => {
    const res = await request(app).get(
      "/api/routes?start=43.6577,-79.3802&end=43.658112,-79.377632&profile=wheelchair&mode=most_accessible",
    );
    expect(res.status).toBe(200);
    expect(res.body.routes.length).toBeGreaterThanOrEqual(2);
    for (const route of res.body.routes) {
      expect(route.accessibilityScore).toBeGreaterThanOrEqual(0);
      expect(route.accessibilityScore).toBeLessThanOrEqual(100);
      expect(route.dataConfidence).toBeGreaterThanOrEqual(0);
      expect(route.dataConfidence).toBeLessThanOrEqual(100);
      expect(Array.isArray(route.geometry)).toBe(true);
      expect(route.geometry.length).toBeGreaterThan(1);
      expect(Array.isArray(route.penalties)).toBe(true);
      expect(Array.isArray(route.bonuses)).toBe(true);
    }
  });

  it("sorts most_accessible routes by descending accessibility score", async () => {
    const res = await request(app).get(
      "/api/routes?start=43.6577,-79.3802&end=43.658112,-79.377632&profile=wheelchair&mode=most_accessible",
    );
    expect(res.status).toBe(200);
    const scores = res.body.routes.map((r: { accessibilityScore: number }) => r.accessibilityScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("sorts fastest routes by ascending duration", async () => {
    const res = await request(app).get(
      "/api/routes?start=43.6577,-79.3802&end=43.658112,-79.377632&profile=wheelchair&mode=fastest",
    );
    expect(res.status).toBe(200);
    const durations = res.body.routes.map((r: { durationMinutes: number }) => r.durationMinutes);
    const sorted = [...durations].sort((a, b) => a - b);
    expect(durations).toEqual(sorted);
  });

  it("creates a community report", async () => {
    const res = await request(app).post("/api/reports").send({
      type: "blocked_ramp",
      description: "Demo ramp blocked by crates.",
      latitude: 43.6577,
      longitude: -79.3802,
    });
    expect(res.status).toBe(201);
    expect(res.body.report.status).toBe("pending");
  });

  it("rejects an invalid report", async () => {
    const res = await request(app).post("/api/reports").send({
      type: "blocked_ramp",
      description: "x",
      latitude: 43.6577,
      longitude: -79.3802,
    });
    expect(res.status).toBe(400);
  });

  it("rejects a report with an invalid photo upload", async () => {
    const res = await request(app).post("/api/reports").send({
      type: "blocked_ramp",
      description: "Ramp blocked by a large sign.",
      latitude: 43.6577,
      longitude: -79.3802,
      photo: "this is not a data url",
    });
    expect(res.status).toBe(400);
  });

  it("accepts a valid PNG photo upload", async () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const res = await request(app).post("/api/reports").send({
      type: "blocked_ramp",
      description: "Ramp blocked by scaffolding.",
      latitude: 43.6577,
      longitude: -79.3802,
      photo: png,
    });
    expect(res.status).toBe(201);
    expect(res.body.report.photoUrl).toMatch(/^\/uploads\//);
  });

  it("rejects a photo whose bytes do not match a supported image signature", async () => {
    const html = Buffer.from("<html><body>not an image</body></html>").toString("base64");
    const res = await request(app).post("/api/reports").send({
      type: "blocked_ramp",
      description: "Attempt to smuggle non-image content.",
      latitude: 43.6577,
      longitude: -79.3802,
      photo: `data:image/png;base64,${html}`,
    });
    expect(res.status).toBe(400);
  });

  it("rejects a photo with corrupted (non-matching) magic bytes", async () => {
    const res = await request(app).post("/api/reports").send({
      type: "blocked_ramp",
      description: "Corrupted image bytes.",
      latitude: 43.6577,
      longitude: -79.3802,
      photo: "data:image/png;base64,AAAA",
    });
    expect(res.status).toBe(400);
  });

  it("gets and updates the profile", async () => {
    const getRes = await request(app).get("/api/profile");
    expect(getRes.status).toBe(200);
    expect(getRes.body.profile.mobilityProfile).toBe("wheelchair");

    const putRes = await request(app).put("/api/profile").send({
      mobilityProfile: "walker",
      avoidStairs: true,
      preferRamps: true,
      preferElevators: false,
      maxSlope: "steep",
      preferSmoothSurface: true,
      maxWalkDistanceMeters: 1500,
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.profile.mobilityProfile).toBe("walker");
  });

  it("returns 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
  });
});