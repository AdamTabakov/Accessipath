from app.controllers.routing import institutional_points_near, profile_from_defaults
from app.schemas import Coordinates, RouteCandidate
from app.services.routing import _detour_points, _is_distinct_route


def _route(id_: str, geometry: list[tuple[float, float]], distance: int) -> RouteCandidate:
    return RouteCandidate(
        id=id_,
        provider="osrm",
        distanceMeters=distance,
        durationMinutes=max(1, round(distance / 75)),
        geometry=[Coordinates(latitude=lat, longitude=lon) for lat, lon in geometry],
    )


def test_detour_points_are_generated_on_both_sides_of_the_corridor():
    start = Coordinates(latitude=43.6577, longitude=-79.3802)
    end = Coordinates(latitude=43.658112, longitude=-79.377632)

    points = _detour_points(start, end)

    assert len(points) == 4
    assert any(point.latitude > (start.latitude + end.latitude) / 2 for point in points)
    assert any(point.latitude < (start.latitude + end.latitude) / 2 for point in points)


def test_distinct_route_allows_near_distance_but_different_geometry():
    base = _route(
        "base",
        [(43.6577, -79.3802), (43.6579, -79.379), (43.658112, -79.377632)],
        520,
    )
    detour = _route(
        "detour",
        [(43.6577, -79.3802), (43.659, -79.379), (43.658112, -79.377632)],
        526,
    )

    assert _is_distinct_route(detour, [base])


def test_distinct_route_rejects_same_shape_and_nearly_same_distance():
    base = _route(
        "base",
        [(43.6577, -79.3802), (43.6579, -79.379), (43.658112, -79.377632)],
        520,
    )
    duplicate = _route(
        "duplicate",
        [(43.6577, -79.3802), (43.65791, -79.379), (43.658112, -79.377632)],
        522,
    )

    assert not _is_distinct_route(duplicate, [base])


def test_profile_from_defaults_uses_selected_mobility_profile_presets():
    walker = profile_from_defaults({"mobilityProfile": "walker"})
    limited = profile_from_defaults({"mobilityProfile": "limited_mobility"})

    assert walker.preferElevators is False
    assert walker.maxWalkDistanceMeters == 1800
    assert limited.preferElevators is True
    assert limited.maxSlope == "flat"
    assert limited.maxWalkDistanceMeters == 1200


def test_institutional_points_near_route():
    start = Coordinates(latitude=43.6577, longitude=-79.3802)
    end = Coordinates(latitude=43.658112, longitude=-79.377632)

    points = institutional_points_near(start, end)
    names = {point.buildingName for point in points}

    # Toronto city data - replace TMU-specific entrances with city-wide data
    assert any("Community Centre" in name for name in names)
    assert any("Library" in name for name in names)
    assert all(point.sourceType == "institutional" for point in points)
