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
    wheelchair: 25,
    walker: 15,
    cane: 12,
    limited_mobility: 15,
    custom: 18,
  },
  steepSlope: 14,
  roughSurface: 10,
  obstacle: 22,
  unknownSegment: 6,
  unknownSegmentCap: 5,
  distancePerKm: 5,
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

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  for (const c of route.geometry) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLon) minLon = c.longitude;
    if (c.longitude > maxLon) maxLon = c.longitude;
  }
  const pad = EVIDENCE_RADIUS_M / 111000;
  const nearPoints = points.filter(
    (p) =>
      p.latitude >= minLat - pad &&
      p.latitude <= maxLat + pad &&
      p.longitude >= minLon - pad &&
      p.longitude <= maxLon + pad,
  );

  for (const point of nearPoints) {
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
      photoUrl: point.photoUrl,
      verified: point.sourceType === "community" ? Boolean(point.verifiedAt) : undefined,
    });
  }

  // Bucket nearby points into a uniform grid so coverage lookup is near O(1)
  // instead of scanning every point for every sample.
  const cellSizeDeg = COVERAGE_RADIUS_M / 111000;
  const grid = new Map<string, AccessibilityPoint[]>();
  for (const point of nearPoints) {
    const key = `${Math.floor(point.latitude / cellSizeDeg)},${Math.floor(
      point.longitude / cellSizeDeg,
    )}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(point);
    else grid.set(key, [point]);
  }

  const samples = resamplePolyline(route.geometry, SAMPLE_INTERVAL_M);
  let unknownCoordinates: Coordinates[] = [];
  let knownSamples = 0;
  const latRange = Math.ceil((COVERAGE_RADIUS_M / 111000) / cellSizeDeg);
  for (const sample of samples) {
    const cx = Math.floor(sample.latitude / cellSizeDeg);
    const cy = Math.floor(sample.longitude / cellSizeDeg);
    // Longitude degrees-per-metre shrink with cos(latitude), so widen the
    // search radius in the longitude axis to guarantee no in-range point is
    // missed (exact same result as the old all-points scan).
    const lonRange = Math.ceil(
      (COVERAGE_RADIUS_M / (111000 * Math.cos((sample.latitude * Math.PI) / 180))) /
        cellSizeDeg,
    );
    let known = false;
    for (let dx = -latRange; dx <= latRange && !known; dx++) {
      for (let dy = -lonRange; dy <= lonRange && !known; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const point of bucket) {
          if (haversineDistance(sample, point) <= COVERAGE_RADIUS_M) {
            known = true;
            break;
          }
        }
      }
    }
    if (known) knownSamples += 1;
    else unknownCoordinates.push(sample);
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

  // Penalties are aggregated by category and capped so a handful of bad
  // features can't drive every downtown route straight to 0 (and vice versa).
  const stairItems = evidence.filter((item) => item.type === "stairs");
  if (stairItems.length > 0) {
    penalties.push({
      label: `${stairItems.length} step section${stairItems.length > 1 ? "s" : ""}`,
      points: stairsWeight * Math.min(stairItems.length, 2),
      severity: profile.mobilityProfile === "wheelchair" ? "critical" : "warning",
      detail: stairItems[0]?.description,
    });
  }

  const blockedItems = evidence.filter((item) => item.severity === "blocked");
  if (blockedItems.length > 0) {
    penalties.push({
      label: `${blockedItems.length} blocked feature${blockedItems.length > 1 ? "s" : ""}`,
      points: WEIGHTS.obstacle * Math.min(blockedItems.length, 2),
      severity: "critical",
      detail: blockedItems[0]?.description,
    });
  }

  const obstacleWarnings = evidence.filter(
    (item) => item.type === "obstacle" && item.severity === "warning",
  );
  if (obstacleWarnings.length > 0) {
    penalties.push({
      label: `${obstacleWarnings.length} obstacle${obstacleWarnings.length > 1 ? "s" : ""} to work around`,
      points: WEIGHTS.roughSurface * Math.min(obstacleWarnings.length, 2),
      severity: "warning",
      detail: obstacleWarnings[0]?.description,
    });
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

  const countOf = (pred: (item: EvidenceItem) => boolean) => evidence.filter(pred).length;
  const entranceCount = countOf((i) => i.type === "entrance" && i.status === "accessible");
  const rampCount = countOf((i) => i.type === "ramp");
  const elevatorCount = countOf((i) => i.type === "elevator" && i.severity !== "blocked");
  const doorCount = countOf((i) => i.type === "automatic_door");
  const crossingCount = countOf((i) => i.type === "crossing" && i.status === "accessible");

  if (entranceCount > 0) {
    bonuses.push({
      label: `${entranceCount} accessible entrance${entranceCount > 1 ? "s" : ""}`,
      points: WEIGHTS.bonuses.accessibleEntrance * Math.min(entranceCount, 2),
    });
  }
  if (rampCount > 0) {
    bonuses.push({
      label: `${rampCount} ramp${rampCount > 1 ? "s" : ""}`,
      points: rampBonus * Math.min(rampCount, 2),
    });
  }
  if (elevatorCount > 0) {
    bonuses.push({
      label: `${elevatorCount} elevator${elevatorCount > 1 ? "s" : ""}`,
      points: elevatorBonus * Math.min(elevatorCount, 2),
    });
  }
  if (doorCount > 0) {
    bonuses.push({
      label: `${doorCount} automatic door${doorCount > 1 ? "s" : ""}`,
      points: WEIGHTS.bonuses.automaticDoor * Math.min(doorCount, 2),
    });
  }
  if (crossingCount > 0) {
    bonuses.push({
      label: `${crossingCount} accessible crossing${crossingCount > 1 ? "s" : ""}`,
      points: WEIGHTS.bonuses.accessibleCrossing * Math.min(crossingCount, 3),
    });
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
  const score = clamp(
    Math.round(100 - sumPenalties + Math.min(sumBonuses, 30)),
    0,
    100,
  );

  return { score, penalties, bonuses };
}