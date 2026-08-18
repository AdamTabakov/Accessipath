import type {
  AccessibilityPoint,
  AccessibilityReport,
  AiObservation,
  Place,
  ProfilePreferences,
  RouteMode,
  RoutesResponse,
} from "../types/index.js";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok) {
    const message = data?.error ?? "Something went wrong. Please try again.";
    throw new Error(message);
  }
  if (data === null) throw new Error("Unexpected empty response.");
  return data;
}

export interface RouteRequestParams {
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  profile: ProfilePreferences;
  mode: RouteMode;
}

export function getRoutes(params: RouteRequestParams): Promise<RoutesResponse> {
  const q = new URLSearchParams({
    start: `${params.start.latitude},${params.start.longitude}`,
    end: `${params.end.latitude},${params.end.longitude}`,
    profile: params.profile.mobilityProfile,
    mode: params.mode,
    avoid_stairs: String(params.profile.avoidStairs),
    prefer_ramps: String(params.profile.preferRamps),
    prefer_elevators: String(params.profile.preferElevators),
    max_slope: params.profile.maxSlope,
    max_walk_meters: String(params.profile.maxWalkDistanceMeters),
  });
  return request<RoutesResponse>(`/api/routes?${q.toString()}`);
}

export function getPlaces(query: string): Promise<{ results: Place[] }> {
  return request(`/api/places?q=${encodeURIComponent(query)}`);
}

export function geocode(query: string): Promise<{ results: Place[] }> {
  return request(`/api/geocode?q=${encodeURIComponent(query)}`);
}

export function getNearby(
  lat: number,
  lon: number,
  radius = 150,
): Promise<{ points: AccessibilityPoint[] }> {
  return request(`/api/accessibility/nearby?lat=${lat}&lon=${lon}&radius=${radius}`);
}

export function getReports(): Promise<{ reports: AccessibilityReport[] }> {
  return request("/api/reports");
}

export function createReport(input: {
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  photo?: string;
  aiObservation?: AiObservation;
}): Promise<{ report: AccessibilityReport }> {
  return request("/api/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getProfile(): Promise<{ profile: ProfilePreferences }> {
  return request("/api/profile");
}

export function saveProfile(
  profile: ProfilePreferences,
): Promise<{ profile: ProfilePreferences }> {
  return request("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}