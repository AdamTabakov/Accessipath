import type { Coordinates } from "../types/index.js";

export const EARTH_RADIUS_M = 6371000;

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in metres. */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Approximate local planar coordinates (metres) relative to an origin. */
function toLocalXY(p: Coordinates, origin: Coordinates): { x: number; y: number } {
  const x =
    (p.longitude - origin.longitude) *
    EARTH_RADIUS_M *
    Math.cos(toRadians(origin.latitude)) *
    (Math.PI / 180);
  const y = (p.latitude - origin.latitude) * EARTH_RADIUS_M * (Math.PI / 180);
  return { x, y };
}

/** Distance from a point to a segment [a, b], in metres. */
export function pointToSegmentDistanceM(
  p: Coordinates,
  a: Coordinates,
  b: Coordinates,
): number {
  const A = { x: 0, y: 0 };
  const B = toLocalXY(b, a);
  const P = toLocalXY(p, a);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + t * dx;
  const cy = A.y + t * dy;
  return Math.hypot(P.x - cx, P.y - cy);
}

/** Minimum distance from a point to a polyline, in metres. */
export function pointToPolylineDistanceM(
  p: Coordinates,
  polyline: Coordinates[],
): number {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  if (polyline.length === 1) return haversineDistance(p, polyline[0]!);
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentDistanceM(p, polyline[i]!, polyline[i + 1]!);
    if (d < min) min = d;
  }
  return min;
}

/** Total length of a polyline in metres. */
export function polylineLengthM(polyline: Coordinates[]): number {
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineDistance(polyline[i]!, polyline[i + 1]!);
  }
  return total;
}

/** Sample a polyline every `intervalM` metres, including the final point. */
export function resamplePolyline(
  polyline: Coordinates[],
  intervalM: number,
): Coordinates[] {
  if (polyline.length === 0) return [];
  const samples: Coordinates[] = [polyline[0]!];
  let carried = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i]!;
    const b = polyline[i + 1]!;
    const segLen = haversineDistance(a, b);
    let travelled = carried;
    while (travelled < segLen) {
      const t = travelled / segLen;
      samples.push({
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      });
      travelled += intervalM;
    }
    carried = travelled - segLen;
  }
  const last = polyline[polyline.length - 1]!;
  const prev = samples[samples.length - 1]!;
  if (haversineDistance(prev, last) > 1) samples.push(last);
  return samples;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}