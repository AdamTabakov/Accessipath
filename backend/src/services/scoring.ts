import type {
  AccessibilityPoint,
  AccessibilityStatus,
  BonusEntry,
  Coordinates,
  EvidenceItem,
  PenaltyEntry,
  ProfilePreferences,
  RouteCandidate,
  RouteFactors,
} from "../types/index.js";
import {
  clamp,
  haversineDistance,
  pointToPolylineDistanceM,
  resamplePolyline,
} from "../utils/spatial.js";

/** Accessibility features further than this from the route line are not attached. */
export const EVIDENCE_RADIUS_M = 30;

/** A sampled route point is "known" when accessibility data exists within this radius. */
export const COVERAGE_RADIUS_M = 60;

/** Distance between samples used to estimate unknown coverage. */
export const SAMPLE_INTERVAL_M = 60;

/** Configurable, transparent scoring weights. */
export const WEIGHTS = {
  stairs: {
    wheelchair: 40,
    walker: 26,
    cane: 20,
    limited_mobility: 26,
    custom: 30,
  },
  steepSlope: 22,
  roughSurface: 14,
  obstacle: 34,
  unknownSegment: 6,
  unknownSegmentCap: 5,
  distancePerKm: 2.5,
  bonuses: {
    accessibleEntrance: 8,
    ramp: 6,
    elevator: 6,
    automaticDoor: 4,
    smoothSurface: 4,
    accessibleCrossing: 4,
    accessibleFeature: 2,
  },
} as const;

const TYPE_LABELS: Record<string, string> = {
  entrance: "Entrance",
  ramp: "Ramp",
  elevator: "Elevator",
  stairs: "Steps",
  crossing: "Crossing",
  automatic_door: "Automatic door",
  barrier: "Barrier",
  obstacle: "Obstacle",
  other: "Feature",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? "Feature";
}

function pointLabel(point: AccessibilityPoint): string {
  const base = typeLabel(point.type);
  return point.buildingName ? `${base} · ${point.buildingName}` : base;
}

/** Determine the accessibility status of a point for a given profile. */
export function statusForPoint(
  point: AccessibilityPoint,
  profile: ProfilePreferences,
): AccessibilityStatus {
  if (point.severity === "blocked") return "inaccessible";
  if (point.wheelchair && point.wheelchair !== "unknown") return point.wheelchair;
  if (point.type === "stairs" || point.stairs) {
    return profile.avoidStairs ? "inaccessible" : "unknown";
  }
  if (point.ramp || point.elevator || point.automaticDoor) return "accessible";
  if (point.surface === "rough") return "unknown";
  return "unknown";
}

export interface EvidenceResult {
  evidence: EvidenceItem[];
  factors: RouteFactors;
  unknownCoordinates: Coordinates[];
  totalSamples: number;
  knownSamples: number;
}

/**
 * Attach accessibility evidence to a route using proximity matching,
 * and sample the route to estimate how much of it is "known".
 */
export function buildEvidence(
  route: RouteCandidate,
  points: AccessibilityPoint[],
  profile: ProfilePreferences,
): EvidenceResult {
  const evidence: EvidenceItem[] = [];
  const factors: RouteFactors = {
    stairs: 0,
    ramps: 0,
    elevators: 0,
    crossings: 0,
    accessibleEntrances: 0,
    obstacles: 0,
    steepSlopes: 0,
    roughSurface: 0,
    unknownSections: 0,
    totalSamples: 0,
  };

  for (const point of points) {
    const distance = pointToPolylineDistanceM(
      { latitude: point.latitude, longitude: point.longitude },
      route.geometry,
    );
    if (distance > EVIDENCE_RADIUS_M) continue;

    const isStairs = point.type === "stairs" || point.stairs === true;
    const isRamp = point.type === "ramp" || point.ramp === true;
    const isElevator = point.type === "elevator" || point.elevator === true;
    const isCrossing = point.type === "crossing";
    const isEntrance = point.type === "entrance";
    const isObstacle =
      point.severity === "blocked" ||
      (point.type === "obstacle" && point.isTemporary === true);

    if (isStairs) factors.stairs += 1;
    if (isRamp) factors.ramps += 1;
    if (isElevator) factors.elevators += 1;
    if (isCrossing) factors.crossings += 1;
    if (isEntrance && point.wheelchair === "accessible") factors.accessibleEntrances += 1;
    if (isObstacle) factors.obstacles += 1;
    if (point.incline === "steep") factors.steepSlopes += 1;
    if (point.surface === "rough") factors.roughSurface += 1;

    const status = statusForPoint(point, profile);
    const severity = point.severity ?? "info";
    evidence.push({
      id: point.id,
      label: pointLabel(point),
      type: point.type,
      latitude: point.latitude,
      longitude: point.longitude,
      distanceMeters: Math.round(distance),
      sourceType: point.sourceType,
      status,
      severity,
      description: point.description,
    });
  }

  const samples = resamplePolyline(route.geometry, SAMPLE_INTERVAL_M);
  let unknownCoordinates: Coordinates[] = [];
  let knownSamples = 0;
  for (const sample of samples) {
    let minDistance = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const d = haversineDistance(sample, {
        latitude: point.latitude,
        longitude: point.longitude,
      });
      if (d < minDistance) minDistance = d;
    }
    if (minDistance <= COVERAGE_RADIUS_M) {
      knownSamples += 1;
    } else {
      unknownCoordinates.push(sample);
    }
  }
  factors.unknownSections = samples.length - knownSamples;
  factors.totalSamples = samples.length;

  return { evidence, factors, unknownCoordinates, totalSamples: samples.length, knownSamples };
}

export interface ScoreResult {
  score: number;
  penalties: PenaltyEntry[];
  bonuses: BonusEntry[];
}

/** Compute the explainable 0-100 accessibility score for a route. */
export function scoreRoute(
  route: RouteCandidate,
  evidenceResult: EvidenceResult,
  profile: ProfilePreferences,
): ScoreResult {
  const { evidence, factors } = evidenceResult;
  const penalties: PenaltyEntry[] = [];
  const bonuses: BonusEntry[] = [];

  const stairsWeight =
    profile.mobilityProfile === "custom" && profile.avoidStairs
      ? WEIGHTS.stairs.custom
      : WEIGHTS.stairs[profile.mobilityProfile] ?? WEIGHTS.stairs.walker;

  for (const item of evidence) {
    if (item.type === "stairs") {
      penalties.push({
        label: item.label,
        points: stairsWeight,
        severity: profile.mobilityProfile === "wheelchair" ? "critical" : "warning",
        detail: item.description,
      });
    }
    if (item.severity === "blocked") {
      penalties.push({
        label: `${item.label} - temporarily blocked`,
        points: WEIGHTS.obstacle,
        severity: "critical",
        detail: item.description,
      });
    }
    if (item.type === "obstacle" && item.severity === "warning") {
      penalties.push({
        label: item.label,
        points: WEIGHTS.roughSurface,
        severity: "warning",
        detail: item.description,
      });
    }
  }

  if (factors.steepSlopes > 0) {
    penalties.push({
      label: `${factors.steepSlopes} steep slope${factors.steepSlopes > 1 ? "s" : ""}`,
      points: WEIGHTS.steepSlope * Math.min(factors.steepSlopes, 2),
      severity: "warning",
    });
  }
  if (factors.roughSurface > 0) {
    penalties.push({
      label: `${factors.roughSurface} rough surface section${factors.roughSurface > 1 ? "s" : ""}`,
      points: WEIGHTS.roughSurface * Math.min(factors.roughSurface, 2),
      severity: "warning",
    });
  }
  if (factors.unknownSections > 0) {
    penalties.push({
      label: `${factors.unknownSections} route section${factors.unknownSections > 1 ? "s" : ""} without accessibility data`,
      points:
        WEIGHTS.unknownSegment * Math.min(factors.unknownSections, WEIGHTS.unknownSegmentCap),
      severity: "info",
      detail: "Unknown is not 'inaccessible' - it just means we lack data here.",
    });
  }

  const rampBonus = profile.preferRamps ? WEIGHTS.bonuses.ramp : 3;
  const elevatorBonus = profile.preferElevators ? WEIGHTS.bonuses.elevator : 3;

  for (const item of evidence) {
    if (item.type === "entrance" && item.status === "accessible") {
      bonuses.push({ label: item.label, points: WEIGHTS.bonuses.accessibleEntrance });
    }
    if (item.type === "ramp") bonuses.push({ label: item.label, points: rampBonus });
    if (item.type === "elevator" && item.severity !== "blocked") {
      bonuses.push({ label: item.label, points: elevatorBonus });
    }
    if (item.type === "automatic_door") {
      bonuses.push({ label: item.label, points: WEIGHTS.bonuses.automaticDoor });
    }
    if (item.type === "crossing" && item.status === "accessible") {
      bonuses.push({ label: item.label, points: WEIGHTS.bonuses.accessibleCrossing });
    }
  }

  const km = route.distanceMeters / 1000;
  const distancePenalty = Math.round(WEIGHTS.distancePerKm * km * 10) / 10;
  if (distancePenalty > 0) {
    penalties.push({
      label: `Distance (${route.distanceMeters} m)`,
      points: distancePenalty,
      severity: "info",
    });
  }

  const sumPenalties = penalties.reduce((sum, p) => sum + p.points, 0);
  const sumBonuses = bonuses.reduce((sum, b) => sum + b.points, 0);
  const score = clamp(Math.round(100 - sumPenalties + sumBonuses), 0, 100);

  return { score, penalties, bonuses };
}