import { describe, expect, it } from "vitest";
import { coordsParamSchema, reportBodySchema, routesQuerySchema } from "../src/middleware/validate.js";

describe("validation", () => {
  it("accepts valid coordinates", () => {
    expect(coordsParamSchema.parse("43.6577,-79.3802")).toEqual({
      latitude: 43.6577,
      longitude: -79.3802,
    });
  });

  it("rejects out-of-range coordinates", () => {
    expect(() => coordsParamSchema.parse("999,-79.38")).toThrow();
    expect(() => coordsParamSchema.parse("43.65,181")).toThrow();
    expect(() => coordsParamSchema.parse("garbage")).toThrow();
  });

  it("accepts a valid routes query", () => {
    const result = routesQuerySchema.parse({
      start: "43.6577,-79.3802",
      end: "43.658112,-79.377632",
      profile: "wheelchair",
      mode: "most_accessible",
    });
    expect(result.profile).toBe("wheelchair");
    expect(result.mode).toBe("most_accessible");
  });

  it("rejects a routes query with invalid profile", () => {
    expect(() =>
      routesQuerySchema.parse({
        start: "43.6577,-79.3802",
        end: "43.658112,-79.377632",
        profile: "jetpack",
      }),
    ).toThrow();
  });

  it("accepts a valid report body", () => {
    const result = reportBodySchema.parse({
      type: "blocked_ramp",
      description: "Ramp blocked by construction.",
      latitude: 43.6577,
      longitude: -79.3802,
    });
    expect(result.type).toBe("blocked_ramp");
  });

  it("rejects a report with empty description", () => {
    expect(() =>
      reportBodySchema.parse({
        type: "blocked_ramp",
        description: "  ",
        latitude: 43.6577,
        longitude: -79.3802,
      }),
    ).toThrow();
  });

  it("rejects a report with out-of-range coordinates", () => {
    expect(() =>
      reportBodySchema.parse({
        type: "other",
        description: "Something",
        latitude: 200,
        longitude: -79.3802,
      }),
    ).toThrow();
  });
});