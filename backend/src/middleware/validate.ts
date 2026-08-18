import { z } from "zod";
import type { MobilityProfile, RouteMode } from "../types/index.js";
import { isValidCoordinate } from "../utils/spatial.js";

export const coordsParamSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, "expected format 'lat,lon'")
  .transform((value, ctx) => {
    const [latStr, lonStr] = value.split(",");
    const latitude = Number(latStr);
    const longitude = Number(lonStr);
    if (!isValidCoordinate(latitude, longitude)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Coordinates out of range: latitude -90..90, longitude -180..180",
      });
      return z.NEVER;
    }
    return { latitude, longitude };
  });

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

export const mobilityProfileSchema = z.enum([
  "wheelchair",
  "walker",
  "cane",
  "limited_mobility",
  "custom",
]);

export const routeModeSchema = z.enum(["fastest", "balanced", "most_accessible"]);

export const routesQuerySchema = z.object({
  start: coordsParamSchema,
  end: coordsParamSchema,
  profile: mobilityProfileSchema.optional().default("wheelchair"),
  mode: routeModeSchema.optional().default("most_accessible"),
  avoid_stairs: z.enum(["true", "false"]).optional(),
  prefer_ramps: z.enum(["true", "false"]).optional(),
  prefer_elevators: z.enum(["true", "false"]).optional(),
  max_slope: z.enum(["flat", "moderate", "steep", "any"]).optional(),
  max_walk_meters: z.coerce.number().int().min(0).max(50000).optional(),
});

export const reportTypeSchema = z.enum([
  "broken_elevator",
  "blocked_ramp",
  "stairs",
  "construction",
  "obstacle",
  "surface_issue",
  "other",
]);

export const reportBodySchema = z.object({
  type: reportTypeSchema,
  description: z.string().trim().min(3, "Description must be at least 3 characters").max(2000),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  photo: z.string().optional(),
  aiObservation: z
    .object({
      feature: z.string().min(1).max(120),
      confidence: z.number().min(0).max(1),
      modelVersion: z.string().min(1).max(120),
      allDetections: z
        .array(z.object({ label: z.string().min(1).max(120), score: z.number().min(0).max(1) }))
        .max(10)
        .optional(),
    })
    .optional(),
});

export const aiBodySchema = z.object({
  image: z.string().optional(),
  observation: z
    .object({
      feature: z.string().min(1).max(120),
      confidence: z.number().min(0).max(1),
      modelVersion: z.string().min(1).max(120),
      allDetections: z
        .array(z.object({ label: z.string().min(1).max(120), score: z.number().min(0).max(1) }))
        .max(10)
        .optional(),
    })
    .optional(),
});

export const profileBodySchema = z.object({
  mobilityProfile: mobilityProfileSchema,
  avoidStairs: z.boolean(),
  preferRamps: z.boolean(),
  preferElevators: z.boolean(),
  maxSlope: z.enum(["flat", "moderate", "steep", "any"]),
  preferSmoothSurface: z.boolean(),
  maxWalkDistanceMeters: z.number().int().min(0).max(50000),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(10).max(2000).default(100),
});

export type RoutesQuery = z.infer<typeof routesQuerySchema>;
export type ReportBody = z.infer<typeof reportBodySchema>;
export type AiBody = z.infer<typeof aiBodySchema>;
export type ProfileBody = z.infer<typeof profileBodySchema>;
export type MobilityProfileType = z.infer<typeof mobilityProfileSchema>;
export type RouteModeType = z.infer<typeof routeModeSchema>;
export type { MobilityProfile, RouteMode };