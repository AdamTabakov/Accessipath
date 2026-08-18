import pg from "pg";
import type {
  AccessibilityPoint,
  AccessibilityReport,
  AiObservation,
  Building,
  Place,
  ProfilePreferences,
  User,
} from "../types/index.js";
import { TMU_BUILDINGS, TMU_ACCESSIBILITY_POINTS } from "../data/tmuAccessibility.js";
import { DEMO_REPORTS } from "../data/demoReports.js";
import { DEFAULT_PLACES } from "../data/places.js";
import { DEFAULT_PROFILE, reportTypeToPoint } from "./store.js";

const { Pool } = pg;

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  address TEXT NOT NULL,
  geometry GEOGRAPHY(POINT, 4326) NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accessibility_points (
  id TEXT PRIMARY KEY,
  building_id TEXT REFERENCES buildings(id),
  type TEXT NOT NULL,
  geometry GEOGRAPHY(POINT, 4326) NOT NULL,
  ramp BOOLEAN,
  elevator BOOLEAN,
  stairs BOOLEAN,
  automatic_door BOOLEAN,
  wheelchair TEXT,
  surface TEXT,
  incline TEXT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0.5,
  verified_at TIMESTAMPTZ,
  is_temporary BOOLEAN DEFAULT FALSE,
  severity TEXT,
  expires_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accessibility_points_geo_idx
  ON accessibility_points USING GIST (geometry);

CREATE TABLE IF NOT EXISTS route_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  description TEXT NOT NULL,
  geometry GEOGRAPHY(POINT, 4326) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS route_reports_geo_idx
  ON route_reports USING GIST (geometry);

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
`;

function pointGeog(lon: number, lat: number): string {
  return `SRID=4326;POINT(${lon} ${lat})`;
}

interface PointRow {
  id: string;
  building_name: string | null;
  type: string;
  lat: number;
  lon: number;
  ramp: boolean | null;
  elevator: boolean | null;
  stairs: boolean | null;
  automatic_door: boolean | null;
  wheelchair: string | null;
  surface: string | null;
  incline: string | null;
  source_type: string;
  source_url: string | null;
  confidence: string | number;
  verified_at: string | null;
  is_temporary: boolean | null;
  severity: string | null;
  expires_at: string | null;
  description: string | null;
}

function rowToPoint(row: PointRow): AccessibilityPoint {
  return {
    id: row.id,
    buildingName: row.building_name ?? undefined,
    type: row.type as AccessibilityPoint["type"],
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    ramp: row.ramp ?? undefined,
    elevator: row.elevator ?? undefined,
    stairs: row.stairs ?? undefined,
    automaticDoor: row.automatic_door ?? undefined,
    wheelchair: (row.wheelchair as AccessibilityPoint["wheelchair"]) ?? undefined,
    surface: (row.surface as AccessibilityPoint["surface"]) ?? undefined,
    incline: (row.incline as AccessibilityPoint["incline"]) ?? undefined,
    sourceType: row.source_type as AccessibilityPoint["sourceType"],
    sourceUrl: row.source_url ?? undefined,
    confidence: Number(row.confidence),
    verifiedAt: row.verified_at ?? undefined,
    isTemporary: row.is_temporary ?? undefined,
    severity: (row.severity as AccessibilityPoint["severity"]) ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    description: row.description ?? undefined,
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
    const { rows } = await this.pool.query<{ c: string }>("SELECT count(*)::text AS c FROM buildings");
    if (Number(rows[0]?.c ?? 0) === 0) {
      await this.seed();
    }
  }

  private async seed(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const b of TMU_BUILDINGS) {
        await client.query(
          `INSERT INTO buildings (id, name, short_name, address, geometry, source_url, source_type, notes)
           VALUES ($1,$2,$3,$4,ST_GeogFromText($5),$6,$7,$8)
           ON CONFLICT (id) DO NOTHING`,
          [b.id, b.name, b.shortName, b.address, pointGeog(b.longitude, b.latitude), b.sourceUrl, b.sourceType, b.notes],
        );
      }
      for (const p of TMU_ACCESSIBILITY_POINTS) {
        const building = TMU_BUILDINGS.find((b) => b.name === p.buildingName);
        await client.query(
          `INSERT INTO accessibility_points
             (id, building_id, type, geometry, ramp, elevator, stairs, automatic_door,
              wheelchair, surface, incline, source_type, source_url, confidence, verified_at,
              is_temporary, severity, expires_at, description)
           VALUES ($1,$2,$3,ST_GeogFromText($4),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            building?.id ?? null,
            p.type,
            pointGeog(p.longitude, p.latitude),
            p.ramp ?? null,
            p.elevator ?? null,
            p.stairs ?? null,
            p.automaticDoor ?? null,
            p.wheelchair ?? null,
            p.surface ?? null,
            p.incline ?? null,
            p.sourceType,
            p.sourceUrl ?? null,
            p.confidence,
            p.verifiedAt ?? null,
            p.isTemporary ?? null,
            p.severity ?? null,
            p.expiresAt ?? null,
            p.description ?? null,
          ],
        );
      }
      for (const r of DEMO_REPORTS) {
        await client.query(
          `INSERT INTO route_reports (id, report_type, description, geometry, status, photo_url, created_at, expires_at)
           VALUES ($1,$2,$3,ST_GeogFromText($4),$5,$6,$7,$8)
           ON CONFLICT (id) DO NOTHING`,
          [r.id, r.type, r.description, pointGeog(r.longitude, r.latitude), r.status, r.photoUrl ?? null, r.createdAt, r.expiresAt],
        );
      }
      await client.query(
        `INSERT INTO user_preferences (id, profile_json) VALUES ('default', $1) ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(DEFAULT_PROFILE)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async searchPlaces(query: string): Promise<Place[]> {
    const q = query.trim().toLowerCase();
    const list = q ? DEFAULT_PLACES.filter((p) => (p.label + " " + p.description).toLowerCase().includes(q)) : DEFAULT_PLACES;
    return list.slice(0, 8);
  }

  async getBuildings(): Promise<Building[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, short_name, address, source_url, source_type, notes,
              ST_Y(geometry::geometry) AS lat, ST_X(geometry::geometry) AS lon
       FROM buildings ORDER BY name`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      shortName: r.short_name,
      address: r.address,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      sourceUrl: r.source_url ?? "",
      sourceType: r.source_type,
      notes: r.notes ?? undefined,
    }));
  }

  async getBuilding(id: string): Promise<Building | null> {
    const { rows } = await this.pool.query(
      `SELECT id, name, short_name, address, source_url, source_type, notes,
              ST_Y(geometry::geometry) AS lat, ST_X(geometry::geometry) AS lon
       FROM buildings WHERE id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      shortName: r.short_name,
      address: r.address,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      sourceUrl: r.source_url ?? "",
      sourceType: r.source_type,
      notes: r.notes ?? undefined,
    };
  }

  async getAllAccessibilityPoints(): Promise<AccessibilityPoint[]> {
    const { rows } = await this.pool.query(
      `SELECT p.*, b.name AS building_name, ST_Y(p.geometry::geometry) AS lat, ST_X(p.geometry::geometry) AS lon
       FROM accessibility_points p LEFT JOIN buildings b ON b.id = p.building_id`,
    );
    return rows.map(rowToPoint);
  }

  async getAccessibilityPointsNear(
    lat: number,
    lon: number,
    radiusM: number,
  ): Promise<AccessibilityPoint[]> {
    const { rows } = await this.pool.query(
      `SELECT p.*, b.name AS building_name, ST_Y(p.geometry::geometry) AS lat, ST_X(p.geometry::geometry) AS lon
       FROM accessibility_points p LEFT JOIN buildings b ON b.id = p.building_id
       WHERE ST_DWithin(p.geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ORDER BY p.geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography`,
      [lon, lat, radiusM],
    );
    return rows.map(rowToPoint);
  }

  async getReports(): Promise<AccessibilityReport[]> {
    const { rows } = await this.pool.query(
      `SELECT id, report_type, description, status, photo_url, created_at, expires_at,
              ST_Y(geometry::geometry) AS lat, ST_X(geometry::geometry) AS lon
       FROM route_reports ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.report_type,
      description: r.description,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      status: r.status,
      photoUrl: r.photo_url ?? undefined,
      createdAt: new Date(r.created_at).toISOString(),
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : "",
    }));
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
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO route_reports (id, report_type, description, geometry, status, photo_url, created_at, expires_at)
         VALUES ($1,$2,$3,ST_GeogFromText($4),'pending',$5,$6,$7)`,
        [id, input.type, input.description, pointGeog(input.longitude, input.latitude), input.photoUrl ?? null, now.toISOString(), expiresAt.toISOString()],
      );
      const point = reportTypeToPoint({
        id: `point-${id}`,
        type: input.type,
        latitude: input.latitude,
        longitude: input.longitude,
        description: input.description,
      });
      await client.query(
        `INSERT INTO accessibility_points
           (id, type, geometry, ramp, elevator, stairs, wheelchair, surface, source_type,
            confidence, is_temporary, severity, expires_at, description)
         VALUES ($1,$2,ST_GeogFromText($3),$4,$5,$6,$7,$8,'community',0.5,$9,$10,$11,$12)`,
        [
          point.id,
          point.type,
          pointGeog(input.longitude, input.latitude),
          point.ramp ?? null,
          point.elevator ?? null,
          point.stairs ?? null,
          point.wheelchair ?? null,
          point.surface ?? null,
          point.isTemporary ?? null,
          point.severity ?? null,
          point.expiresAt ?? null,
          point.description ?? null,
        ],
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
      photoUrl: input.photoUrl,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      aiObservation: input.aiObservation,
    };
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