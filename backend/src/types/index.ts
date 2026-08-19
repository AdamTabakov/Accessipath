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

export type VoteDirection = "up" | "down";

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
  photoUrl?: string;
}

export interface RouteCandidate {
  id: string;
  provider: "osrm" | "demo";
  distanceMeters: number;
  durationMinutes: number;
  geometry: Coordinates[];
}

export interface RecentRoute {
  id: string;
  startLabel: string;
  startLatitude: number;
  startLongitude: number;
  endLabel: string;
  endLatitude: number;
  endLongitude: number;
  mode: RouteMode;
  createdAt: string;
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
  photoUrl?: string;
  verified?: boolean;
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
  upvotes: number;
  downvotes: number;
  myVote?: VoteDirection | null;
  verifiedAt?: string;
  photoUrl?: string;
  createdAt: string;
  expiresAt: string;
  aiObservation?: AiObservation;
}

export interface Place {
  id: string;
  label: string;
  description: string;
  latitude: number;
  longitude: number;
  buildingId?: string;
  source: "curated" | "nominatim";
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  verifiedAt?: string;
  verificationCodeHash?: string;
  verificationExpiresAt?: string;
  createdAt: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  createdAt: string;
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    verified: Boolean(user.verifiedAt),
    createdAt: user.createdAt,
  };
}