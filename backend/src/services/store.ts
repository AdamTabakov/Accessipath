import { randomUUID } from "node:crypto";
import type {
  AccessibilityPoint,
  AccessibilityReport,
  AiObservation,
  ProfilePreferences,
  RecentRoute,
  ReportStatus,
  ReportType,
  RouteMode,
  User,
  VoteDirection,
} from "../types/index.js";

export const DEFAULT_PROFILE: ProfilePreferences = {
  mobilityProfile: "wheelchair",
  avoidStairs: true,
  preferRamps: true,
  preferElevators: true,
  maxSlope: "moderate",
  preferSmoothSurface: true,
  maxWalkDistanceMeters: 2000,
};

/** How long a report lives before it expires (unless it is verified). */
export const REPORT_LIFETIME_DAYS = 90;
/** How long a verified report stays verified before decaying back to pending. */
export const VERIFIED_LIFETIME_DAYS = 90;
/** Upvotes needed (with >= 2:1 up:down ratio) to verify a report. */
export const VERIFY_UPVOTES = 3;
/** Downvotes needed to reject a report (when downvotes outnumber upvotes). */
export const REJECT_DOWNVOTES = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DataStore {
  readonly kind: "memory" | "postgres";
  getAllAccessibilityPoints(): Promise<AccessibilityPoint[]>;
  getReports(userId?: string): Promise<AccessibilityReport[]>;
  createReport(input: {
    type: ReportType;
    description: string;
    latitude: number;
    longitude: number;
    photoUrl?: string;
    aiObservation?: AiObservation;
  }): Promise<AccessibilityReport>;
  voteReport(
    id: string,
    userId: string,
    direction: VoteDirection,
  ): Promise<AccessibilityReport>;
  createAiObservation(observation: AiObservation): Promise<AiObservation>;
  getProfile(userId?: string): Promise<ProfilePreferences>;
  saveProfile(profile: ProfilePreferences, userId?: string): Promise<ProfilePreferences>;
  findUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(input: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    verificationCodeHash: string;
    verificationExpiresAt: string;
    createdAt: string;
  }): Promise<User>;
  updateUser(
    id: string,
    patch: {
      verifiedAt?: string;
      verificationCodeHash?: string | null;
      verificationExpiresAt?: string | null;
    },
  ): Promise<User>;
  getRecentRoutes(userId: string): Promise<RecentRoute[]>;
  addRecentRoute(
    userId: string,
    input: {
      startLabel: string;
      startLatitude: number;
      startLongitude: number;
      endLabel: string;
      endLatitude: number;
      endLongitude: number;
      mode: RouteMode;
    },
  ): Promise<RecentRoute>;
}

function reportTypeToPoint(input: {
  type: ReportType;
  latitude: number;
  longitude: number;
  description: string;
  id: string;
  photoUrl?: string;
}): AccessibilityPoint {
  const base = {
    id: input.id,
    latitude: input.latitude,
    longitude: input.longitude,
    description: input.description,
    sourceType: "community" as const,
    isTemporary: true,
    confidence: 0.5,
    photoUrl: input.photoUrl,
    expiresAt: new Date(Date.now() + REPORT_LIFETIME_DAYS * DAY_MS).toISOString(),
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

/**
 * Convert a report into an accessibility point using its *effective* status.
 * Rejected and expired reports are never turned into points, so they cannot
 * influence routing. Verified reports get higher confidence and a verifiedAt
 * stamp, which flows through to evidence and confidence scoring.
 */
export function reportToAccessibilityPoint(
  report: AccessibilityReport,
  status: ReportStatus,
): AccessibilityPoint {
  const point = reportTypeToPoint({
    id: `point-${report.id}`,
    type: report.type,
    latitude: report.latitude,
    longitude: report.longitude,
    description: report.description,
    photoUrl: report.photoUrl,
  });
  const verified = status === "verified";
  point.confidence = verified ? 0.85 : 0.5;
  point.verifiedAt = verified && report.verifiedAt ? report.verifiedAt : undefined;
  return point;
}

/**
 * Effective status of a report at a given time. Rejected stays rejected.
 * Verified decays back to "pending" after VERIFIED_LIFETIME_DAYS (time decay);
 * the extended expiresAt keeps it visible for re-verification. Pending reports
 * expire after their lifetime unless they are verified (which resets it).
 */
export function effectiveReportStatus(
  report: AccessibilityReport,
  now: Date = new Date(),
): ReportStatus {
  if (report.status === "rejected") return "rejected";
  if (report.status === "verified" && report.verifiedAt) {
    const decayAt = new Date(
      new Date(report.verifiedAt).getTime() + VERIFIED_LIFETIME_DAYS * DAY_MS,
    );
    return now > decayAt ? "pending" : "verified";
  }
  if (now > new Date(report.expiresAt)) return "expired";
  return report.status;
}

/**
 * Recompute a report's status from its vote counts. Called after every vote.
 * Verification also resets the report lifetime so confirmed reports live on.
 */
export function applyVoteStatus(report: AccessibilityReport): void {
  if (report.downvotes >= REJECT_DOWNVOTES && report.downvotes > report.upvotes) {
    report.status = "rejected";
    report.verifiedAt = undefined;
    return;
  }
  if (report.upvotes >= VERIFY_UPVOTES && report.upvotes >= 2 * report.downvotes) {
    if (report.status !== "verified") {
      report.status = "verified";
      report.verifiedAt = new Date().toISOString();
      report.expiresAt = new Date(
        new Date(report.verifiedAt).getTime() + VERIFIED_LIFETIME_DAYS * DAY_MS,
      ).toISOString();
    }
    return;
  }
  report.status = "pending";
  report.verifiedAt = undefined;
}

export class MemoryStore implements DataStore {
  readonly kind = "memory" as const;

  private reports: AccessibilityReport[] = [];
  private reportVotes = new Map<string, Map<string, VoteDirection>>();
  private profile: ProfilePreferences = { ...DEFAULT_PROFILE };
  private profiles: Map<string, ProfilePreferences> = new Map();
  private usersByEmail: Map<string, User> = new Map();
  private usersById: Map<string, User> = new Map();
  private recentRoutes: Map<string, RecentRoute[]> = new Map();

  async getAllAccessibilityPoints(): Promise<AccessibilityPoint[]> {
    const points: AccessibilityPoint[] = [];
    for (const report of this.reports) {
      const status = effectiveReportStatus(report);
      if (status === "rejected" || status === "expired") continue;
      points.push(reportToAccessibilityPoint(report, status));
    }
    return points;
  }

  async getReports(userId?: string): Promise<AccessibilityReport[]> {
    return this.reports
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => {
        const votes = this.reportVotes.get(r.id) ?? new Map<string, VoteDirection>();
        let upvotes = 0;
        let downvotes = 0;
        for (const direction of votes.values()) {
          if (direction === "up") upvotes += 1;
          else downvotes += 1;
        }
        const copy: AccessibilityReport = {
          ...r,
          upvotes,
          downvotes,
          myVote: userId ? (votes.get(userId) ?? null) : null,
          status: effectiveReportStatus(r),
        };
        return copy;
      });
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
      upvotes: 0,
      downvotes: 0,
      myVote: null,
      photoUrl: input.photoUrl,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + REPORT_LIFETIME_DAYS * DAY_MS).toISOString(),
      aiObservation: input.aiObservation,
    };
    this.reports.unshift(report);
    return report;
  }

  async voteReport(
    id: string,
    userId: string,
    direction: VoteDirection,
  ): Promise<AccessibilityReport> {
    const report = this.reports.find((r) => r.id === id);
    if (!report) throw new Error("Report not found.");
    let userVotes = this.reportVotes.get(id);
    if (!userVotes) {
      userVotes = new Map<string, VoteDirection>();
      this.reportVotes.set(id, userVotes);
    }
    if (userVotes.get(userId) === direction) {
      userVotes.delete(userId);
    } else {
      userVotes.set(userId, direction);
    }
    const votes = this.reportVotes.get(id) ?? new Map<string, VoteDirection>();
    let upvotes = 0;
    let downvotes = 0;
    for (const value of votes.values()) {
      if (value === "up") upvotes += 1;
      else downvotes += 1;
    }
    report.upvotes = upvotes;
    report.downvotes = downvotes;
    applyVoteStatus(report);
    return { ...report, myVote: userVotes.get(userId) ?? null };
  }

  async createAiObservation(observation: AiObservation): Promise<AiObservation> {
    return observation;
  }

  async getProfile(userId?: string): Promise<ProfilePreferences> {
    if (userId) {
      const saved = this.profiles.get(userId);
      if (saved) return { ...saved };
    }
    return { ...this.profile };
  }

  async saveProfile(profile: ProfilePreferences, userId?: string): Promise<ProfilePreferences> {
    if (userId) {
      this.profiles.set(userId, { ...profile });
      return this.getProfile(userId);
    }
    this.profile = { ...profile };
    return this.getProfile();
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email.toLowerCase()) ?? null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.usersById.get(id) ?? null;
  }

  async createUser(input: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    verificationCodeHash: string;
    verificationExpiresAt: string;
    createdAt: string;
  }): Promise<User> {
    const user: User = {
      id: input.id,
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      verificationCodeHash: input.verificationCodeHash,
      verificationExpiresAt: input.verificationExpiresAt,
      createdAt: input.createdAt,
    };
    this.usersByEmail.set(user.email, user);
    this.usersById.set(user.id, user);
    return user;
  }

  async updateUser(
    id: string,
    patch: {
      verifiedAt?: string;
      verificationCodeHash?: string | null;
      verificationExpiresAt?: string | null;
    },
  ): Promise<User> {
    const existing = this.usersById.get(id);
    if (!existing) throw new Error("User not found.");
    const updated: User = {
      ...existing,
      ...(patch.verifiedAt !== undefined ? { verifiedAt: patch.verifiedAt } : {}),
      ...(patch.verificationCodeHash !== undefined
        ? { verificationCodeHash: patch.verificationCodeHash ?? undefined }
        : {}),
      ...(patch.verificationExpiresAt !== undefined
        ? { verificationExpiresAt: patch.verificationExpiresAt ?? undefined }
        : {}),
    };
    this.usersByEmail.set(updated.email, updated);
    this.usersById.set(id, updated);
    return updated;
  }

  async getRecentRoutes(userId: string): Promise<RecentRoute[]> {
    return this.recentRoutes.get(userId)?.slice() ?? [];
  }

  async addRecentRoute(
    userId: string,
    input: {
      startLabel: string;
      startLatitude: number;
      startLongitude: number;
      endLabel: string;
      endLatitude: number;
      endLongitude: number;
      mode: RouteMode;
    },
  ): Promise<RecentRoute> {
    const route: RecentRoute = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    const existing = this.recentRoutes.get(userId) ?? [];
    // De-duplicate identical start/end pairs, keeping the latest.
    const filtered = existing.filter(
      (r) =>
        !(
          r.startLatitude === input.startLatitude &&
          r.startLongitude === input.startLongitude &&
          r.endLatitude === input.endLatitude &&
          r.endLongitude === input.endLongitude
        ),
    );
    const next = [route, ...filtered].slice(0, 10);
    this.recentRoutes.set(userId, next);
    return route;
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

export { mapReportStatus };