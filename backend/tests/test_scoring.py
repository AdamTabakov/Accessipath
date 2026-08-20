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