import type {
  AccessibilityPoint,
  AccessibilityReport,
  AiObservation,
  AuthUserResponse,
  Place,
  ProfilePreferences,
  RouteMode,
  RoutesResponse,
  SafeUser,
  SignupResponse,
  VerifyResponse,
} from "../types/index.js";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const TOKEN_KEY = "accessipath.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // storage unavailable - the session simply won't persist across reloads
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok) {
    const message = data?.error ?? "Something went wrong. Please try again.";
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
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

export function signup(input: {
  email: string;
  name: string;
  password: string;
}): Promise<SignupResponse> {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyEmail(input: {
  email: string;
  code: string;
}): Promise<VerifyResponse> {
  return request("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resendVerificationCode(email: string): Promise<{ ok: boolean; devCode?: string }> {
  return request("/api/auth/resend", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function login(input: {
  email: string;
  password: string;
}): Promise<AuthUserResponse> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMe(): Promise<{ user: SafeUser }> {
  return request("/api/auth/me");
}