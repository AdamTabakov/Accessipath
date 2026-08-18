import { describe, expect, it } from "vitest";
import type { AccessibilityPoint, RouteCandidate } from "../src/types/index.js";
import { DEFAULT_PROFILE } from "../src/services/store.js";
import { buildEvidence, scoreRoute, WEIGHTS } from "../src/services/scoring.js";
import { pointToPolylineDistanceM } from "../src/utils/spatial.js";

const stairsPoint: AccessibilityPoint = {
  id: "test-stairs",
  type: "stairs",
  latitude: 43.6579,
  longitude: -79.37835,
  stairs: true,
  wheelchair: "inaccessible",
  sourceType: "osm",
  confidence: 0.7,
};

const rampPoint: AccessibilityPoint = {
  id: "test-ramp",
  type: "ramp",
  latitude: 43.65752,
  longitude: -79.37825,
  ramp: true,
  sourceType: "institutional",
  confidence: 0.9,
};

const elevatorPoint: AccessibilityPoint = {
  id: "test-elevator",
  type: "elevator",
  latitude: 43.65808,
  longitude: -79.37768,
  elevator: true,
  sourceType: "institutional",
  confidence: 0.9,
};

function routeThrough(point: AccessibilityPoint): RouteCandidate {
  const geometry = [
    { latitude: point.latitude - 0.0002, longitude: point.longitude },
    { latitude: point.latitude + 0.0002, longitude: point.longitude },
  ];
  return {
    id: "route-test",
    provider: "demo",
    geometry,
    distanceMeters: 50,
    durationMinutes: 2,
  };
}

describe("scoring", () => {
  it("penalizes stairs heavily for a wheelchair profile", () => {
    const wheelchair = { ...DEFAULT_PROFILE, mobilityProfile: "wheelchair" as const };
    const route = routeThrough(stairsPoint);
    const evidence = buildEvidence(route, [stairsPoint], wheelchair);
    const scored = scoreRoute(route, evidence, wheelchair);
    expect(scored.penalties.some((p) => p.label.includes("Steps"))).toBe(true);
    expect(scored.score).toBeLessThan(70);
    expect(scored.score).toBeGreaterThanOrEqual(0);
  });

  it("rewards ramps and elevators for a wheelchair profile", () => {
    const wheelchair = { ...DEFAULT_PROFILE, mobilityProfile: "wheelchair" as const };
    const route = routeThrough(rampPoint);
    const evidence = buildEvidence(route, [rampPoint, elevatorPoint], wheelchair);
    const scored = scoreRoute(route, evidence, wheelchair);
    expect(scored.bonuses.some((b) => b.label.includes("Ramp"))).toBe(true);
    expect(scored.score).toBeGreaterThan(60);
    expect(scored.score).toBeLessThanOrEqual(100);
  });

  it("ranks a stairs route below a ramp route for wheelchair users", () => {
    const wheelchair = { ...DEFAULT_PROFILE, mobilityProfile: "wheelchair" as const };
    const stairsRoute = routeThrough(stairsPoint);
    const accessibleRoute = routeThrough(rampPoint);

    const stairsScore = scoreRoute(
      stairsRoute,
      buildEvidence(stairsRoute, [stairsPoint], wheelchair),
      wheelchair,
    );
    const accessibleScore = scoreRoute(
      accessibleRoute,
      buildEvidence(accessibleRoute, [rampPoint, elevatorPoint], wheelchair),
      wheelchair,
    );

    expect(accessibleScore.score).toBeGreaterThan(stairsScore.score);
  });

  it("uses a larger stairs penalty for wheelchair than walker", () => {
    expect(WEIGHTS.stairs.wheelchair).toBeGreaterThan(WEIGHTS.stairs.walker);
  });

  it("clamps the score to the 0-100 range", () => {
    const points = [stairsPoint, { ...stairsPoint, id: "s2" }, { ...stairsPoint, id: "s3" }];
    const wheelchair = { ...DEFAULT_PROFILE, mobilityProfile: "wheelchair" as const };
    const route = routeThrough(stairsPoint);
    const scored = scoreRoute(route, buildEvidence(route, points, wheelchair), wheelchair);
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(100);
  });

  it("attaches evidence only within the evidence radius", () => {
    const farPoint: AccessibilityPoint = {
      id: "far",
      type: "elevator",
      latitude: 43.6589,
      longitude: -79.378,
      elevator: true,
      sourceType: "institutional",
      confidence: 0.9,
    };
    const route = routeThrough(stairsPoint);
    const distance = pointToPolylineDistanceM(farPoint, route.geometry);
    expect(distance).toBeGreaterThan(45);
    const evidence = buildEvidence(route, [stairsPoint, farPoint], DEFAULT_PROFILE);
    expect(evidence.evidence.some((e) => e.id === "far")).toBe(false);
  });
});