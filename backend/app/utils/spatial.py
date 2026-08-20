"""Geospatial helpers (direct port of the TypeScript spatial utils)."""

import math
from typing import Sequence

from ..schemas import Coordinates

EARTH_RADIUS_M = 6371000


def to_radians(deg: float) -> float:
    return (deg * math.pi) / 180


def haversine_distance(a: Coordinates, b: Coordinates) -> float:
    lat1 = to_radians(a.latitude)
    lat2 = to_radians(b.latitude)
    d_lat = to_radians(b.latitude - a.latitude)
    d_lon = to_radians(b.longitude - a.longitude)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def _to_local_xy(p: Coordinates, origin: Coordinates) -> tuple[float, float]:
    x = (
        (p.longitude - origin.longitude)
        * EARTH_RADIUS_M
        * math.cos(to_radians(origin.latitude))
        * (math.pi / 180)
    )
    y = (p.latitude - origin.latitude) * EARTH_RADIUS_M * (math.pi / 180)
    return x, y


def point_to_segment_distance_m(p: Coordinates, a: Coordinates, b: Coordinates) -> float:
    bx, by = _to_local_xy(b, a)
    px, py = _to_local_xy(p, a)
    dx = bx
    dy = by
    len_sq = dx * dx + dy * dy
    t = 0.0 if len_sq == 0 else ((px * dx) + (py * dy)) / len_sq
    t = max(0.0, min(1.0, t))
    cx = t * dx
    cy = t * dy
    return math.hypot(px - cx, py - cy)


def point_to_polyline_distance_m(p: Coordinates, polyline: Sequence[Coordinates]) -> float:
    if len(polyline) == 0:
        return float("inf")
    if len(polyline) == 1:
        return haversine_distance(p, polyline[0])
    best = float("inf")
    for i in range(len(polyline) - 1):
        d = point_to_segment_distance_m(p, polyline[i], polyline[i + 1])
        if d < best:
            best = d
    return best


def polyline_length_m(polyline: Sequence[Coordinates]) -> float:
    total = 0.0
    for i in range(len(polyline) - 1):
        total += haversine_distance(polyline[i], polyline[i + 1])
    return total


def resample_polyline(polyline: Sequence[Coordinates], interval_m: float) -> list[Coordinates]:
    if len(polyline) == 0:
        return []
    samples: list[Coordinates] = [polyline[0]]
    carried = 0.0
    for i in range(len(polyline) - 1):
        a = polyline[i]
        b = polyline[i + 1]
        seg_len = haversine_distance(a, b)
        travelled = carried
        while travelled < seg_len:
            t = travelled / seg_len if seg_len > 0 else 0
            samples.append(
                Coordinates(
                    latitude=a.latitude + (b.latitude - a.latitude) * t,
                    longitude=a.longitude + (b.longitude - a.longitude) * t,
                )
            )
            travelled += interval_m
        carried = travelled - seg_len
    last = polyline[-1]
    prev = samples[-1]
    if haversine_distance(prev, last) > 1:
        samples.append(last)
    return samples


def clamp(value: float, min_value: float, max_value: float) -> float:
    return min(max_value, max(min_value, value))


def is_valid_coordinate(lat: float, lon: float) -> bool:
    return (
        math.isfinite(lat)
        and math.isfinite(lon)
        and -90 <= lat <= 90
        and -180 <= lon <= 180
    )


def point_within_bounds(
    latitude: float,
    longitude: float,
    bounds: dict[str, float],
    pad_deg: float = 0.0,
) -> bool:
    """True when the point falls inside a {minLat,minLon,maxLat,maxLon} box."""
    return (
        bounds["minLat"] - pad_deg <= latitude <= bounds["maxLat"] + pad_deg
        and bounds["minLon"] - pad_deg <= longitude <= bounds["maxLon"] + pad_deg
    )