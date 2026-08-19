import pg from "pg";
import type {
  AccessibilityPoint,
  AccessibilityReport,
  AiObservation,
  ProfilePreferences,
  RecentRoute,
  RouteMode,
  User,
  VoteDirection,
} from "../types/index.js";
import {
  applyVoteStatus,
  DEFAULT_PROFILE,
  effectiveReportStatus,
  reportToAccessibilityPoint,
} from "./store.js";

const { Pool } = pg;

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS route_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  description TEXT NOT NULL,
  geometry GEOGRAPHY(POINT, 4326) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  upvotes INT NOT NULL DEFAULT 0,
  downvotes INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
ALTER TABLE route_reports ADD COLUMN IF NOT EXISTS upvotes INT NOT NULL DEFAULT 0;
ALTER TABLE route_reports ADD COLUMN IF NOT EXISTS downvotes INT NOT NULL DEFAULT 0;
ALTER TABLE route_reports ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS route_reports_geo_idx
  ON route_reports USING GIST (geometry);

CREATE TABLE IF NOT EXISTS report_votes (
  report_id TEXT NOT NULL REFERENCES route_reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);
CREATE INDEX IF NOT EXISTS report_votes_report_idx ON report_votes (report_id);

CREATE TABLE IF NOT EXISTS ai_observations (
  id BIGSERIAL PRIMARY KEY,
  report_id TEXT,
  feature TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  model_version TEXT NOT NULL,
  all_detections JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS osm_features (
  id BIGSERIAL PRIMARY KEY,
  osm_type TEXT NOT NULL,
  osm_id BIGINT NOT NULL,
  geometry GEOGRAPHY(POINT, 4326) NOT NULL,
  tags_json JSONB NOT NULL,
  imported_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS osm_features_geo_idx
  ON osm_features USING GIST (geometry);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT 'default',
  profile_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  verification_code_hash TEXT,
  verification_expires_at TIMESTAMPTZ,
  profile_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS recent_routes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_label TEXT NOT NULL,
  start_lat NUMERIC NOT NULL,
  start_lon NUMERIC NOT NULL,
  end_label TEXT NOT NULL,
  end_lat NUMERIC NOT NULL,
  end_lon NUMERIC NOT NULL,
  mode TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recent_routes_user_idx ON recent_routes (user_id, created_at DESC);
`;

function pointGeog(lon: number, lat: number): string {
  return `SRID=4326;POINT(${lon} ${lat})`;
}

interface ReportRow {
  id: string;
  report_type: string;
  description: string;
  lat: number;
  lon: number;
  status: string;
  upvotes: string | number;
  downvotes: string | number;
  verified_at: string | null;
  photo_url: string | null;
  created_at: string;
  expires_at: string | null;
  my_vote: string | null;
}

function rowToReport(row: ReportRow): AccessibilityReport {
  return {
    id: row.id,
    type: row.report_type as AccessibilityReport["type"],
    description: row.description,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    status: row.status as AccessibilityReport["status"],
    upvotes: Number(row.upvotes ?? 0),
    downvotes: Number(row.downvotes ?? 0),
    myVote: (row.my_vote as VoteDirection | null) ?? null,
    verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : undefined,
    photoUrl: row.photo_url ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : new Date().toISOString(),
  };
}

/** Postgres/PostGIS backed store. Falls back to MemoryStore on failure (see createStore). */
export class PostgresStore {
  readonly kind = "postgres" as const;
  private pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      ssl: databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }

  async initialize(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async getAllAccessibilityPoints(): Promise<AccessibilityPoint[]> {
    const { rows } = await this.pool.query(
      `SELECT id, report_type, description, status, upvotes, downvotes, verified_at,
              photo_url, created_at, expires_at, NULL::text AS my_vote,
              ST_Y(geometry::geometry) AS lat, ST_X(geometry::geometry) AS lon
       FROM route_reports`,
    );
    const points: AccessibilityPoint[] = [];
    for (const row of rows as ReportRow[]) {
      const report = rowToReport(row);
      const status = effectiveReportStatus(report);
      if (status === "rejected" || status === "expired") continue;
      points.push(reportToAccessibilityPoint(report, status));
    }
    return points;
  }

  async getReports(userId?: string): Promise<AccessibilityReport[]> {
    const { rows } = await this.pool.query(
      `SELECT r.id, r.report_type, r.description, r.status, r.upvotes, r.downvotes,
              r.verified_at, r.photo_url, r.created_at, r.expires_at,
              v.direction AS my_vote,
              ST_Y(r.geometry::geometry) AS lat, ST_X(r.geometry::geometry) AS lon
       FROM route_reports r
       LEFT JOIN LATERAL (
         SELECT direction FROM report_votes WHERE report_id = r.id AND user_id = $1
       ) v ON true
       ORDER BY r.created_at DESC`,
      [userId ?? null],
    );
    return (rows as ReportRow[]).map((row) => {
      const report = rowToReport(row);
      report.status = effectiveReportStatus(report);
      return report;
    });
  }

  async createReport(input: {
    type: AccessibilityReport["type"];
    description: string;
    latitude: number;
    longitude: number;
    photoUrl?: string;
    aiObservation?: AiObservation;
  }): Promise<AccessibilityReport> {
    const id = `rep-${crypto.randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO route_reports
           (id, report_type, description, geometry, status, photo_url, created_at, expires_at)
         VALUES ($1,$2,$3,ST_GeogFromText($4),'pending',$5,$6,$7)`,
        [id, input.type, input.description, pointGeog(input.longitude, input.latitude), input.photoUrl ?? null, now.toISOString(), expiresAt.toISOString()],
      );
      if (input.aiObservation) {
        await client.query(
          `INSERT INTO ai_observations (report_id, feature, confidence, model_version, all_detections)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, input.aiObservation.feature, input.aiObservation.confidence, input.aiObservation.modelVersion, JSON.stringify(input.aiObservation.allDetections)],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return {
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
      expiresAt: expiresAt.toISOString(),
      aiObservation: input.aiObservation,
    };
  }

  async voteReport(
    id: string,
    userId: string,
    direction: VoteDirection,
  ): Promise<AccessibilityReport> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ direction: string }>(
        `SELECT direction FROM report_votes WHERE report_id = $1 AND user_id = $2`,
        [id, userId],
      );
      if (existing.rows[0]?.direction === direction) {
        await client.query(
          `DELETE FROM report_votes WHERE report_id = $1 AND user_id = $2`,
          [id, userId],
        );
      } else {
        await client.query(
          `INSERT INTO report_votes (report_id, user_id, direction)
           VALUES ($1,$2,$3)
           ON CONFLICT (report_id, user_id)
           DO UPDATE SET direction = EXCLUDED.direction, created_at = now()`,
          [id, userId, direction],
        );
      }
      await client.query(
        `UPDATE route_reports
         SET upvotes = (SELECT count(*) FROM report_votes WHERE report_id = $1 AND direction = 'up'),
             downvotes = (SELECT count(*) FROM report_votes WHERE report_id = $1 AND direction = 'down')
         WHERE id = $1`,
        [id],
      );
      const report = rowToReport(
        (
          await client.query(
            `SELECT id, report_type, description, status, upvotes, downvotes, verified_at,
                    photo_url, created_at, expires_at, $2::text AS my_vote,
                    ST_Y(geometry::geometry) AS lat, ST_X(geometry::geometry) AS lon
             FROM route_reports WHERE id = $1`,
            [id, direction],
          )
        ).rows[0] as ReportRow,
      );
      if (!report) throw new Error("Report not found.");
      applyVoteStatus(report);
      await client.query(
        `UPDATE route_reports SET status = $2, verified_at = $3, expires_at = $4 WHERE id = $1`,
        [id, report.status, report.verifiedAt ?? null, report.expiresAt],
      );
      await client.query("COMMIT");
      report.status = effectiveReportStatus(report);
      return report;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createAiObservation(observation: AiObservation): Promise<AiObservation> {
    await this.pool.query(
      `INSERT INTO ai_observations (report_id, feature, confidence, model_version, all_detections)
       VALUES ($1,$2,$3,$4,$5)`,
      [observation.reportId ?? null, observation.feature, observation.confidence, observation.modelVersion, JSON.stringify(observation.allDetections)],
    );
    return observation;
  }

  async getProfile(userId?: string): Promise<ProfilePreferences> {
    if (userId) {
      const { rows } = await this.pool.query<{ profile_json: string | null }>(
        `SELECT profile_json FROM users WHERE id = $1`,
        [userId],
      );
      if (rows[0]?.profile_json) {
        return { ...DEFAULT_PROFILE, ...(JSON.parse(rows[0].profile_json) as ProfilePreferences) };
      }
    }
    const { rows } = await this.pool.query<{ profile_json: string }>(
      `SELECT profile_json FROM user_preferences WHERE id = 'default'`,
    );
    if (rows.length === 0) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...(JSON.parse(rows[0]!.profile_json) as ProfilePreferences) };
  }

  async saveProfile(profile: ProfilePreferences, userId?: string): Promise<ProfilePreferences> {
    if (userId) {
      await this.pool.query(
        `UPDATE users SET profile_json = $1 WHERE id = $2`,
        [JSON.stringify(profile), userId],
      );
    } else {
      await this.pool.query(
        `INSERT INTO user_preferences (id, profile_json) VALUES ('default', $1)
         ON CONFLICT (id) DO UPDATE SET profile_json = $1, updated_at = now()`,
        [JSON.stringify(profile)],
      );
    }
    return { ...profile };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, password_hash, verified_at, verification_code_hash,
              verification_expires_at, created_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()],
    );
    return rows[0] ? this.rowToUser(rows[0]) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, password_hash, verified_at, verification_code_hash,
              verification_expires_at, created_at
       FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.rowToUser(rows[0]) : null;
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
    await this.pool.query(
      `INSERT INTO users (id, email, name, password_hash, verification_code_hash, verification_expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        input.id,
        input.email.toLowerCase(),
        input.name,
        input.passwordHash,
        input.verificationCodeHash,
        input.verificationExpiresAt,
        input.createdAt,
      ],
    );
    const user = await this.getUserById(input.id);
    if (!user) throw new Error("Failed to create user.");
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
    await this.pool.query(
      `UPDATE users
       SET verified_at = COALESCE($2, verified_at),
           verification_code_hash = $3,
           verification_expires_at = $4
       WHERE id = $1`,
      [
        id,
        patch.verifiedAt ?? null,
        patch.verificationCodeHash === undefined
          ? null
          : patch.verificationCodeHash,
        patch.verificationExpiresAt === undefined
          ? null
          : patch.verificationExpiresAt,
      ],
    );
    const user = await this.getUserById(id);
    if (!user) throw new Error("User not found.");
    return user;
  }

  async getRecentRoutes(userId: string): Promise<RecentRoute[]> {
    const { rows } = await this.pool.query(
      `SELECT id, start_label, start_lat, start_lon, end_label, end_lat, end_lon, mode, created_at
       FROM recent_routes WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      startLabel: r.start_label,
      startLatitude: Number(r.start_lat),
      startLongitude: Number(r.start_lon),
      endLabel: r.end_label,
      endLatitude: Number(r.end_lat),
      endLongitude: Number(r.end_lon),
      mode: r.mode as RouteMode,
      createdAt: new Date(r.created_at).toISOString(),
    }));
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
    // Remove older duplicates of the same start/end pair.
    await this.pool.query(
      `DELETE FROM recent_routes
       WHERE user_id = $1
         AND start_lat = $2 AND start_lon = $3
         AND end_lat = $4 AND end_lon = $5`,
      [
        userId,
        input.startLatitude,
        input.startLongitude,
        input.endLatitude,
        input.endLongitude,
      ],
    );
    await this.pool.query(
      `INSERT INTO recent_routes
         (id, user_id, start_label, start_lat, start_lon, end_label, end_lat, end_lon, mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        crypto.randomUUID(),
        userId,
        input.startLabel,
        input.startLatitude,
        input.startLongitude,
        input.endLabel,
        input.endLatitude,
        input.endLongitude,
        input.mode,
      ],
    );
    // Trim to the 10 most recent.
    await this.pool.query(
      `DELETE FROM recent_routes
       WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM recent_routes WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 10
       )`,
      [userId],
    );
    const [saved] = await this.getRecentRoutes(userId);
    if (!saved) throw new Error("Failed to save recent route.");
    return saved;
  }

  private rowToUser(row: {
    id: string;
    email: string;
    name: string;
    password_hash: string;
    verified_at: string | null;
    verification_code_hash: string | null;
    verification_expires_at: string | null;
    created_at: string;
  }): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : undefined,
      verificationCodeHash: row.verification_code_hash ?? undefined,
      verificationExpiresAt: row.verification_expires_at
        ? new Date(row.verification_expires_at).toISOString()
        : undefined,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}