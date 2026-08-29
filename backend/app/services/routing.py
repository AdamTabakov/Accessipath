"""Route candidate generation: live OSRM + OSM sidewalk-following fallback.

Port of the Node routing service. Never emits "as-the-crow-flies" fallbacks
that ignore walkways."""

import heapq
import math
from dataclasses import dataclass
from typing import Optional

import httpx

from ..config import settings
from ..schemas import Coordinates, RouteCandidate
from ..utils.spatial import haversine_distance, point_to_polyline_distance_m, polyline_length_m
from ..utils.ttl_cache import TtlCache


@dataclass
class _HeapEntry:
    dist: float
    node: int

WALK_SPEED_MPS = 1.25
MAX_CORRIDOR_WAYS = 8000
MAX_DETOUR_ATTEMPTS = 24
MAX_OSRM_DETOUR_ATTEMPTS = 4

osrm_cache: TtlCache[str, list[RouteCandidate]] = TtlCache(ttl_ms=10 * 60_000)

USER_AGENT = "AccessiPath/1.0 (hackathon; accessibility routing)"


def osrm_cache_key(start: Coordinates, end: Coordinates) -> str:
    return (
        f"{start.latitude:.4f},{start.longitude:.4f};"
        f"{end.latitude:.4f},{end.longitude:.4f}"
    )


def decode_geojson_geometry(coords: object) -> list[Coordinates]:
    if not isinstance(coords, list):
        return []
    result: list[Coordinates] = []
    for item in coords:
        if not isinstance(item, list) or len(item) < 2:
            continue
        try:
            lon = float(item[0])
            lat = float(item[1])
        except (TypeError, ValueError):
            continue
        if math.isfinite(lat) and math.isfinite(lon):
            result.append(Coordinates(latitude=lat, longitude=lon))
    return result


def to_candidate(
    id: str,
    provider: str,
    geometry: list[Coordinates],
    distance_meters: float,
    duration_seconds: float,
) -> RouteCandidate:
    return RouteCandidate(
        id=id,
        provider=provider,  # type: ignore[arg-type]
        geometry=geometry,
        distanceMeters=round(distance_meters),
        durationMinutes=max(1, round(duration_seconds / 60)),
    )


async def fetch_osrm_routes(start: Coordinates, end: Coordinates) -> list[RouteCandidate]:
    key = osrm_cache_key(start, end)
    cached = osrm_cache.get(key)
    if cached is not None:
        return cached

    url = (
        f"{settings.osrm_url.rstrip('/')}/route/v1/foot/"
        f"{start.longitude},{start.latitude};{end.longitude},{end.latitude}"
        f"?alternatives=true&overview=full&geometries=geojson&steps=false"
    )
    async with httpx.AsyncClient(timeout=9.0) as client:
        response = await client.get(url, headers={"User-Agent": USER_AGENT})
    if response.status_code >= 300:
        raise RuntimeError(f"OSRM responded with HTTP {response.status_code}")
    data = response.json()
    if data.get("code") != "Ok" or not isinstance(data.get("routes"), list):
        raise RuntimeError(f"OSRM route failure: {data.get('code', 'unknown')}")

    routes: list[RouteCandidate] = []
    for index, item in enumerate(data["routes"]):
        geometry = decode_geojson_geometry((item.get("geometry") or {}).get("coordinates"))
        if len(geometry) < 2:
            continue
        distance = item.get("distance") or polyline_length_m(geometry)
        routes.append(
            to_candidate(f"route_{index + 1}", "osrm", geometry, distance, distance / WALK_SPEED_MPS)
        )
    osrm_cache.set(key, routes)
    return routes


def _detour_points(start: Coordinates, end: Coordinates) -> list[Coordinates]:
    mid_lat = (start.latitude + end.latitude) / 2
    mid_lon = (start.longitude + end.longitude) / 2
    d_lat = end.latitude - start.latitude
    d_lon = end.longitude - start.longitude
    length = math.sqrt(d_lat * d_lat + d_lon * d_lon)
    if length == 0:
        return []
    perp_lat = -d_lon / length
    perp_lon = d_lat / length
    cos_lat = max(0.2, math.cos(math.radians(mid_lat)))
    points: list[Coordinates] = []
    for meters in (90, -90, 160, -160):
        points.append(
            Coordinates(
                latitude=mid_lat + perp_lat * meters / 111000,
                longitude=mid_lon + perp_lon * meters / (111000 * cos_lat),
            )
        )
    return points


def _is_distinct_route(candidate: RouteCandidate, existing: list[RouteCandidate]) -> bool:
    for route in existing:
        distance_delta = abs(candidate.distanceMeters - route.distanceMeters)
        max_separation = max(
            point_to_polyline_distance_m(point, route.geometry)
            for point in candidate.geometry[1:-1] or candidate.geometry
        )
        if distance_delta < 15 and max_separation < 25:
            return False
    return True


async def fetch_osrm_detour_routes(
    start: Coordinates,
    end: Coordinates,
    existing: list[RouteCandidate],
) -> list[RouteCandidate]:
    candidates: list[RouteCandidate] = []
    points = _detour_points(start, end)[:MAX_OSRM_DETOUR_ATTEMPTS]
    if not points:
        return []

    async with httpx.AsyncClient(timeout=6.0) as client:
        for index, via in enumerate(points):
            url = (
                f"{settings.osrm_url.rstrip('/')}/route/v1/foot/"
                f"{start.longitude},{start.latitude};"
                f"{via.longitude},{via.latitude};"
                f"{end.longitude},{end.latitude}"
                f"?alternatives=false&overview=full&geometries=geojson&steps=false"
            )
            try:
                response = await client.get(url, headers={"User-Agent": USER_AGENT})
                if response.status_code >= 300:
                    continue
                data = response.json()
                routes = data.get("routes")
                if data.get("code") != "Ok" or not isinstance(routes, list) or not routes:
                    continue
                item = routes[0]
                geometry = decode_geojson_geometry((item.get("geometry") or {}).get("coordinates"))
                if len(geometry) < 2:
                    continue
                distance = item.get("distance") or polyline_length_m(geometry)
                candidate = to_candidate(
                    f"detour_{index + 1}",
                    "osrm",
                    geometry,
                    distance,
                    distance / WALK_SPEED_MPS,
                )
                if _is_distinct_route(candidate, [*existing, *candidates]):
                    candidates.append(candidate)
            except Exception as error:  # noqa: BLE001
                print(f"[routing] OSRM detour attempt failed: {error}")
    return candidates


@dataclass
class _Snap:
    way_index: int
    point: Coordinates
    seg_index: int
    t: float
    dist: float


@dataclass
class _WayEdge:
    a: int
    b: int
    geom: list[Coordinates]


def _nearest_on_ways(p: Coordinates, ways: list[list[Coordinates]]) -> _Snap | None:
    best: _Snap | None = None
    for wi, poly in enumerate(ways):
        for i in range(len(poly) - 1):
            a = poly[i]
            b = poly[i + 1]
            d_lon = b.longitude - a.longitude
            d_lat = b.latitude - a.latitude
            len_sq = d_lon * d_lon + d_lat * d_lat
            if len_sq == 0:
                t = 0.0
            else:
                t = (
                    (p.longitude - a.longitude) * d_lon
                    + (p.latitude - a.latitude) * d_lat
                ) / len_sq
            t = max(0.0, min(1.0, t))
            point = Coordinates(
                longitude=a.longitude + t * d_lon,
                latitude=a.latitude + t * d_lat,
            )
            dist = haversine_distance(p, point)
            if best is None or dist < best.dist:
                best = _Snap(way_index=wi, point=point, seg_index=i, t=t, dist=dist)
    return best


def _path_from_prev(prev_edge: list[int], start: int, end: int) -> list[int] | None:
    chain: list[int] = []
    cur = end
    guard: set[int] = set()
    while cur != start:
        if cur in guard:
            return None
        guard.add(cur)
        ei = prev_edge[cur]
        if ei == -1:
            return None
        chain.append(ei)
        cur = edges[ei].b if edges[ei].a == cur else edges[ei].a
    chain.reverse()
    return chain


def _dijkstra_path(
    adj: dict[int, list[int]],
    edges: list[_WayEdge],
    node_count: int,
    s: int,
    t: int,
    banned_edge: int = -1,
) -> list[int] | None:
    prev = _dijkstra(adj, edges, node_count, s, t, banned_edge)
    return _path_from_prev(prev, s, t) if prev else None


def _remove_edge_from_adj(adj: dict[int, list[int]], a: int, b: int) -> None:
    adj[a] = [ei for ei in adj.get(a, []) if edges[ei].b != b]
    adj[b] = [ei for ei in adj.get(b, []) if edges[ei].a != a]


def _yen_k_shortest_paths(
    adj: dict[int, list[int]],
    edges: list[_WayEdge],
    node_count: int,
    s: int,
    t: int,
    k: int = 2,
    banned_edge: int = -1,
) -> list[list[int]]:
    """Yen's k-shortest loopless path algorithm.

    Returns a list of paths, each as a list of edge indices,
    ordered by shortest total distance.
    """
    if s < 0 or s >= node_count or t < 0 or t >= node_count or s == t:
        return []
    if k < 1:
        return []

    # shortest path first
    import heapq as _heapq

    shortest = _dijkstra_path(adj, edges, node_count, s, t, banned_edge)
    if shortest is None:
        return []

    result: list[list[int]] = [shortest]

    # --- Yen's main loop ---
    for _ in range(1, k):
        last = result[-1]
        candidates: list[tuple[float, list[int]]] = []

        for i in range(len(last)):
            spur_node = last[i]
            root_path = last[:i]

            # Construct a working copy of adj with edge removals
            working_adj: dict[int, list[int]] = {u: list(v) for u, v in adj.items()}

            # Remove root path edges (prefix edges before spur_node)
            for j in range(i):
                _remove_edge_from_adj(working_adj, edges[last[j]].a, edges[last[j]].b)

            # Remove previous shortest-path edges at spur_node position i
            # (these are the edges used by earlier paths from this same spur position)
            if i not in _yen_removed_at:
                _yen_removed_at[i] = set()
            for ei in _yen_removed_at[i]:
                _remove_edge_from_adj(working_adj, edges[ei].a, edges[ei].b)

            # Run Dijkstra from spur_node to target on the modified graph
            spur = _dijkstra_path(working_adj, edges, node_count, spur_node, t, banned_edge)
            if spur is None:
                continue

            total_path = root_path + spur
            # Compute total distance
            total_dist = sum(
                polyline_length_m(edges[ei].geom) for ei in total_path
            )
            candidates.append((total_dist, total_path))

        if not candidates:
            break

        # Pick the minimum-distance candidate
        candidates.sort(key=lambda x: x[0])
        next_path = candidates[0][1]

        # Record that the edge at position i from last was used, so other
        # iterations from the same spur position can be excluded later
        for i in range(len(last)):
            if i < len(next_path):
                ei = next_path[i]
                key_edge = last[i] if i < len(last) else None
                if key_edge is not None:
                    _yen_removed_at.setdefault(i, set()).add(key_edge)

        result.append(next_path)

    return result


_yen_removed_at: dict[int, set[int]] = {}


def polyline_length_m_list(path: list[int], edges: list[_WayEdge]) -> float:
    total = 0.0
    for ei in path:
        total += polyline_length_m(edges[ei].geom)
    return total


def _prev_edge_from_path(path: list[int], start_node: int, end_node: int, edges: list[_WayEdge]) -> list[int] | None:
    """Convert a path of edge indices to a prev_edge array indexed by node.

    The path is a list of edge indices [e0, e1, ...] traversed from start_node to end_node.
    Returns a prev_edge array where prev_edge[node] = edge index used to reach `node`,
    or None if the path is invalid.
    """
    if not path:
        return None
    # Determine node count from edge endpoints
    max_node = max(
        max(edges[ei].a, edges[ei].b) for ei in path
    )
    node_count = max(max_node + 1, start_node + 1, end_node + 1)
    prev_edge = [-1] * node_count

    # Walk the path forwards to determine node ordering
    # We'll build a mapping: for each node (except start), which edge reaches it
    # Work backwards from end_node using the last edge
    last_ei = path[-1]
    last_edge = edges[last_ei]
    if last_edge.a == end_node:
        prev_edge[end_node] = last_ei
        pred = last_edge.b
    elif last_edge.b == end_node:
        prev_edge[end_node] = last_ei
        pred = last_edge.a
    else:
        # Last edge not incident to end_node - invalid path
        return None

    # Walk backwards through remaining edges
    for i in range(len(path) - 2, -1, -1):
        ei = path[i]
        edge = edges[ei]
        # pred should be one of this edge's endpoints
        if edge.a == pred:
            prev_edge[pred] = ei
            pred = edge.b
        elif edge.b == pred:
            prev_edge[pred] = ei
            pred = edge.a
        else:
            # Edge doesn't connect to expected predecessor - invalid path
            return None

    # pred should now be start_node; ensure consistency
    if pred != start_node:
        # Try reversing: maybe the path direction is opposite
        # Reset and try from start
        prev_edge = [-1] * node_count
        first_ei = path[0]
        first_edge = edges[first_ei]
        if first_edge.a == start_node:
            # Forward direction is correct, but we need to rebuild
            # This shouldn't happen if the path is valid
            return None
        # Actually, just return what we have; _reconstruct handles -1 at start
    return prev_edge


def _reconstruct(
    prev_edge: list[int],
    edges: list[_WayEdge],
    start_node: int,
    end_node: int,
) -> list[Coordinates] | None:
    chain: list[int] = []
    cur = end_node
    guard: set[int] = set()
    while cur != start_node:
        if cur in guard:
            return None
        guard.add(cur)
        ei = prev_edge[cur]
        if ei == -1:
            return None
        chain.append(ei)
        edge = edges[ei]
        cur = edge.b if edge.a == cur else edge.a
    chain.reverse()
    result: list[Coordinates] = []
    prev_point: Coordinates | None = None
    for ei in chain:
        edge = edges[ei]
        geom = list(edge.geom)
        if prev_point:
            d1 = haversine_distance(prev_point, geom[0])
            d2 = haversine_distance(prev_point, geom[-1])
            if d1 > d2:
                geom.reverse()
        start_idx = 1 if prev_point else 0
        for i in range(start_idx, len(geom)):
            result.append(geom[i])
        prev_point = geom[-1]
    return result


def sidewalk_routes_from_ways(
    start: Coordinates,
    end: Coordinates,
    ways: list[list[Coordinates]],
) -> list[RouteCandidate]:
    if not ways:
        return []

    def node_key(c: Coordinates) -> str:
        return f"{c.latitude:.5f},{c.longitude:.5f}"

    node_by_id: dict[str, int] = {}
    node_coord: list[Coordinates] = []

    def get_node(c: Coordinates) -> int:
        key = node_key(c)
        node_id = node_by_id.get(key)
        if node_id is None:
            node_id = len(node_coord)
            node_by_id[key] = node_id
            node_coord.append(c)
        return node_id

    edges: list[_WayEdge] = []
    adj: dict[int, list[int]] = {}

    def add_edge(a: int, b: int, geom: list[Coordinates]) -> None:
        ei = len(edges)
        edges.append(_WayEdge(a=a, b=b, geom=geom))
        adj.setdefault(a, []).append(ei)
        adj.setdefault(b, []).append(ei)

    start_snap = _nearest_on_ways(start, ways)
    end_snap = _nearest_on_ways(end, ways)
    if not start_snap or not end_snap or start_snap.dist > 500 or end_snap.dist > 500:
        return []

    def split_geometry(
        geom: list[Coordinates], seg_index: int, point: Coordinates
    ) -> tuple[list[Coordinates], list[Coordinates]]:
        left = [*geom[: seg_index + 1], point]
        right = [point, *geom[seg_index + 1 :]]
        return left, right

    for wi, w in enumerate(ways):
        if len(w) < 2:
            continue
        in_start = start_snap.way_index == wi and 0.005 < start_snap.t < 0.995
        in_end = end_snap.way_index == wi and 0.005 < end_snap.t < 0.995

        if in_start and in_end:
            s_seg = start_snap.seg_index
            e_seg = end_snap.seg_index
            between = w[s_seg + 1 : e_seg + 1] if s_seg <= e_seg else list(reversed(w[e_seg + 1 : s_seg + 1]))
            geom = [start_snap.point, *between, end_snap.point]
            add_edge(get_node(start_snap.point), get_node(end_snap.point), geom)
            continue
        if in_start:
            left, right = split_geometry(w, start_snap.seg_index, start_snap.point)
            add_edge(get_node(left[0]), get_node(start_snap.point), left)
            add_edge(get_node(start_snap.point), get_node(right[-1]), right)
            continue
        if in_end:
            left, right = split_geometry(w, end_snap.seg_index, end_snap.point)
            add_edge(get_node(left[0]), get_node(end_snap.point), left)
            add_edge(get_node(end_snap.point), get_node(right[-1]), right)
            continue
        add_edge(get_node(w[0]), get_node(w[-1]), w)

    if len(node_coord) < 2 or not edges:
        return []

    start_node = get_node(start_snap.point)
    end_node = get_node(end_snap.point)
    if start_node == end_node:
        return []

    prev_edge = _dijkstra(adj, edges, len(node_coord), start_node, end_node, node_coords=node_coord)
    if prev_edge is None:
        return []
    geom1 = _reconstruct(prev_edge, edges, start_node, end_node)
    if not geom1:
        return []

    path_edges: list[int] = []
    cur = end_node
    guard: set[int] = set()
    while cur != start_node:
        if cur in guard:
            break
        guard.add(cur)
        ei = prev_edge[cur]
        if ei == -1:
            break
        path_edges.append(ei)
        edge = edges[ei]
        cur = edge.b if edge.a == cur else edge.a

    alt_paths = _yen_k_shortest_paths(adj, edges, len(node_coord), start_node, end_node, k=2)

    geom2: list[Coordinates] | None = None
    primary_len = polyline_length_m(geom1)
    if alt_paths and len(alt_paths) >= 2:
        second = alt_paths[1]  # second-shortest loopless path (edge indices)
        # Convert edge-path to prev_edge array for _reconstruct
        prev_from_path = _prev_edge_from_path(second, start_node, end_node, edges)
        if prev_from_path is not None:
            g = _reconstruct(prev_from_path, edges, start_node, end_node)
            if g and abs(primary_len - polyline_length_m(g)) >= 10:
                geom2 = g

    if geom2 is None:
        return [
            to_candidate("route_1", "demo", geom1, primary_len, primary_len / WALK_SPEED_MPS)
        ]
    secondary_len = polyline_length_m(geom2)
    return [
        to_candidate("route_1", "demo", geom1, primary_len, primary_len / WALK_SPEED_MPS),
        to_candidate("route_2", "demo", geom2, secondary_len, secondary_len / WALK_SPEED_MPS),
    ]


async def get_candidate_routes(
    start: Coordinates,
    end: Coordinates,
    ways: Optional[list[list[Coordinates]]] = None,
) -> dict:
    ways = ways or []
    build_sidewalk = lambda: (
        sidewalk_routes_from_ways(start, end, ways)
        if 0 < len(ways) <= MAX_CORRIDOR_WAYS
        else []
    )

    try:
        routes = await fetch_osrm_routes(start, end)
        if len(routes) < 3:
            detours = await fetch_osrm_detour_routes(start, end, routes)
            routes = [*routes, *detours][:3]
        if len(routes) >= 2:
            return {"routes": routes, "provider": "osrm"}
        if len(routes) == 1:
            extras = [
                {**d.model_dump(), "id": f"alt-{i + 1}"}
                for i, d in enumerate(build_sidewalk())
                if _is_distinct_route(d, routes)
            ]
            extras = [RouteCandidate(**e) for e in extras[:2]]
            return {
                "routes": [routes[0], *extras][:3],
                "provider": "osrm",
                "warning": (
                    None
                    if extras
                    else "Only one walkable route could be found between these points."
                ),
            }
        sidewalk = build_sidewalk()
        if len(sidewalk) >= 1:
            return {
                "routes": sidewalk[:2],
                "provider": "demo",
                "warning": (
                    "Live routing is temporarily unavailable - showing a route built from "
                    "OpenStreetMap walkable paths."
                ),
            }
        return {
            "routes": [],
            "provider": "demo",
            "warning": "Could not find a walkable route between these points.",
        }
    except Exception as error:  # noqa: BLE001
        print(f"[routing] Live routing unavailable: {error}")
        sidewalk = build_sidewalk()
        if len(sidewalk) >= 1:
            return {
                "routes": sidewalk[:2],
                "provider": "demo",
                "warning": (
                    "Live routing is temporarily unavailable - showing a route built from "
                    "OpenStreetMap walkable paths."
                ),
            }
        return {
            "routes": [],
            "provider": "demo",
            "warning": (
                "Live routing is temporarily unavailable and no walkable path could be built "
                "from OpenStreetMap data."
            ),
        }
