"""Accessibility evidence attachment and explainable route scoring.

Port of the Node scoring service. Weights are centralised and configurable,
missing data is treated as unknown (never as a sign of accessibility)."""

import math

from ..schemas import (
    AccessibilityPoint,
    AccessibilityStatus,
    BonusEntry,
    Coordinates,
    EvidenceItem,
    PenaltyEntry,
    ProfilePreferences,
    RouteCandidate,
    RouteFactors,
)
from ..utils.spatial import (
    clamp,
    haversine_distance,
    point_to_polyline_distance_m,
    resample_polyline,
)

EVIDENCE_RADIUS_M = 45
COVERAGE_RADIUS_M = 60
SAMPLE_INTERVAL_M = 60

WEIGHTS = {
    "stairs": {
        "wheelchair": 25,
        "walker": 15,
        "cane": 12,
        "limited_mobility": 15,
        "custom": 18,
    },
    "steepSlope": 14,
    "roughSurface": 10,
    "obstacle": 22,
    "unknownSegment": 6,
    "unknownSegmentCap": 5,
    "distancePerKm": 5,
    "bonuses": {
        "accessibleEntrance": 8,
        "ramp": 6,
        "elevator": 6,
        "automaticDoor": 4,
        "smoothSurface": 4,
        "accessibleCrossing": 4,
        "accessibleFeature": 2,
    },
}

TYPE_LABELS = {
    "entrance": "Entrance",
    "ramp": "Ramp",
    "elevator": "Elevator",
    "stairs": "Steps",
    "crossing": "Crossing",
    "automatic_door": "Automatic door",
    "barrier": "Barrier",
    "obstacle": "Obstacle",
    "other": "Feature",
}


def type_label(type_: str) -> str:
    return TYPE_LABELS.get(type_, "Feature")


def point_label(point: AccessibilityPoint) -> str:
    base = type_label(point.type)
    return f"{base} · {point.buildingName}" if point.buildingName else base


def status_for_point(point: AccessibilityPoint, profile: ProfilePreferences) -> AccessibilityStatus:
    if point.severity == "blocked":
        return "inaccessible"
    if point.wheelchair and point.wheelchair != "unknown":
        return point.wheelchair
    if point.type == "stairs" or point.stairs:
        return "inaccessible" if profile.avoidStairs else "unknown"
    if point.ramp or point.elevator or point.automaticDoor:
        return "accessible"
    if point.surface == "rough":
        return "unknown"
    return "unknown"


class EvidenceResult:
    def __init__(self) -> None:
        self.evidence: list[EvidenceItem] = []
        self.factors: RouteFactors = RouteFactors()
        self.unknown_coordinates: list[Coordinates] = []
        self.total_samples = 0
        self.known_samples = 0


def build_evidence(
    route: RouteCandidate,
    points: list[AccessibilityPoint],
    profile: ProfilePreferences,
) -> EvidenceResult:
    result = EvidenceResult()

    min_lat = float("inf")
    max_lat = float("-inf")
    min_lon = float("inf")
    max_lon = float("-inf")
    for c in route.geometry:
        min_lat = min(min_lat, c.latitude)
        max_lat = max(max_lat, c.latitude)
        min_lon = min(min_lon, c.longitude)
        max_lon = max(max_lon, c.longitude)

    pad = EVIDENCE_RADIUS_M / 111000
    near_points = [
        p
        for p in points
        if min_lat - pad <= p.latitude <= max_lat + pad
        and min_lon - pad <= p.longitude <= max_lon + pad
    ]

    factors = result.factors
    for point in near_points:
        distance = point_to_polyline_distance_m(
            Coordinates(latitude=point.latitude, longitude=point.longitude),
            route.geometry,
        )
        if distance > EVIDENCE_RADIUS_M:
            continue

        is_stairs = point.type == "stairs" or point.stairs is True
        is_ramp = point.type == "ramp" or point.ramp is True
        is_elevator = point.type == "elevator" or point.elevator is True
        is_crossing = point.type == "crossing"
        is_entrance = point.type == "entrance"
        is_obstacle = (
            point.severity == "blocked"
            or (point.type == "obstacle" and point.isTemporary is True)
        )

        if is_stairs:
            factors.stairs += 1
        if is_ramp:
            factors.ramps += 1
        if is_elevator:
            factors.elevators += 1
        if is_crossing:
            factors.crossings += 1
        if is_entrance and point.wheelchair == "accessible":
            factors.accessibleEntrances += 1
        if is_obstacle:
            factors.obstacles += 1
        if point.incline == "steep":
            factors.steepSlopes += 1
        if point.surface == "rough":
            factors.roughSurface += 1

        status = status_for_point(point, profile)
        severity = point.severity or "info"
        verified = bool(point.verifiedAt) if point.sourceType == "community" else None
        result.evidence.append(
            EvidenceItem(
                id=point.id,
                label=point_label(point),
                type=point.type,
                latitude=point.latitude,
                longitude=point.longitude,
                distanceMeters=round(distance),
                sourceType=point.sourceType,
                status=status,
                severity=severity,
                description=point.description,
                photoUrl=point.photoUrl,
                verified=verified,
            )
        )

    cell_size_deg = COVERAGE_RADIUS_M / 111000
    grid: dict[tuple[int, int], list[AccessibilityPoint]] = {}
    for point in near_points:
        key = (math.floor(point.latitude / cell_size_deg), math.floor(point.longitude / cell_size_deg))
        grid.setdefault(key, []).append(point)

    samples = resample_polyline(route.geometry, SAMPLE_INTERVAL_M)
    unknown_coordinates: list[Coordinates] = []
    known_samples = 0
    lat_range = math.ceil((COVERAGE_RADIUS_M / 111000) / cell_size_deg)
    for sample in samples:
        cx = math.floor(sample.latitude / cell_size_deg)
        cy = math.floor(sample.longitude / cell_size_deg)
        lon_range = math.ceil(
            (COVERAGE_RADIUS_M / (111000 * math.cos(sample.latitude * math.pi / 180)))
            / cell_size_deg
        )
        known = False
        for dx in range(-lat_range, lat_range + 1):
            if known:
                break
            for dy in range(-lon_range, lon_range + 1):
                if known:
                    break
                bucket = grid.get((cx + dx, cy + dy))
                if not bucket:
                    continue
                for point in bucket:
                    if haversine_distance(sample, point) <= COVERAGE_RADIUS_M:
                        known = True
                        break
        if known:
            known_samples += 1
        else:
            unknown_coordinates.append(sample)

    factors.unknownSections = len(samples) - known_samples
    factors.totalSamples = len(samples)

    result.unknown_coordinates = unknown_coordinates
    result.total_samples = len(samples)
    result.known_samples = known_samples
    return result


class ScoreResult:
    def __init__(self, score: int, penalties: list[PenaltyEntry], bonuses: list[BonusEntry]):
        self.score = score
        self.penalties = penalties
        self.bonuses = bonuses


def score_route(
    route: RouteCandidate,
    evidence_result: EvidenceResult,
    profile: ProfilePreferences,
) -> ScoreResult:
    evidence = evidence_result.evidence
    factors = evidence_result.factors
    penalties: list[PenaltyEntry] = []
    bonuses: list[BonusEntry] = []

    base_stairs_weight = (
        WEIGHTS["stairs"]["custom"]
        if profile.mobilityProfile == "custom" and profile.avoidStairs
        else WEIGHTS["stairs"].get(profile.mobilityProfile, WEIGHTS["stairs"]["walker"])
    )
    stairs_weight = (
        base_stairs_weight if profile.avoidStairs else max(3, round(base_stairs_weight * 0.4))
    )

    stair_items = [item for item in evidence if item.type == "stairs"]
    if stair_items:
        label = (
            f"{len(stair_items)} step section"
            if len(stair_items) == 1
            else f"{len(stair_items)} step sections"
        )
        penalties.append(
            PenaltyEntry(
                label=label,
                points=stairs_weight * min(len(stair_items), 2),
                severity="critical" if profile.mobilityProfile == "wheelchair" else "warning",
                detail=stair_items[0].description,
            )
        )

    blocked_items = [item for item in evidence if item.severity == "blocked"]
    if blocked_items:
        label = (
            f"{len(blocked_items)} blocked feature"
            if len(blocked_items) == 1
            else f"{len(blocked_items)} blocked features"
        )
        penalties.append(
            PenaltyEntry(
                label=label,
                points=WEIGHTS["obstacle"] * min(len(blocked_items), 2),
                severity="critical",
                detail=blocked_items[0].description,
            )
        )

    obstacle_warnings = [
        item for item in evidence if item.type == "obstacle" and item.severity == "warning"
    ]
    if obstacle_warnings:
        label = (
            f"{len(obstacle_warnings)} obstacle to work around"
            if len(obstacle_warnings) == 1
            else f"{len(obstacle_warnings)} obstacles to work around"
        )
        penalties.append(
            PenaltyEntry(
                label=label,
                points=WEIGHTS["roughSurface"] * min(len(obstacle_warnings), 2),
                severity="warning",
                detail=obstacle_warnings[0].description,
            )
        )

    slope_weight = {
        "flat": WEIGHTS["steepSlope"],
        "moderate": WEIGHTS["steepSlope"],
        "steep": 4,
        "any": 0,
    }.get(profile.maxSlope, WEIGHTS["steepSlope"])
    if factors.steepSlopes > 0 and slope_weight > 0:
        label = (
            f"{factors.steepSlopes} steep slope"
            if factors.steepSlopes == 1
            else f"{factors.steepSlopes} steep slopes"
        )
        penalties.append(
            PenaltyEntry(
                label=label,
                points=slope_weight * min(factors.steepSlopes, 2),
                severity="warning",
            )
        )
    rough_weight = WEIGHTS["roughSurface"] if profile.preferSmoothSurface else 3
    if factors.roughSurface > 0 and rough_weight > 0:
        label = (
            f"{factors.roughSurface} rough surface section"
            if factors.roughSurface == 1
            else f"{factors.roughSurface} rough surface sections"
        )
        penalties.append(
            PenaltyEntry(
                label=label,
                points=rough_weight * min(factors.roughSurface, 2),
                severity="warning",
            )
        )
    if factors.unknownSections > 0:
        label = (
            f"{factors.unknownSections} route section without accessibility data"
            if factors.unknownSections == 1
            else f"{factors.unknownSections} route sections without accessibility data"
        )
        penalties.append(
            PenaltyEntry(
                label=label,
                points=WEIGHTS["unknownSegment"]
                * min(factors.unknownSections, WEIGHTS["unknownSegmentCap"]),
                severity="info",
                detail="Unknown is not 'inaccessible' - it just means we lack data here.",
            )
        )

    ramp_bonus = WEIGHTS["bonuses"]["ramp"] if profile.preferRamps else 3
    elevator_bonus = WEIGHTS["bonuses"]["elevator"] if profile.preferElevators else 3

    def count_of(pred) -> int:
        return sum(1 for item in evidence if pred(item))

    entrance_count = count_of(lambda i: i.type == "entrance" and i.status == "accessible")
    ramp_count = count_of(lambda i: i.type == "ramp")
    elevator_count = count_of(lambda i: i.type == "elevator" and i.severity != "blocked")
    door_count = count_of(lambda i: i.type == "automatic_door")
    crossing_count = count_of(lambda i: i.type == "crossing" and i.status == "accessible")

    if entrance_count > 0:
        bonuses.append(
            BonusEntry(
                label=(
                    f"{entrance_count} accessible entrance"
                    if entrance_count == 1
                    else f"{entrance_count} accessible entrances"
                ),
                points=WEIGHTS["bonuses"]["accessibleEntrance"] * min(entrance_count, 2),
            )
        )
    if ramp_count > 0:
        bonuses.append(
            BonusEntry(
                label=f"{ramp_count} ramp" if ramp_count == 1 else f"{ramp_count} ramps",
                points=ramp_bonus * min(ramp_count, 2),
            )
        )
    if elevator_count > 0:
        bonuses.append(
            BonusEntry(
                label=f"{elevator_count} elevator"
                if elevator_count == 1
                else f"{elevator_count} elevators",
                points=elevator_bonus * min(elevator_count, 2),
            )
        )
    if door_count > 0:
        bonuses.append(
            BonusEntry(
                label=f"{door_count} automatic door"
                if door_count == 1
                else f"{door_count} automatic doors",
                points=WEIGHTS["bonuses"]["automaticDoor"] * min(door_count, 2),
            )
        )
    if crossing_count > 0:
        bonuses.append(
            BonusEntry(
                label=f"{crossing_count} accessible crossing"
                if crossing_count == 1
                else f"{crossing_count} accessible crossings",
                points=WEIGHTS["bonuses"]["accessibleCrossing"] * min(crossing_count, 3),
            )
        )

    km = route.distanceMeters / 1000
    distance_penalty = round(WEIGHTS["distancePerKm"] * km * 10) / 10
    if distance_penalty > 0:
        penalties.append(
            PenaltyEntry(
                label=f"Distance ({route.distanceMeters} m)",
                points=distance_penalty,
                severity="info",
            )
        )

    sum_penalties = sum(p.points for p in penalties)
    sum_bonuses = sum(b.points for b in bonuses)
    score = clamp(round(100 - sum_penalties + min(sum_bonuses, 30)), 0, 100)

    return ScoreResult(score=int(score), penalties=penalties, bonuses=bonuses)
