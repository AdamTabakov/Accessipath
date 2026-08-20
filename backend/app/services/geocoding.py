"""Geocoding via OpenStreetMap Nominatim (port of the Node geocoding service)."""

import math
import urllib.parse

import httpx

from ..config import settings
from ..schemas import Place


async def geocode(query: str) -> list[Place]:
    url = f"{settings.nominatim_url.rstrip('/')}/search"
    params = {
        "format": "jsonv2",
        "q": query,
        "limit": "5",
        "addressdetails": "1",
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
            url,
            params=params,
            headers={
                "User-Agent": (
                    "AccessiPath/1.0 (hackathon accessibility routing; "
                    "contact: team@accessipath.dev)"
                ),
                "Accept": "application/json",
            },
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Nominatim responded with HTTP {response.status_code}")

    results: list[Place] = []
    for item in response.json():
        try:
            lat = float(item.get("lat"))
            lon = float(item.get("lon"))
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(lat) and math.isfinite(lon)):
            continue
        display_name = item.get("display_name") or ""
        name = item.get("name") or display_name.split(",")[0] or "Unknown place"
        results.append(
            Place(
                id=f"nom-{urllib.parse.quote(display_name)[:60]}",
                label=name,
                description=display_name,
                latitude=lat,
                longitude=lon,
                source="nominatim",
            )
        )
    return results