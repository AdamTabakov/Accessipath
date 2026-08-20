"""Port of the Node scoring tests."""

from app.schemas import AccessibilityPoint, RouteCandidate
from app.services.scoring import WEIGHTS, build_evidence, score_route
from app.services.store import DEFAULT_PROFILE
from app.utils.spatial import point_to_polyline_distance_m

STAIRS = AccessibilityPoint(
    id="test-stairs",
    type="stairs",
    latitude=43.6579,
    longitude=-79.37835,
    stairs=True,
    wheelchair="inaccessible",
    sourceType="osm",
    confidence=0.7,
)

RAMP = AccessibilityPoint(
    id="test-ramp",
    type="ramp",
    latitude=43.65752,
    longitude=-79.37825,
    ramp=True,
    sourceType="institutional",
    confidence=0.9,
)

ELEVATOR = AccessibilityPoint(
    id="test-elevator",
    type="elevator",
    latitude=43.65808,
    longitude=-79.37768,
    elevator=True,
    sourceType="institutional",
    confidence=0.9,
)

STEEP = AccessibilityPoint(
    id="test-steep",
    type="other",
    latitude=43.6576,
    longitude=-79.3784,
    incline="steep",
    sourceType="osm",
    confidence=0.7,
)

ROUGH = AccessibilityPoint(
    id="test-rough",
    type="other",
    latitude=43.6574,
    longitude=-79.3783,
    surface="rough",
    sourceType="osm",
    confidence=0.7,
)


def route_through(point: AccessibilityPoint) -> RouteCandidate:
    geometry = [
        {"latitude": point.latitude - 0.0002, "longitude": point.longitude},
        {"latitude": point.latitude + 0.0002, "longitude": point.longitude},
    ]
    return RouteCandidate(
        id="route-test",
        provider="demo",
        geometry=geometry,
        distanceMeters=50,
        durationMinutes=2,
    )


def wheelchair_profile():
    return DEFAULT_PROFILE.model_copy(update={"mobilityProfile": "wheelchair"})


class TestScoring:
    def test_penalizes_stairs_heavily_for_wheelchair(self):
        profile = wheelchair_profile()
        route = route_through(STAIRS)
        evidence = build_evidence(route, [STAIRS], profile)
        scored = score_route(route, evidence, profile)
        assert any("step section" in p.label for p in scored.penalties)
        assert scored.score < 90
        assert scored.score >= 0

    def test_rewards_ramps_and_elevators_for_wheelchair(self):
        profile = wheelchair_profile()
        route = route_through(RAMP)
        evidence = build_evidence(route, [RAMP, ELEVATOR], profile)
        scored = score_route(route, evidence, profile)
        assert any("ramp" in b.label for b in scored.bonuses)
        assert scored.score > 60
        assert scored.score <= 100

    def test_ranks_stairs_below_ramp_route_for_wheelchair(self):
        profile = wheelchair_profile()
        stairs_route = route_through(STAIRS)
        accessible_route = route_through(RAMP)
        stairs_score = score_route(
            stairs_route, build_evidence(stairs_route, [STAIRS], profile), profile
        )
        accessible_score = score_route(
            accessible_route,
            build_evidence(accessible_route, [RAMP, ELEVATOR], profile),
            profile,
        )
        assert accessible_score.score > stairs_score.score

    def test_wheelchair_stairs_weight_exceeds_walker(self):
        assert WEIGHTS["stairs"]["wheelchair"] > WEIGHTS["stairs"]["walker"]

    def test_clamps_score_to_0_100(self):
        points = [STAIRS, STAIRS.model_copy(update={"id": "s2"}), STAIRS.model_copy(update={"id": "s3"})]
        profile = wheelchair_profile()
        route = route_through(STAIRS)
        scored = score_route(route, build_evidence(route, points, profile), profile)
        assert 0 <= scored.score <= 100

    def test_attaches_evidence_only_within_radius(self):
        far_point = AccessibilityPoint(
            id="far",
            type="elevator",
            latitude=43.6589,
            longitude=-79.378,
            elevator=True,
            sourceType="institutional",
            confidence=0.9,
        )
        route = route_through(STAIRS)
        distance = point_to_polyline_distance_m(far_point, route.geometry)
        assert distance > 45
        evidence = build_evidence(route, [STAIRS, far_point], DEFAULT_PROFILE)
        assert all(e.id != "far" for e in evidence.evidence)

    def test_max_slope_reduces_steep_slope_penalty(self):
        route = route_through(STEEP)
        flat = DEFAULT_PROFILE.model_copy(update={"maxSlope": "flat"})
        any_slope = DEFAULT_PROFILE.model_copy(update={"maxSlope": "any"})
        flat_scored = score_route(route, build_evidence(route, [STEEP], flat), flat)
        any_scored = score_route(route, build_evidence(route, [STEEP], any_slope), any_slope)
        assert any("steep slope" in p.label for p in flat_scored.penalties)
        assert not any("steep slope" in p.label for p in any_scored.penalties)
        assert any_scored.score > flat_scored.score

    def test_prefer_smooth_surface_reduces_rough_surface_penalty(self):
        route = route_through(ROUGH)
        smooth = DEFAULT_PROFILE.model_copy(update={"preferSmoothSurface": True})
        relaxed = DEFAULT_PROFILE.model_copy(update={"preferSmoothSurface": False})
        smooth_scored = score_route(route, build_evidence(route, [ROUGH], smooth), smooth)
        relaxed_scored = score_route(route, build_evidence(route, [ROUGH], relaxed), relaxed)
        smooth_penalty = next(p.points for p in smooth_scored.penalties if "rough surface" in p.label)
        relaxed_penalty = next(p.points for p in relaxed_scored.penalties if "rough surface" in p.label)
        assert smooth_penalty > relaxed_penalty
        assert relaxed_scored.score > smooth_scored.score

    def test_avoid_stairs_reduces_stairs_penalty_for_walker(self):
        route = route_through(STAIRS)
        cautious = DEFAULT_PROFILE.model_copy(
            update={"mobilityProfile": "walker", "avoidStairs": True}
        )
        relaxed = DEFAULT_PROFILE.model_copy(
            update={"mobilityProfile": "walker", "avoidStairs": False}
        )
        cautious_scored = score_route(
            route, build_evidence(route, [STAIRS], cautious), cautious
        )
        relaxed_scored = score_route(route, build_evidence(route, [STAIRS], relaxed), relaxed)
        cautious_penalty = next(p.points for p in cautious_scored.penalties if "step section" in p.label)
        relaxed_penalty = next(p.points for p in relaxed_scored.penalties if "step section" in p.label)
        assert cautious_penalty > relaxed_penalty
        assert relaxed_scored.score > cautious_scored.score