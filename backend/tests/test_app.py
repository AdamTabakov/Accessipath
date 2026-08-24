"""Port of the Node API integration tests (supertest -> TestClient)."""

import pytest

from app.schemas import Coordinates, RouteCandidate
from app.services import routing as routing_module


async def _fake_fetch_osrm(start: Coordinates, end: Coordinates) -> list[RouteCandidate]:
    return [
        RouteCandidate(
            id="route_1",
            provider="osrm",
            distanceMeters=520,
            durationMinutes=7,
            geometry=[
                Coordinates(latitude=43.6577, longitude=-79.3802),
                Coordinates(latitude=43.65785, longitude=-79.3791),
                Coordinates(latitude=43.658112, longitude=-79.377632),
            ],
        ),
        RouteCandidate(
            id="route_2",
            provider="osrm",
            distanceMeters=610,
            durationMinutes=8,
            geometry=[
                Coordinates(latitude=43.6577, longitude=-79.3802),
                Coordinates(latitude=43.658, longitude=-79.3788),
                Coordinates(latitude=43.65805, longitude=-79.3781),
                Coordinates(latitude=43.658112, longitude=-79.377632),
            ],
        ),
    ]


async def _fake_fetch_detours(
    start: Coordinates,
    end: Coordinates,
    existing: list[RouteCandidate],
) -> list[RouteCandidate]:
    return []


@pytest.fixture(scope="module", autouse=True)
def _mock_osrm():
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(routing_module, "fetch_osrm_routes", _fake_fetch_osrm)
    monkeypatch.setattr(routing_module, "fetch_osrm_detour_routes", _fake_fetch_detours)
    yield
    monkeypatch.undo()


ROUTE_QUERY = (
    "/api/routes?start=43.6577,-79.3802&end=43.658112,-79.377632"
    "&profile=wheelchair&mode=most_accessible"
)


class TestApi:
    def test_serves_health(self, client):
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_rejects_invalid_route_coordinates(self, client):
        res = client.get("/api/routes?start=999,-79.38&end=43.658112,-79.377632")
        assert res.status_code == 400

    def test_rejects_routes_outside_toronto(self, client):
        res = client.get("/api/routes?start=40.7128,-74.0060&end=43.658112,-79.377632")
        assert res.status_code == 400
        assert "Toronto" in res.json()["error"]

    def test_accepts_routes_at_toronto_edge(self, client):
        res = client.get("/api/routes?start=43.583,-79.64&end=43.65,-79.39")
        assert res.status_code == 200

    def test_returns_at_least_two_scored_routes(self, client):
        res = client.get(ROUTE_QUERY)
        assert res.status_code == 200
        body = res.json()
        assert len(body["routes"]) >= 2
        evidence_sources = {
            item["sourceType"]
            for route in body["routes"]
            for item in route["evidence"]
        }
        assert "institutional" in evidence_sources
        for route in body["routes"]:
            assert 0 <= route["accessibilityScore"] <= 100
            assert 0 <= route["dataConfidence"] <= 100
            assert isinstance(route["aiSummary"], str)
            assert route["aiSummary"]
            assert isinstance(route["geometry"], list)
            assert len(route["geometry"]) > 1
            assert isinstance(route["penalties"], list)
            assert isinstance(route["bonuses"], list)

    def test_sorts_most_accessible_by_descending_score(self, client):
        res = client.get(ROUTE_QUERY)
        scores = [r["accessibilityScore"] for r in res.json()["routes"]]
        assert scores == sorted(scores, reverse=True)

    def test_sorts_fastest_by_ascending_duration(self, client):
        res = client.get(
            "/api/routes?start=43.6577,-79.3802&end=43.658112,-79.377632"
            "&profile=wheelchair&mode=fastest"
        )
        durations = [r["durationMinutes"] for r in res.json()["routes"]]
        assert durations == sorted(durations)

    def test_preferences_alter_route_scores(self, client):
        client.post(
            "/api/reports",
            json={
                "type": "stairs",
                "description": "Step section along the route.",
                "latitude": 43.65785,
                "longitude": -79.3791,
            },
        )
        base = "start=43.6577,-79.3802&end=43.658112,-79.377632&mode=most_accessible"
        cautious = client.get(f"/api/routes?{base}&profile=walker&avoid_stairs=true").json()[
            "routes"
        ]
        relaxed = client.get(f"/api/routes?{base}&profile=walker&avoid_stairs=false").json()[
            "routes"
        ]

        def score_of(routes, route_id):
            return next(r["accessibilityScore"] for r in routes if r["id"] == route_id)

        assert score_of(cautious, "route_1") < score_of(relaxed, "route_1")

    def test_creates_a_community_report(self, client):
        res = client.post(
            "/api/reports",
            json={
                "type": "blocked_ramp",
                "description": "Demo ramp blocked by crates.",
                "latitude": 43.6577,
                "longitude": -79.3802,
            },
        )
        assert res.status_code == 201
        assert res.json()["report"]["status"] == "pending"

    def test_rejects_an_invalid_report(self, client):
        res = client.post(
            "/api/reports",
            json={
                "type": "blocked_ramp",
                "description": "x",
                "latitude": 43.6577,
                "longitude": -79.3802,
            },
        )
        assert res.status_code == 400

    def test_rejects_report_with_invalid_photo_upload(self, client):
        res = client.post(
            "/api/reports",
            json={
                "type": "blocked_ramp",
                "description": "Ramp blocked by a large sign.",
                "latitude": 43.6577,
                "longitude": -79.3802,
                "photo": "this is not a data url",
            },
        )
        assert res.status_code == 400

    def test_accepts_a_valid_png_photo_upload(self, client):
        png = (
            "data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        )
        res = client.post(
            "/api/reports",
            json={
                "type": "blocked_ramp",
                "description": "Ramp blocked by scaffolding.",
                "latitude": 43.6577,
                "longitude": -79.3802,
                "photo": png,
            },
        )
        assert res.status_code == 201
        assert res.json()["report"]["photoUrl"].startswith("/uploads/")

    def test_rejects_photo_with_non_image_bytes(self, client):
        html = "PGh0bWw+PGJvZHk+bm90IGFuIGltYWdlPC9ib2R5PjwvaHRtbD4="  # "<html><body>not an image</body></html>"
        res = client.post(
            "/api/reports",
            json={
                "type": "blocked_ramp",
                "description": "Attempt to smuggle non-image content.",
                "latitude": 43.6577,
                "longitude": -79.3802,
                "photo": f"data:image/png;base64,{html}",
            },
        )
        assert res.status_code == 400

    def test_rejects_photo_with_corrupted_magic_bytes(self, client):
        res = client.post(
            "/api/reports",
            json={
                "type": "blocked_ramp",
                "description": "Corrupted image bytes.",
                "latitude": 43.6577,
                "longitude": -79.3802,
                "photo": "data:image/png;base64,AAAA",
            },
        )
        assert res.status_code == 400

    def test_gets_and_updates_profile(self, client):
        get_res = client.get("/api/profile")
        assert get_res.status_code == 200
        assert get_res.json()["profile"]["mobilityProfile"] == "wheelchair"

        put_res = client.put(
            "/api/profile",
            json={
                "mobilityProfile": "walker",
                "avoidStairs": True,
                "preferRamps": True,
                "preferElevators": False,
                "maxSlope": "steep",
                "preferSmoothSurface": True,
                "maxWalkDistanceMeters": 1500,
            },
        )
        assert put_res.status_code == 200
        assert put_res.json()["profile"]["mobilityProfile"] == "walker"

    def test_returns_404_for_unknown_api_routes(self, client):
        res = client.get("/api/nope")
        assert res.status_code == 404
