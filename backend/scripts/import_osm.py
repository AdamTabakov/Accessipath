"""Import accessibility-relevant OSM features across Toronto into PostGIS.

Port of the Node import-osm script. Data is treated as untrusted and
validated; source = osm, ids preserved."""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg

from app.config import settings
from app.services.osm import TORONTO_BBOX, query_osm_accessibility


def feature_from_element(el: dict) -> dict | None:
    tags = el.get("tags") or {}
    if tags.get("highway") == "steps":
        return {"type": "stairs", "description": "Steps mapped in OpenStreetMap.", "tags": tags}
    if tags.get("highway") == "elevator":
        return {"type": "elevator", "description": "Elevator mapped in OpenStreetMap.", "tags": tags}
    if tags.get("ramp"):
        return {"type": "ramp", "description": "Ramp tagged in OpenStreetMap.", "tags": tags}
    if tags.get("highway") == "footway" and tags.get("wheelchair"):
        return {
            "type": "other",
            "description": f"Footway with wheelchair={tags.get('wheelchair')}.",
            "tags": tags,
        }
    if tags.get("incline"):
        return {"type": "other", "description": f"Path with incline={tags.get('incline')}.", "tags": tags}
    if tags.get("surface"):
        return {"type": "other", "description": f"Path with surface={tags.get('surface')}.", "tags": tags}
    return None


def way_center(way: dict, node_map: dict[int, dict]) -> dict | None:
    nodes = way.get("nodes") or []
    coords = [node_map[n] for n in nodes if n in node_map]
    if not coords:
        return None
    return {
        "lat": sum(c["lat"] for c in coords) / len(coords),
        "lon": sum(c["lon"] for c in coords) / len(coords),
    }


def point_geog(lon: float, lat: float) -> str:
    return f"SRID=4326;POINT({lon} {lat})"


async def main() -> None:
    print(f"Querying Overpass for Toronto bbox ({settings.overpass_url})...")
    result = await query_osm_accessibility(TORONTO_BBOX)
    elements = result["elements"]

    node_map: dict[int, dict] = {}
    for el in elements:
        if (
            el.get("type") == "node"
            and isinstance(el.get("lat"), (int, float))
            and isinstance(el.get("lon"), (int, float))
        ):
            node_map[int(el["id"])] = {"lat": float(el["lat"]), "lon": float(el["lon"])}

    features: list[dict] = []
    for el in elements:
        feat = feature_from_element(el)
        if not feat:
            continue
        if el.get("type") == "node" and isinstance(el.get("lat"), (int, float)) and isinstance(
            el.get("lon"), (int, float)
        ):
            coord = {"lat": float(el["lat"]), "lon": float(el["lon"])}
        else:
            coord = way_center(el, node_map)
        if not coord:
            continue
        features.append({**coord, **feat, "el": el})

    print(f"Found {len(features)} accessibility features.")

    if not settings.database_url:
        print("No DATABASE_URL - printing summary only:")
        for f in features[:30]:
            print(
                f"  [{f['type']}] {f['el'].get('type')}/{f['el'].get('id')} "
                f"({f['lat']:.5f}, {f['lon']:.5f})"
            )
        return

    conn = psycopg.connect(
        settings.database_url,
        sslmode="disable" if "localhost" in settings.database_url else "require",
    )
    with conn.cursor() as cur:
        for f in features:
            cur.execute(
                "INSERT INTO osm_features (osm_type, osm_id, geometry, tags_json) "
                "VALUES (%s,%s,ST_GeogFromText(%s),%s) ON CONFLICT DO NOTHING",
                (
                    f["el"].get("type"),
                    f["el"].get("id"),
                    point_geog(f["lon"], f["lat"]),
                    json.dumps(f["tags"]),
                ),
            )
    conn.commit()
    conn.close()
    print("Imported OSM accessibility features into PostGIS.")


if __name__ == "__main__":
    asyncio.run(main())