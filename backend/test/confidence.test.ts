import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "../src/types/index.js";
import { computeConfidence } from "../src/services/confidence.js";

function evidence(sourceType: EvidenceItem["sourceType"], label = "Feature"): EvidenceItem {
  return {
    id: `e-${Math.random()}`,
    label,
    type: "entrance",
    latitude: 43.6577,
    longitude: -79.38,
    distanceMeters: 12,
    sourceType,
    status: "accessible",
    severity: "info",
  };
}

const baseFactors = {
  stairs: 0,
  ramps: 1,
  elevators: 0,
  crossings: 1,
  accessibleEntrances: 1,
  obstacles: 0,
  steepSlopes: 0,
  roughSurface: 0,
  unknownSections: 0,
  totalSamples: 10,
};

describe("confidence", () => {
  it("trusts institutional evidence more than community evidence", () => {
    const institutional = computeConfidence({
      evidence: [evidence("institutional")],
      factors: baseFactors,
      provider: "osrm",
      profile: { mobilityProfile: "wheelchair", avoidStairs: true, preferRamps: true, preferElevators: true, maxSlope: "moderate", preferSmoothSurface: true, maxWalkDistanceMeters: 2000 },
    });
    const community = computeConfidence({
      evidence: [evidence("community")],
      factors: baseFactors,
      provider: "osrm",
      profile: { mobilityProfile: "wheelchair", avoidStairs: true, preferRamps: true, preferElevators: true, maxSlope: "moderate", preferSmoothSurface: true, maxWalkDistanceMeters: 2000 },
    });
    expect(institutional.confidence).toBeGreaterThan(community.confidence);
  });

  it("lowers confidence when many sections have no accessibility data", () => {
    const fullFactors = { ...baseFactors, unknownSections: 0, totalSamples: 10 };
    const sparseFactors = { ...baseFactors, unknownSections: 8, totalSamples: 10 };
    const full = computeConfidence({
      evidence: [evidence("institutional")],
      factors: fullFactors,
      provider: "osrm",
      profile: { mobilityProfile: "wheelchair", avoidStairs: true, preferRamps: true, preferElevators: true, maxSlope: "moderate", preferSmoothSurface: true, maxWalkDistanceMeters: 2000 },
    });
    const sparse = computeConfidence({
      evidence: [evidence("institutional")],
      factors: sparseFactors,
      provider: "osrm",
      profile: { mobilityProfile: "wheelchair", avoidStairs: true, preferRamps: true, preferElevators: true, maxSlope: "moderate", preferSmoothSurface: true, maxWalkDistanceMeters: 2000 },
    });
    expect(sparse.breakdown.coverage).toBeLessThan(0.5);
    expect(sparse.confidence).toBeLessThan(full.confidence);
  });

  it("returns a confidence between 0 and 100", () => {
    const result = computeConfidence({
      evidence: [evidence("institutional"), evidence("osm")],
      factors: baseFactors,
      provider: "osrm",
      profile: { mobilityProfile: "walker", avoidStairs: true, preferRamps: true, preferElevators: true, maxSlope: "moderate", preferSmoothSurface: true, maxWalkDistanceMeters: 2000 },
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("penalizes demo (fallback) routes slightly", () => {
    const demo = computeConfidence({
      evidence: [evidence("institutional")],
      factors: baseFactors,
      provider: "demo",
      profile: { mobilityProfile: "wheelchair", avoidStairs: true, preferRamps: true, preferElevators: true, maxSlope: "moderate", preferSmoothSurface: true, maxWalkDistanceMeters: 2000 },
    });
    const osrm = computeConfidence({
      evidence: [evidence("institutional")],
      factors: baseFactors,
      provider: "osrm",
      profile: { mobilityProfile: "wheelchair", avoidStairs: true, preferRamps: true, preferElevators: true, maxSlope: "moderate", preferSmoothSurface: true, maxWalkDistanceMeters: 2000 },
    });
    expect(demo.confidence).toBeLessThan(osrm.confidence);
  });
});