import { randomUUID } from "node:crypto";
import type {
  AccessibilityPoint,
  AccessibilityReport,
  AiObservation,
  Building,
  Coordinates,
  Place,
  ProfilePreferences,
  ReportStatus,
  ReportType,
} from "../types/index.js";
import { TMU_BUILDINGS, TMU_ACCESSIBILITY_POINTS } from "../data/tmuAccessibility.js";
import { DEMO_REPORTS } from "../data/demoReports.js";
import { TMU_PLACES } from "../data/places.js";
import { haversineDistance } from "../utils/spatial.js";

export const DEFAULT_PROFILE: ProfilePreferences = {
  mobilityProfile: "wheelchair",
  avoidStairs: true,
  preferRamps: true,
  preferElevators: true,
  maxSlope: "moderate",
  preferSmoothSurface: true,
  maxWalkDistanceMeters: 2000,
};

export interface DataStore {
  readonly kind: "memory" | "postgres";
  searchPlaces(query: string): Promise<Place[]>;
  getBuildings(): Promise<Building[]>;
  getBuilding(id: string): Promise<Building | null>;
  getAllAccessibilityPoints(): Promise<AccessibilityPoint[]>;
  getAccessibilityPointsNear(lat: number, lon: number, radiusM: number): Promise<AccessibilityPoint[]>;
  getReports(): Promise<AccessibilityReport[]>;
  createReport(input: {
    type: ReportType;
    description: string;
    latitude: number;
    longitude: number;
    photoUrl?: string;
    aiObservation?: AiObservation;
  }): Promise<AccessibilityReport>;
  createAiObservation(observation: AiObservation): Promise<AiObservation>;
  getProfile(): Promise<ProfilePreferences>;
  saveProfile(profile: ProfilePreferences): Promise<ProfilePreferences>;
}

function reportTypeToPoint(input: {
  type: ReportType;
  latitude: number;
  longitude: number;
  description: string;
  id: string;
}): AccessibilityPoint {
  const base = {
    id: input.id,
    latitude: input.latitude,
    longitude: input.longitude,
    description: input.description,
    sourceType: "community" as const,
    isTemporary: true,
    confidence: 0.5,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  switch (input.type) {
    case "broken_elevator":
      return {
        ...base,
        type: "elevator",
        elevator: true,
        wheelchair: "inaccessible",
        severity: "warning",
      };
    case "blocked_ramp":
      return { ...base, type: "obstacle", wheelchair: "inaccessible", severity: "blocked" };
    case "stairs":
      return { ...base, type: "stairs", stairs: true, wheelchair: "inaccessible", severity: "warning" };
    case "construction":
      return { ...base, type: "obstacle", surface: "rough", wheelchair: "unknown", severity: "warning" };
    case "surface_issue":
      return { ...base, type: "obstacle", surface: "rough", wheelchair: "unknown", severity: "warning" };
    case "obstacle":
      return { ...base, type: "obstacle", wheelchair: "unknown", severity: "warning" };
    default:
      return { ...base, type: "other", wheelchair: "unknown", severity: "warning" };
  }
}

export class MemoryStore implements DataStore {
  readonly kind = "memory" as const;

  private buildings: Building[] = TMU_BUILDINGS;
  private places: Place[] = TMU_PLACES;
  private points: AccessibilityPoint[] = [...TMU_ACCESSIBILITY_POINTS];
  private reports: AccessibilityReport[] = [...DEMO_REPORTS];
  private profile: ProfilePreferences = { ...DEFAULT_PROFILE };

  async searchPlaces(query: string): Promise<Place[]> {
    const q = query.trim().toLowerCase();
    if (!q) return this.places.slice(0, 6);
    return this.places
      .filter((p) => (p.label + " " + p.description).toLowerCase().includes(q))
      .slice(0, 8);
  }

  async getBuildings(): Promise<Building[]> {
    return this.buildings;
  }

  async getBuilding(id: string): Promise<Building | null> {
    return this.buildings.find((b) => b.id === id) ?? null;
  }

  async getAllAccessibilityPoints(): Promise<AccessibilityPoint[]> {
    return this.points;
  }

  async getAccessibilityPointsNear(lat: number, lon: number, radiusM: number): Promise<AccessibilityPoint[]> {
    const origin: Coordinates = { latitude: lat, longitude: lon };
    return this.points.filter(
      (p) => haversineDistance(origin, { latitude: p.latitude, longitude: p.longitude }) <= radiusM,
    );
  }

  async getReports(): Promise<AccessibilityReport[]> {
    return this.reports.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createReport(input: {
    type: ReportType;
    description: string;
    latitude: number;
    longitude: number;
    photoUrl?: string;
    aiObservation?: AiObservation;
  }): Promise<AccessibilityReport> {
    const id = randomUUID();
    const now = new Date();
    const report: AccessibilityReport = {
      id,
      type: input.type,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      status: "pending",
      photoUrl: input.photoUrl,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      aiObservation: input.aiObservation,
    };
    this.reports.unshift(report);
    this.points.unshift(
      reportTypeToPoint({
        id: `rep-${id}`,
        type: input.type,
        latitude: input.latitude,
        longitude: input.longitude,
        description: input.description,
      }),
    );
    return report;
  }

  async createAiObservation(observation: AiObservation): Promise<AiObservation> {
    return observation;
  }

  async getProfile(): Promise<ProfilePreferences> {
    return { ...this.profile };
  }

  async saveProfile(profile: ProfilePreferences): Promise<ProfilePreferences> {
    this.profile = { ...profile };
    return this.getProfile();
  }
}

function mapReportStatus(value: string): ReportStatus {
  if (value === "verified" || value === "rejected" || value === "expired" || value === "pending") {
    return value;
  }
  return "pending";
}

export async function createStore(): Promise<DataStore> {
  const { config } = await import("../config.js");
  if (config.databaseUrl) {
    try {
      const { PostgresStore } = await import("./postgres.js");
      const store = new PostgresStore(config.databaseUrl);
      await store.initialize();
      return store;
    } catch (error) {
      console.error(
        "[store] Postgres unavailable - falling back to in-memory store:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  return new MemoryStore();
}

export { mapReportStatus, reportTypeToPoint };