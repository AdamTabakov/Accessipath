import type { Place } from "../types/index.js";
import { config } from "../config.js";

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
}

/**
 * Geocode a free-text query via OpenStreetMap Nominatim.
 * Public API: keep requests polite (rate limiting is applied at the route layer).
 */
export async function geocode(query: string): Promise<Place[]> {
  const url = new URL("/search", config.nominatimUrl);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent": "AccessiPath/1.0 (hackathon accessibility routing; contact: team@accessipath.dev)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Nominatim responded with HTTP ${res.status}`);
  const data = (await res.json()) as NominatimResult[];
  return data
    .map((r): Place | null => {
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        id: `nom-${encodeURIComponent(r.display_name ?? "unknown").slice(0, 60)}`,
        label: r.name || (r.display_name ?? "Unknown place").split(",")[0]!,
        description: r.display_name ?? "",
        latitude: lat,
        longitude: lon,
        source: "nominatim",
      };
    })
    .filter((p): p is Place => p !== null);
}