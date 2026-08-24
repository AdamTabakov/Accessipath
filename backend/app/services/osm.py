"""OpenStreetMap / Overpass integration (port of the Node osm service).

External data is treated as untrusted and validated before use. The lazy
region scan gives Toronto coverage without ever blocking route calculation."""

import asyncio
import math
from typing import Callable, Optional

import httpx

from ..config import settings
from ..schemas import AccessibilityPoint, AccessibilityStatus, Coordinates
from ..services.store import DataStore

TORONTO_BBOX = {
    "minLat": 43.581,
    "minLon": -79.639,
    "maxLat": 43.855,
    "maxLon": -79.116,
}

# Small tolerance so points right at the city edge are not rejected.
TORONTO_PAD_DEG = 0.1

Bbox = dict[str, float]

USER_AGENT = "AccessiPath/1.0 (hackathon; accessibility routing)"


def build_query(bbox: Bbox) -> str:
    return f"""[out:json][timeout:60];
(
  way["highway"="steps"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["highway"="elevator"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"="elevator"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["ramp"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["highway"="crossing"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"="crossing"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["kerb"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["tactile_paving"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"="footway"]["wheelchair"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"~"^(footway|path|pedestrian|steps)$"]["incline"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"~"^(footway|path|pedestrian|steps)$"]["surface"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"~"^(residential|service|unclassified|living_street|pedestrian|footway|path)$"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["barrier"]["wheelchair"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
);
out body;
>;
out skel qt;"""


def build_city_query(bbox: Bbox) -> str:
    return f"""[out:json][timeout:180];
(
  way["highway"="steps"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["highway"="elevator"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"="elevator"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["ramp"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["highway"="crossing"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"="crossing"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["kerb"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["tactile_paving"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"="footway"]["wheelchair"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  way["highway"="pedestrian"]["wheelchair"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
  node["barrier"]["wheelchair"]({bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']});
);
out body;
>;
out skel qt;"""


async def query_osm_accessibility(
    bbox: Bbox = TORONTO_BBOX,
    timeout_ms: int = 90_000,
    query_builder: Callable[[Bbox], str] = build_query,
) -> dict:
    async with httpx.AsyncClient(timeout=timeout_ms / 1000) as client:
        response = await client.post(
            settings.overpass_url,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": USER_AGENT,
            },
            data={"data": query_builder(bbox)},
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Overpass responded with HTTP {response.status_code}")
    data = response.json()
    if not isinstance(data.get("elements"), list):
        raise RuntimeError("Overpass returned malformed JSON")
    return data


def corridor_bbox(a: Coordinates, b: Coordinates, margin_deg: float = 0.004) -> Bbox:
    return {
        "minLat": min(a.latitude, b.latitude) - margin_deg,
        "maxLat": max(a.latitude, b.latitude) + margin_deg,
        "minLon": min(a.longitude, b.longitude) - margin_deg,
        "maxLon": max(a.longitude, b.longitude) + margin_deg,
    }


ROUGH_SURFACES = {
    "cobblestone",
    "unpaved",
    "gravel",
    "grass",
    "sand",
    "dirt",
    "mud",
    "pebblestone",
    "sett",
    "ground",
}


def safe_wheelchair(tags: dict[str, str]) -> AccessibilityStatus | None:
    value = tags.get("wheelchair") or tags.get("access")
    if value in ("yes", "designated", "permissive"):
        return "accessible"
    if value in ("no", "limited"):
        return "inaccessible"
    return None


def _build_node_coords(elements: list[dict]) -> dict[int, Coordinates]:
    node_coords: dict[int, Coordinates] = {}
    for el in elements:
        if (
            el.get("type") == "node"
            and isinstance(el.get("lat"), (int, float))
            and isinstance(el.get("lon"), (int, float))
        ):
            node_coords[int(el["id"])] = Coordinates(
                latitude=float(el["lat"]), longitude=float(el["lon"])
            )
    return node_coords


def _centroid(el: dict, node_coords: dict[int, Coordinates]) -> Coordinates | None:
    nodes = el.get("nodes") or []
    coords = [node_coords[int(n)] for n in nodes if int(n) in node_coords]
    if not coords:
        return None
    return Coordinates(
        latitude=sum(c.latitude for c in coords) / len(coords),
        longitude=sum(c.longitude for c in coords) / len(coords),
    )


def osm_elements_to_accessibility_points(elements: list[dict]) -> list[AccessibilityPoint]:
    node_coords = _build_node_coords(elements)
    points: list[AccessibilityPoint] = []

    for el in elements:
        tags = el.get("tags") or {}
        if not tags:
            continue

        base: dict = {
            "id": f"osm-{el.get('type')}-{el.get('id')}",
            "buildingName": None,
            "latitude": 0.0,
            "longitude": 0.0,
            "sourceType": "osm",
            "confidence": 0.6,
        }

        if el.get("type") == "node":
            if not isinstance(el.get("lat"), (int, float)) or not isinstance(
                el.get("lon"), (int, float)
            ):
                continue
            base["id"] = f"osm-node-{el.get('id')}"
            base["latitude"] = float(el["lat"])
            base["longitude"] = float(el["lon"])
        else:
            c = _centroid(el, node_coords)
            if not c:
                continue
            base["latitude"] = c.latitude
            base["longitude"] = c.longitude

        point: Optional[AccessibilityPoint] = None

        if tags.get("highway") == "steps":
            point = AccessibilityPoint(
                **base, type="stairs", stairs=True, description="Step way (highway=steps)."
            )
        elif tags.get("highway") == "elevator":
            point = AccessibilityPoint(
                **base, type="elevator", elevator=True, description="Elevator mapped in OpenStreetMap."
            )
        elif tags.get("ramp") and tags.get("ramp") != "no":
            point = AccessibilityPoint(
                **base, type="ramp", ramp=True, description="Ramp mapped in OpenStreetMap."
            )
        elif tags.get("highway") == "crossing":
            description = "Street crossing."
            crossing_value = tags.get("crossing")
            if crossing_value in ("uncontrolled", "unmarked"):
                description = "Street crossing (uncontrolled)."
            crossing_wheelchair: AccessibilityStatus | None = None
            if crossing_value in ("traffic_signals", "traffic_signal"):
                description = "Street crossing with traffic signals."
                crossing_wheelchair = "accessible"
            if tags.get("tactile_paving") == "yes":
                description = f"{description} Tactile paving present."
            if tags.get("kerb") in ("no", "flush", "lowered"):
                description = f"{description} Dropped/level kerb."
            wheelchair = safe_wheelchair(tags) or crossing_wheelchair
            point = AccessibilityPoint(
                **base,
                type="crossing",
                description=description,
                wheelchair=wheelchair,
            )
        elif tags.get("barrier"):
            point = AccessibilityPoint(
                **base,
                type="barrier",
                description=f"Barrier ({tags.get('barrier')}).",
                wheelchair=safe_wheelchair(tags),
            )
        elif tags.get("kerb"):
            description = f"Kerb ({tags.get('kerb')})."
            wheelchair: AccessibilityStatus | None = None
            if tags.get("kerb") in ("no", "flush", "lowered"):
                description = "Dropped/level kerb."
                wheelchair = "accessible"
            point = AccessibilityPoint(
                **base, type="crossing", description=description, wheelchair=wheelchair
            )
        else:
            description: str | None = None
            incline: str | None = None
            surface: str | None = None
            raw_incline = tags.get("incline")
            if raw_incline:
                try:
                    numeric = float(str(raw_incline).replace("%", ""))
                except ValueError:
                    numeric = math.nan
                if math.isfinite(numeric) and abs(numeric) > 8:
                    incline = "steep"
                    description = f"Steep incline ({raw_incline})."
                else:
                    description = f"Incline {raw_incline}."
            raw_surface = tags.get("surface")
            if raw_surface and raw_surface in ROUGH_SURFACES:
                surface = "rough"
                description = (
                    f"{description} Rough surface ({raw_surface})."
                    if description
                    else f"Rough surface ({raw_surface})."
                )
            wheelchair = safe_wheelchair(tags)
            if not (incline or surface or wheelchair):
                continue
            point = AccessibilityPoint(
                **base,
                type="other",
                description=description,
                surface=surface,
                incline=incline,
                wheelchair=wheelchair,
            )

        points.append(point)

    return points


WALKABLE_HIGHWAYS = {
    "footway",
    "path",
    "pedestrian",
    "steps",
    "living_street",
    "residential",
    "service",
    "unclassified",
    "cycleway",
    "track",
}


def osm_elements_to_way_polylines(elements: list[dict]) -> list[list[Coordinates]]:
    node_coords = _build_node_coords(elements)
    polylines: list[list[Coordinates]] = []
    for el in elements:
        if el.get("type") != "way":
            continue
        tags = el.get("tags") or {}
        nodes = el.get("nodes") or []
        if len(nodes) < 2:
            continue
        highway = tags.get("highway")
        if not highway or highway not in WALKABLE_HIGHWAYS:
            continue
        line = [node_coords[int(n)] for n in nodes if int(n) in node_coords]
        if len(line) >= 2:
            polylines.append(line)
    return polylines


corridor_cache: dict[str, dict] = {}
CORRIDOR_CACHE_MAX = 64


def corridor_key(start: Coordinates, end: Coordinates) -> str:
    bbox = corridor_bbox(start, end)
    return ",".join(f"{bbox[k]:.3f}" for k in ("minLat", "minLon", "maxLat", "maxLon"))


async def fetch_corridor_data(start: Coordinates, end: Coordinates) -> dict:
    key = corridor_key(start, end)
    cached = corridor_cache.get(key)
    if cached:
        return cached
    bbox = corridor_bbox(start, end)
    result = await query_osm_accessibility(bbox, 25_000)
    data = {
        "points": osm_elements_to_accessibility_points(result["elements"]),
        "ways": osm_elements_to_way_polylines(result["elements"]),
    }
    corridor_cache[key] = data
    if len(corridor_cache) > CORRIDOR_CACHE_MAX:
        corridor_cache.pop(next(iter(corridor_cache)))
    return data


async def fetch_corridor_accessibility(start: Coordinates, end: Coordinates) -> list[AccessibilityPoint]:
    data = await fetch_corridor_data(start, end)
    return data["points"]


REGION_MARGIN_DEG = 0.15
region_cache: dict[str, dict] = {}
REGION_CACHE_MAX = 24
region_pending: set[str] = set()


def region_key(center: Coordinates) -> str:
    return f"{center.latitude:.2f},{center.longitude:.2f}"


async def _scan_region(center: Coordinates) -> None:
    key = region_key(center)
    if key in region_cache or key in region_pending:
        return
    region_pending.add(key)
    try:
        bbox = {
            "minLat": center.latitude - REGION_MARGIN_DEG,
            "minLon": center.longitude - REGION_MARGIN_DEG,
            "maxLat": center.latitude + REGION_MARGIN_DEG,
            "maxLon": center.longitude + REGION_MARGIN_DEG,
        }
        result = await query_osm_accessibility(bbox, 180_000, build_city_query)
        region_cache[key] = {
            "points": osm_elements_to_accessibility_points(result["elements"]),
            "ways": osm_elements_to_way_polylines(result["elements"]),
        }
        if len(region_cache) > REGION_CACHE_MAX:
            region_cache.pop(next(iter(region_cache)))
    except Exception as error:  # noqa: BLE001
        print(f"[osm] Region scan failed: {error}")
    finally:
        region_pending.discard(key)


async def get_toronto_accessibility_summary(store: DataStore) -> dict:
    """Aggregate accessibility features across all of Toronto.

    Returns counts and distribution of accessibility features from all sources:
    OSM city-wide, institutional, and community reports. Unknown data is
    tracked separately from known inaccessible features. The OSM query covers
    the entire Toronto BBOX (43.581-43.855 lat, -79.639 to -79.116 lon).

    Feature type breakdown mirrors the OSM tags queried city-wide:
    steps→stairs, elevator→elevator, ramp→ramp, crossing→crossing,
    barrier→barrier, and surface/incline features.
    """
    from ..schemas import AccessibilityPoint, EvidenceSource, AccessibilityStatus

    bbox = TORONTO_BBOX

    # 1. Query OSM city-wide data
    city_data: dict = {"points": [], "ways": []}
    try:
        result = await query_osm_accessibility(bbox, 180_000, build_city_query)
        city_data = {
            "points": osm_elements_to_accessibility_points(result["elements"]),
            "ways": osm_elements_to_way_polylines(result["elements"]),
        }
    except Exception as error:  # noqa: BLE001
        print(f"[osm] City-wide query failed: {error}")

    # 2. Get institutional points
    from ..data.institutional_accessibility import INSTITUTIONAL_ACCESSIBILITY_POINTS
    institutional_points = list(INSTITUTIONAL_ACCESSIBILITY_POINTS)

    # 3. Get community reports from store
    store_points: list[AccessibilityPoint] = []
    if hasattr(store, "get_all_accessibility_points"):
        try:
            store_points = await store.get_all_accessibility_points()
        except Exception as error:  # noqa: BLE001
            print(f"[store] Failed to get reports: {error}")

    # 4. Merge all points and aggregate with detailed breakdowns
    all_points: list[AccessibilityPoint] = [
        *city_data["points"],
        *institutional_points,
        *store_points,
    ]

    # Count by top-level type
    type_counts: dict[str, int] = {}
    stairs_count = 0
    elevator_count = 0
    ramp_count = 0
    crossing_count = 0
    barrier_count = 0
    other_count = 0

    # Count by status
    status_counts: dict[str, int] = {"accessible": 0, "inaccessible": 0, "unknown": 0}

    # Count by source
    source_counts: dict[str, int] = {}

    # Feature category breakdown (for top-level types)
    feature_categories: dict[str, int] = {
        "entrance": 0,
        "ramp": 0,
        "elevator": 0,
        "stairs": 0,
        "crossing": 0,
        "barrier": 0,
        "other": 0,
    }

    for point in all_points:
        # Top-level type count
        ptype = point.type
        type_counts[ptype] = type_counts.get(ptype, 0) + 1

        # Map top-level types to categories
        if ptype == "entrance":
            feature_categories["entrance"] += 1
        elif ptype == "ramp":
            feature_categories["ramp"] += 1
        elif ptype == "elevator":
            feature_categories["elevator"] += 1
        elif ptype == "stairs":
            stairs_count += 1
            feature_categories["stairs"] += 1
        elif ptype == "crossing":
            crossing_count += 1
            feature_categories["crossing"] += 1
        elif ptype == "barrier":
            barrier_count += 1
            feature_categories["barrier"] += 1
        else:
            other_count += 1
            feature_categories["other"] += 1

        # Status count
        wheelchair = point.wheelchair
        if wheelchair == "accessible":
            status_counts["accessible"] += 1
        elif wheelchair == "inaccessible":
            status_counts["inaccessible"] += 1
        elif wheelchair == "unknown" or wheelchair is None:
            status_counts["unknown"] += 1

        # Source count
        source = point.sourceType
        source_counts[source] = source_counts.get(source, 0) + 1

    # Sub-type counts for OSM-derived points (stairs, elevator, ramp, crossing)
    # These are also tracked separately in feature_categories above

    total = len(all_points)

    # Build detailed type breakdown
    detailed_type_counts: dict[str, int] = {}
    for ptype, count in type_counts.items():
        if ptype in ("stairs", "elevator", "ramp", "crossing", "barrier"):
            detailed_type_counts[ptype] = count
        else:
            detailed_type_counts[ptype] = count

    return {
        "totalFeatures": total,
        "byCategory": feature_categories,
        "detailByType": detailed_type_counts,
        "byStatus": status_counts,
        "bySource": source_counts,
        "torontoBBox": bbox,
        "note": "Unknown status means data is unavailable, not that the feature is known to be inaccessible. "
                "OSM city-wide covers all of Toronto; institutional data; community reports are user-submitted.",
    }


def get_regional_accessibility(start: Coordinates, end: Coordinates) -> dict:
    """Schedule a background region scan and return whatever is cached.

    Mirrors the TS behaviour: the scan never blocks route calculation; callers
    get cached data when ready, otherwise an empty result (the dense corridor
    fetch already covers the immediate route).
    """
    mid = Coordinates(
        latitude=(start.latitude + end.latitude) / 2,
        longitude=(start.longitude + end.longitude) / 2,
    )
    asyncio.get_running_loop().create_task(_scan_region(mid))
    return region_cache.get(region_key(mid), {"points": [], "ways": []})