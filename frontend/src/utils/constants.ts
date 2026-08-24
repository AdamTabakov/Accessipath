import type {
  Coordinates,
  EvidenceSource,
  MobilityProfile,
  ProfilePreferences,
  ReportType,
  RouteMode,
} from "../types/index.js";

export const TORONTO_CENTER: Coordinates = { latitude: 43.6532, longitude: -79.3832 };

export const SLC: Coordinates = { latitude: 43.6577, longitude: -79.3802 };
export const ENG: Coordinates = { latitude: 43.658112, longitude: -79.377632 };

export const DEFAULT_PROFILE: ProfilePreferences = {
  mobilityProfile: "wheelchair",
  avoidStairs: true,
  preferRamps: true,
  preferElevators: true,
  maxSlope: "moderate",
  preferSmoothSurface: true,
  maxWalkDistanceMeters: 2000,
};

export const PROFILE_PRESETS: Record<MobilityProfile, ProfilePreferences> = {
  wheelchair: { ...DEFAULT_PROFILE },
  walker: {
    mobilityProfile: "walker",
    avoidStairs: true,
    preferRamps: true,
    preferElevators: false,
    maxSlope: "moderate",
    preferSmoothSurface: true,
    maxWalkDistanceMeters: 1800,
  },
  cane: {
    mobilityProfile: "cane",
    avoidStairs: true,
    preferRamps: false,
    preferElevators: false,
    maxSlope: "moderate",
    preferSmoothSurface: true,
    maxWalkDistanceMeters: 2200,
  },
  limited_mobility: {
    mobilityProfile: "limited_mobility",
    avoidStairs: true,
    preferRamps: true,
    preferElevators: true,
    maxSlope: "flat",
    preferSmoothSurface: true,
    maxWalkDistanceMeters: 1200,
  },
  custom: {
    ...DEFAULT_PROFILE,
    mobilityProfile: "custom",
  },
};

export const MODES: { value: RouteMode; label: string; hint: string }[] = [
  { value: "most_accessible", label: "Most accessible", hint: "Prioritize usability" },
  { value: "balanced", label: "Balanced", hint: "Usability + distance" },
  { value: "fastest", label: "Fastest", hint: "Shortest time" },
];

export const PROFILE_LABELS: Record<MobilityProfile, { label: string; hint: string }> = {
  wheelchair: { label: "Wheelchair", hint: "Avoid stairs & steep slopes" },
  walker: { label: "Walker", hint: "Fewer obstacles, easier terrain" },
  cane: { label: "Cane", hint: "Avoid uneven surfaces & steps" },
  limited_mobility: { label: "Limited mobility", hint: "Ramps & elevators first" },
  custom: { label: "Custom", hint: "Your own preferences" },
};

export const SOURCE_LABELS: Record<EvidenceSource, string> = {
  institutional: "Institution",
  osm: "OpenStreetMap",
  community: "Community",
  ai: "AI analysis",
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  broken_elevator: "Broken elevator",
  blocked_ramp: "Blocked ramp",
  stairs: "Steps appeared / stairs",
  construction: "Construction",
  obstacle: "Obstacle",
  surface_issue: "Surface issue",
  other: "Other",
};

export const MAX_REPORT_PHOTO_MB = 8;
export const MAX_REPORT_DESCRIPTION = 2000;
