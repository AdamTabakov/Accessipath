"""Route building pipeline: candidates -> evidence -> scoring -> confidence -> sort.

Port of the TypeScript routing controller, including the two-tier cache
(scored results per origin/destination/profile, and final results per mode)."""

from typing import Optional

from ..config import settings
from ..schemas import (
    AccessibilityPoint,
    Coordinates,
    PenaltyEntry,
    ProfilePreferences,
    RouteMode,
    RouteResult,
)
from ..data.institutional_accessibility import INSTITUTIONAL_ACCESSIBILITY_POINTS
from ..services.confidence import compute_confidence
from ..services.osm import fetch_corridor_data, get_regional_accessibility
from ..services.routing import get_candidate_routes
from ..services.scoring import build_evidence, score_route
from ..services.store import DEFAULT_PROFILE, PROFILE_PRESETS, DataStore
from ..utils.ttl_cache import TtlCache

result_cache: TtlCache[str, dict] = TtlCache(ttl_ms=5 * 60_000)
scored_cache: TtlCache[str, dict] = TtlCache(ttl_ms=5 * 60_000)


def base_route_cache_key(
    start: Coordinates, end: Coordinates, profile: ProfilePreferences
) -> str:
    return repr(
        [
            round(start.latitude, 4),
            round(start.longitude, 4),
            round(end.latitude, 4),
            round(end.longitude, 4),
            profile.mobilityProfile,
            profile.avoidStairs,
            profile.preferRamps,
            profile.preferElevators,
            profile.maxSlope,
            profile.preferSmoothSurface,
            profile.maxWalkDistanceMeters,
        ]
    )


def result_cache_key(
    start: Coordinates, end: Coordinates, profile: ProfilePreferences, mode: RouteMode
) -> str:
    return f"{base_route_cache_key(start, end, profile)}|{mode}"


def institutional_points_near(start: Coordinates, end: Coordinates) -> list[AccessibilityPoint]:
    margin_deg = 0.006
    min_lat = min(start.latitude, end.latitude) - margin_deg
    max_lat = max(start.latitude, end.latitude) + margin_deg
    min_lon = min(start.longitude, end.longitude) - margin_deg
    max_lon = max(start.longitude, end.longitude) + margin_deg
    return [
        point
        for point in INSTITUTIONAL_ACCESSIBILITY_POINTS
        if min_lat <= point.latitude <= max_lat and min_lon <= point.longitude <= max_lon
    ]


def sort_key(mode: RouteMode, r: dict) -> float:
    accessibility_score = r["accessibilityScore"]
    data_confidence = r["dataConfidence"]
    distance_meters = r["distanceMeters"]
    duration_minutes = r["durationMinutes"]
    if mode == "most_accessible":
        return -(accessibility_score * 10000 + data_confidence - distance_meters / 10)
    if mode == "fastest":
        return duration_minutes * 60 + distance_meters / 50
    score_norm = accessibility_score / 100
    duration_norm = min(1, duration_minutes / 60)
    return (0.6 * score_norm - 0.4 * duration_norm) * -1


def route_summary(
    route_score: int,
    confidence: int,
    factors,
    penalties: list[PenaltyEntry],
    bonuses,
    profile: ProfilePreferences,
) -> str:
    profile_label = profile.mobilityProfile.replace("_", " ")
    critical = next((p for p in penalties if p.severity == "critical"), None)
    warning = next((p for p in penalties if p.severity == "warning"), None)
    top_bonus = bonuses[0] if bonuses else None

    if critical:
        lead = f"For a {profile_label} profile, this route has a major concern: {critical.label.lower()}."
    elif warning:
        lead = f"For a {profile_label} profile, this route is usable but has a caution: {warning.label.lower()}."
    elif top_bonus:
        lead = f"For a {profile_label} profile, this route looks favorable because it includes {top_bonus.label.lower()}."
    else:
        lead = f"For a {profile_label} profile, this route has no mapped accessibility blockers nearby."

    if factors.unknownSections > 0:
        coverage = (
            f" {factors.unknownSections} of {factors.totalSamples} sampled sections have unknown accessibility data,"
            " so confidence is limited."
        )
    else:
        coverage = " Accessibility data covers the sampled route sections."

    return f"{lead}{coverage} Score {route_score}/100, confidence {confidence}/100."


async def build_routes(
    start: Coordinates,
    end: Coordinates,
    profile: ProfilePreferences,
    mode: RouteMode,
    store: DataStore,
) -> dict:
    cache_key = result_cache_key(start, end, profile, mode)
    cached = result_cache.get(cache_key)
    if cached is not None:
        return cached

    scored_key = base_route_cache_key(start, end, profile)
    scored = scored_cache.get(scored_key)

    if scored is None:
        empty_data = {"points": [], "ways": []}
        if settings.is_test:
            corridor = empty_data
            city = empty_data
        else:
            try:
                corridor = await fetch_corridor_data(start, end)
            except Exception as error:  # noqa: BLE001
                print(f"[routing] OSM corridor fetch failed: {error}")
                corridor = empty_data
            city = get_regional_accessibility(start, end)

        candidates = await get_candidate_routes(start, end, corridor["ways"])
        store_points = await store.get_all_accessibility_points()
        institutional_points = institutional_points_near(start, end)

        merged = [*institutional_points, *city["points"], *corridor["points"], *store_points]
        seen: set[str] = set()
        points: list[AccessibilityPoint] = []
        for point in merged:
            if point.id not in seen:
                seen.add(point.id)
                points.append(point)

        results: list[dict] = []
        for route in candidates["routes"]:
            evidence_result = build_evidence(route, points, profile)
            route_score = score_route(route, evidence_result, profile)
            confidence_result = compute_confidence(
                evidence=evidence_result.evidence,
                factors=evidence_result.factors,
                provider=route.provider,
                profile=profile,
            )

            if (
                profile.maxWalkDistanceMeters > 0
                and route.distanceMeters > profile.maxWalkDistanceMeters
            ):
                route_score.penalties.append(
                    PenaltyEntry(
                        label="Longer than your preferred walking distance",
                        points=10,
                        severity="info",
                    )
                )
                route_score.score = max(0, route_score.score - 10)

            results.append(
                {
                    "id": route.id,
                    "mode": mode,
                    "provider": route.provider,
                    "aiSummary": route_summary(
                        route_score=route_score.score,
                        confidence=confidence_result.confidence,
                        factors=evidence_result.factors,
                        penalties=route_score.penalties,
                        bonuses=route_score.bonuses,
                        profile=profile,
                    ),
                    "distanceMeters": route.distanceMeters,
                    "durationMinutes": route.durationMinutes,
                    "accessibilityScore": route_score.score,
                    "dataConfidence": confidence_result.confidence,
                    "confidenceBreakdown": confidence_result.breakdown,
                    "factors": evidence_result.factors,
                    "penalties": route_score.penalties,
                    "bonuses": route_score.bonuses,
                    "evidence": evidence_result.evidence,
                    "unknownCoordinates": evidence_result.unknown_coordinates,
                    "geometry": route.geometry,
                }
            )

        warnings: list[str] = []
        if candidates.get("warning"):
            warnings.append(candidates["warning"])
        if any(r["dataConfidence"] < 50 for r in results):
            warnings.append(
                "Some route sections have little accessibility data. Unknown sections do not "
                "mean inaccessible - they mean we need more information."
            )
        if results and all(len(r["evidence"]) == 0 for r in results):
            warnings.append(
                "No accessibility features were found near these routes. Treat results as "
                "preliminary."
            )

        scored = {"results": results, "warnings": warnings}
        scored_cache.set(scored_key, scored)

    routes = sorted(
        [{**r, "mode": mode} for r in scored["results"]],
        key=lambda r: sort_key(mode, r),
    )
    result = {"routes": routes, "warnings": scored["warnings"]}
    result_cache.set(cache_key, result)
    return result


def profile_from_defaults(overrides: Optional[dict] = None) -> ProfilePreferences:
    profile_name = (overrides or {}).get("mobilityProfile") or DEFAULT_PROFILE.mobilityProfile
    base = PROFILE_PRESETS.get(profile_name, DEFAULT_PROFILE)
    merged = base.model_dump()
    if overrides:
        merged.update({k: v for k, v in overrides.items() if v is not None})
    return ProfilePreferences(**merged)


def invalidate_route_results() -> None:
    result_cache.clear()
    scored_cache.clear()
