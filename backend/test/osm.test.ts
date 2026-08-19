import { describe, expect, it } from "vitest";
import { osmElementsToAccessibilityPoints, type OsmElement } from "../src/services/osm.js";

describe("osmElementsToAccessibilityPoints", () => {
  it("converts a steps way to a stairs point at its centroid", () => {
    const elements: OsmElement[] = [
      { type: "node", id: 1, lat: 43.6577, lon: -79.3802, tags: {} },
      { type: "node", id: 2, lat: 43.6578, lon: -79.3801, tags: {} },
      {
        type: "way",
        id: 100,
        nodes: [1, 2],
        tags: { highway: "steps" },
      },
    ];
    const points = osmElementsToAccessibilityPoints(elements);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      id: "osm-way-100",
      type: "stairs",
      stairs: true,
      sourceType: "osm",
      latitude: 43.65775,
      longitude: -79.38015,
    });
  });

  it("converts an elevator node", () => {
    const elements: OsmElement[] = [
      { type: "node", id: 50, lat: 43.658, lon: -79.3776, tags: { highway: "elevator" } },
    ];
    const points = osmElementsToAccessibilityPoints(elements);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ id: "osm-node-50", type: "elevator", elevator: true });
  });

  it("marks a crossing with a dropped kerb as accessible", () => {
    const elements: OsmElement[] = [
      {
        type: "node",
        id: 60,
        lat: 43.6571,
        lon: -79.3812,
        tags: { highway: "crossing", crossing: "traffic_signals", kerb: "lowered", tactile_paving: "yes" },
      },
    ];
    const points = osmElementsToAccessibilityPoints(elements);
    expect(points).toHaveLength(1);
    expect(points[0]!.type).toBe("crossing");
    expect(points[0]!.wheelchair).toBe("accessible");
    expect(points[0]!.description).toContain("traffic signals");
    expect(points[0]!.description).toContain("Dropped/level kerb");
  });

  it("flags a steep incline and a rough surface", () => {
    const elements: OsmElement[] = [
      { type: "node", id: 201, lat: 43.6577, lon: -79.3802, tags: {} },
      { type: "node", id: 202, lat: 43.6578, lon: -79.3801, tags: {} },
      {
        type: "way",
        id: 200,
        nodes: [201, 202],
        tags: { highway: "footway", incline: "12%", surface: "cobblestone" },
      },
    ];
    const points = osmElementsToAccessibilityPoints(elements);
    expect(points).toHaveLength(1);
    expect(points[0]!.incline).toBe("steep");
    expect(points[0]!.surface).toBe("rough");
  });

  it("treats a barrier with wheelchair=no as inaccessible", () => {
    const elements: OsmElement[] = [
      { type: "node", id: 70, lat: 43.6575, lon: -79.3782, tags: { barrier: "gate", wheelchair: "no" } },
    ];
    const points = osmElementsToAccessibilityPoints(elements);
    expect(points[0]).toMatchObject({ type: "barrier", wheelchair: "inaccessible" });
  });

  it("ignores elements without tags", () => {
    const elements: OsmElement[] = [
      { type: "node", id: 90, lat: 43.66, lon: -79.38, tags: {} },
      { type: "node", id: 91, lat: 43.66, lon: -79.38 },
    ];
    expect(osmElementsToAccessibilityPoints(elements)).toHaveLength(0);
  });
});