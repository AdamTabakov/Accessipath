export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type AccessibilityStatus = "accessible" | "inaccessible" | "unknown";

export type MobilityProfile =
  | "wheelchair"
  | "walker"
  | "cane"
  | "limited_mobility"
  | "custom";

export type RouteMode = "fastest" | "balanced" | "most_accessible";

export type EvidenceSource = "institutional" | "osm" | "community" | "ai";

export type EvidenceType =
  | "entrance"
  | "ramp"
  | "elevator"
  | "stairs"
  | "crossing"
  | "automatic_door"
  | "barrier"
  | "obstacle"
  | "other";

export type ReportType =
  | "broken_elevator"
  | "blocked_ramp"
  | "stairs"
  | "construction"
  | "obstacle"
  | "surface_issue"
  | "other";

export type ReportStatus = "pending" | "verified" | "rejected" | "expired";

export interface AccessibilityPoint {
  id: string;
  buildingName?: string;
  type: EvidenceType;
  latitude: number;
  longitude: number;
  wheelchair?: AccessibilityStatus;
  ramp?: boolean;
  elevator?: boolean;
  stairs?: boolean;
  automaticDoor?: boolean;
  surface?: "smooth" | "rough" | "unknown";
  incline?: "flat" | "moderate" | "steep" | "unknown";
  sourceType: EvidenceSource;
  sourceUrl?: string;
  description?: string;
  confidence: number;
  verifiedAt?: string;
  isTemporary?: boolean;
  severity?: "info" | "warning" | "blocked";
  expiresAt?: string;
}

export interface EvidenceItem {
  id: string;
  label: string;
  type: EvidenceType;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  sourceType: EvidenceSource;
  status: AccessibilityStatus;
  severity: "info" | "warning" | "blocked";
  description?: string;
}

export interface RouteFactors {
  stairs: number;
  ramps: number;
  elevators: number;
  crossings: number;
  accessibleEntrances: number;
  obstacles: number;
  steepSlopes: number;
  roughSurface: number;
  unknownSections: number;
  totalSamples: number;
}

export interface ConfidenceBreakdown {
  sourceQuality: number;
  coverage: number;
  recency: number;
  verification: number;
  agreement: number;
}

export interface PenaltyEntry {
  label: string;
  points: number;
  severity: "info" | "warning" | "critical";
  detail?: string;
}

export interface BonusEntry {
  label: string;
  points: number;
}

export interface RouteResult {
  id: string;
  mode: RouteMode;
  provider: "osrm" | "demo";
  distanceMeters: number;
  durationMinutes: number;
  accessibilityScore: number;
  dataConfidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  factors: RouteFactors;
  penalties: PenaltyEntry[];
  bonuses: BonusEntry[];
  evidence: EvidenceItem[];
  unknownCoordinates: Coordinates[];
  geometry: Coordinates[];
}

export interface RoutesResponse {
  routes: RouteResult[];
  warnings: string[];
  profile: ProfilePreferences;
}

export interface ProfilePreferences {
  mobilityProfile: MobilityProfile;
  avoidStairs: boolean;
  preferRamps: boolean;
  preferElevators: boolean;
  maxSlope: "flat" | "moderate" | "steep" | "any";
  preferSmoothSurface: boolean;
  maxWalkDistanceMeters: number;
}

export interface AiDetection {
  label: string;
  score: number;
}

export interface AiObservation {
  reportId?: string;
  feature: string;
  confidence: number;
  modelVersion: string;
  createdAt: string;
  allDetections: AiDetection[];
}

export interface AccessibilityReport {
  id: string;
  type: ReportType;
  description: string;
  latitude: number;
  longitude: number;
  status: ReportStatus;
  photoUrl?: string;
  createdAt: string;
  expiresAt: string;
  aiObservation?: AiObservation;
}

export interface Building {
  id: string;
  name: string;
  shortName: string;
  address: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  sourceType: EvidenceSource;
  notes?: string;
}

export interface Place {
  id: string;
  label: string;
  description: string;
  latitude: number;
  longitude: number;
  buildingId?: string;
  source: "tmu" | "nominatim";
}

export interface AiAnalysisResult {
  detections: AiDetection[];
  feature: string;
  confidence: number;
  modelVersion: string;
  error?: string;
}

/** Accessibility preferences inferred from a natural-language route request. */
export interface AiRouteIntent {
  avoidStairs: boolean;
  preferRamps: boolean;
  preferElevators: boolean;
  preferSmoothSurface: boolean;
  maxSlope: "flat" | "moderate" | "steep" | "any";
  mode: RouteMode | null;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  createdAt: string;
}

export interface AuthUserResponse {
  token: string;
  user: SafeUser;
}

export interface SignupResponse {
  user: SafeUser;
  devCode?: string;
  message?: string;
}

export interface VerifyResponse {
  user: SafeUser;
}