"""PostgreSQL/PostGIS backed store (port of the Node PostgresStore).

The schema is identical to the Node version so existing databases keep
working. Falls back to MemoryStore on failure (see create_store)."""

import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from ..schemas import (
    AccessibilityPoint,
    AccessibilityReport,
    AiObservation,
    ProfilePreferences,
    RecentRoute,
    RouteMode,
    User,
    VoteDirection,
)
from .store import (
    DEFAULT_PROFILE,
    apply_vote_status,
    effective_report_status,
    report_to_accessibility_point,
)

SCHEMA = """
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
"""

REPORT_LIFETIME = timedelta(days=90)


def _point_geog(lon: float, lat: float) -> str:
    return f"SRID=4326;POINT({lon} {lat})"


def _iso(value) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return str(value)


def _iso_opt(value) -> str | None:
    return _iso(value) if value is not None else None


def _num(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _json_dumps_model(value: Any) -> str:
    if hasattr(value, "model_dump"):
        value = value.model_dump()
    if isinstance(value, list):
        value = [item.model_dump() if hasattr(item, "model_dump") else item for item in value]
    return json.dumps(value)


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str | bytes | bytearray):
        loaded = json.loads(value)
        return loaded if isinstance(loaded, dict) else {}
    return {}


def _row_to_report(row: dict) -> AccessibilityReport:
    return AccessibilityReport(
        id=row["id"],
        type=row["report_type"],
        description=row["description"],
        latitude=_float(row.get("lat")),
        longitude=_float(row.get("lon")),
        status=row["status"],
        upvotes=_num(row.get("upvotes")),
        downvotes=_num(row.get("downvotes")),
        myVote=row.get("my_vote") or None,
        verifiedAt=_iso_opt(row.get("verified_at")),
        photoUrl=row.get("photo_url"),
        createdAt=_iso(row.get("created_at")),
        expiresAt=_iso(row.get("expires_at") or datetime.now(timezone.utc)),
    )


class PostgresStore:
    kind = "postgres"

    def __init__(self, database_url: str) -> None:
        self.pool: Optional[AsyncConnectionPool] = None
        self._database_url = database_url
        self.points_cache: Optional[tuple[list[AccessibilityPoint], float]] = None
        self.points_cache_ttl_ms = 20_000

    async def initialize(self) -> None:
        self.pool = AsyncConnectionPool(
            self._database_url,
            min_size=1,
            max_size=10,
            kwargs={
                "row_factory": dict_row,
                "autocommit": False,
            },
            open=False,
        )
        await self.pool.open()
        async with self.pool.connection() as conn:
            async with conn.transaction():
                await conn.execute(SCHEMA)
        await self.invalidate_accessibility_points()

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None

    def _pool(self) -> AsyncConnectionPool:
        if self.pool is None:
            raise RuntimeError("PostgresStore not initialized.")
        return self.pool

    async def _execute(self, sql: str, params: tuple[Any, ...] | None = None) -> None:
        async with self._pool().connection() as conn:
            await conn.execute(sql, params)

    async def _fetchone(self, sql: str, params: tuple[Any, ...] | None = None) -> dict | None:
        async with self._pool().connection() as conn:
            cursor = await conn.execute(sql, params)
            return await cursor.fetchone()

    async def _fetchall(self, sql: str, params: tuple[Any, ...] | None = None) -> list[dict]:
        async with self._pool().connection() as conn:
            cursor = await conn.execute(sql, params)
            return await cursor.fetchall()

    async def get_all_accessibility_points(self) -> list[AccessibilityPoint]:
        if self.points_cache and time.time() * 1000 - self.points_cache[1] < self.points_cache_ttl_ms:
            return self.points_cache[0]
        rows = await self._fetchall(
            "SELECT id, report_type, description, status, upvotes, downvotes, verified_at, "
            "photo_url, created_at, expires_at, NULL::text AS my_vote, "
            "ST_Y(geometry::geometry) AS lat, ST_X(geometry::geometry) AS lon "
            "FROM route_reports"
        )
        points: list[AccessibilityPoint] = []
        for row in rows:
            report = _row_to_report(row)
            status = effective_report_status(report)
            if status in ("rejected", "expired"):
                continue
            points.append(report_to_accessibility_point(report, status))
        self.points_cache = (points, time.time() * 1000)
        return points

    async def invalidate_accessibility_points(self) -> None:
        self.points_cache = None

    async def get_reports(self, user_id: str | None = None) -> list[AccessibilityReport]:
        rows = await self._fetchall(
            "SELECT r.id, r.report_type, r.description, r.status, r.upvotes, r.downvotes, "
            "r.verified_at, r.photo_url, r.created_at, r.expires_at, v.direction AS my_vote, "
            "ST_Y(r.geometry::geometry) AS lat, ST_X(r.geometry::geometry) AS lon "
            "FROM route_reports r "
            "LEFT JOIN LATERAL ("
            "  SELECT direction FROM report_votes WHERE report_id = r.id AND user_id = %s"
            ") v ON true "
            "ORDER BY r.created_at DESC",
            (user_id,),
        )
        reports = [_row_to_report(row) for row in rows]
        for report in reports:
            report.status = effective_report_status(report)
        return reports

    async def create_report(self, input_: dict[str, Any]) -> AccessibilityReport:
        report_id = f"rep-{uuid.uuid4()}"
        now = datetime.now(timezone.utc)
        expires_at = now + REPORT_LIFETIME
        pool = self._pool()
        async with pool.connection() as conn:
            async with conn.transaction():
                await conn.execute(
                    "INSERT INTO route_reports "
                    "(id, report_type, description, geometry, status, photo_url, created_at, expires_at) "
                    "VALUES (%s,%s,%s,ST_GeogFromText(%s),'pending',%s,%s,%s)",
                    (
                        report_id,
                        input_["type"],
                        input_["description"],
                        _point_geog(input_["longitude"], input_["latitude"]),
                        input_.get("photoUrl") or None,
                        now,
                        expires_at,
                    ),
                )
                ai_observation = input_.get("aiObservation")
                if ai_observation is not None:
                    await conn.execute(
                        "INSERT INTO ai_observations (report_id, feature, confidence, model_version, all_detections) "
                        "VALUES (%s,%s,%s,%s,%s)",
                        (
                            report_id,
                            ai_observation.feature,
                            ai_observation.confidence,
                            ai_observation.modelVersion,
                            _json_dumps_model(ai_observation.allDetections),
                        ),
                    )
        await self.invalidate_accessibility_points()
        return AccessibilityReport(
            id=report_id,
            type=input_["type"],
            description=input_["description"],
            latitude=input_["latitude"],
            longitude=input_["longitude"],
            status="pending",
            upvotes=0,
            downvotes=0,
            myVote=None,
            photoUrl=input_.get("photoUrl"),
            createdAt=now.isoformat(),
            expiresAt=expires_at.isoformat(),
            aiObservation=input_.get("aiObservation"),
        )

    async def vote_report(
        self, id: str, user_id: str, direction: VoteDirection
    ) -> AccessibilityReport:
        pool = self._pool()
        async with pool.connection() as conn:
            async with conn.transaction():
                existing = await conn.execute(
                    "SELECT direction FROM report_votes WHERE report_id = %s AND user_id = %s",
                    (id, user_id),
                )
                existing_row = await existing.fetchone()
                if existing_row and existing_row["direction"] == direction:
                    await conn.execute(
                        "DELETE FROM report_votes WHERE report_id = %s AND user_id = %s",
                        (id, user_id),
                    )
                else:
                    await conn.execute(
                        "INSERT INTO report_votes (report_id, user_id, direction) "
                        "VALUES (%s,%s,%s) "
                        "ON CONFLICT (report_id, user_id) "
                        "DO UPDATE SET direction = EXCLUDED.direction, created_at = now()",
                        (id, user_id, direction),
                    )
                await conn.execute(
                    "UPDATE route_reports "
                    "SET upvotes = (SELECT count(*) FROM report_votes WHERE report_id = %s AND direction = 'up'), "
                    "downvotes = (SELECT count(*) FROM report_votes WHERE report_id = %s AND direction = 'down') "
                    "WHERE id = %s",
                    (id, id, id),
                )
                cursor = await conn.execute(
                    "SELECT id, report_type, description, status, upvotes, downvotes, verified_at, "
                    "photo_url, created_at, expires_at, %s::text AS my_vote, "
                    "ST_Y(geometry::geometry) AS lat, ST_X(geometry::geometry) AS lon "
                    "FROM route_reports WHERE id = %s",
                    (direction, id),
                )
                row = await cursor.fetchone()
                if row is None:
                    raise ValueError("Report not found.")
                report = _row_to_report(row)
                apply_vote_status(report)
                await conn.execute(
                    "UPDATE route_reports SET status = %s, verified_at = %s, expires_at = %s WHERE id = %s",
                    (report.status, report.verifiedAt, report.expiresAt, id),
                )
        report.status = effective_report_status(report)
        await self.invalidate_accessibility_points()
        return report

    async def create_ai_observation(self, observation: AiObservation) -> AiObservation:
        await self._execute(
            "INSERT INTO ai_observations (report_id, feature, confidence, model_version, all_detections) "
            "VALUES (%s,%s,%s,%s,%s)",
            (
                observation.reportId,
                observation.feature,
                observation.confidence,
                observation.modelVersion,
                _json_dumps_model(observation.allDetections),
            ),
        )
        return observation

    async def get_profile(self, user_id: str | None = None) -> ProfilePreferences:
        if user_id:
            row = await self._fetchone("SELECT profile_json FROM users WHERE id = %s", (user_id,))
            if row and row.get("profile_json"):
                return ProfilePreferences(**{**DEFAULT_PROFILE.model_dump(), **_json_object(row["profile_json"])})
        row = await self._fetchone("SELECT profile_json FROM user_preferences WHERE id = 'default'")
        if not row:
            return DEFAULT_PROFILE.model_copy(deep=True)
        return ProfilePreferences(**{**DEFAULT_PROFILE.model_dump(), **_json_object(row["profile_json"])})

    async def save_profile(
        self, profile: ProfilePreferences, user_id: str | None = None
    ) -> ProfilePreferences:
        data = json.dumps(profile.model_dump())
        if user_id:
            await self._execute("UPDATE users SET profile_json = %s WHERE id = %s", (data, user_id))
        else:
            await self._execute(
                "INSERT INTO user_preferences (id, profile_json) VALUES ('default', %s) "
                "ON CONFLICT (id) DO UPDATE SET profile_json = %s, updated_at = now()",
                (data, data),
            )
        return profile.model_copy(deep=True)

    async def find_user_by_email(self, email: str) -> User | None:
        row = await self._fetchone(
            "SELECT id, email, name, password_hash, verified_at, verification_code_hash, "
            "verification_expires_at, created_at FROM users WHERE email = %s",
            (email.lower(),),
        )
        return self._row_to_user(row) if row else None

    async def get_user_by_id(self, id: str) -> User | None:
        row = await self._fetchone(
            "SELECT id, email, name, password_hash, verified_at, verification_code_hash, "
            "verification_expires_at, created_at FROM users WHERE id = %s",
            (id,),
        )
        return self._row_to_user(row) if row else None

    async def create_user(self, input_: dict[str, Any]) -> User:
        await self._execute(
            "INSERT INTO users (id, email, name, password_hash, verification_code_hash, verification_expires_at, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (
                input_["id"],
                input_["email"].lower(),
                input_["name"],
                input_["passwordHash"],
                input_["verificationCodeHash"],
                input_["verificationExpiresAt"],
                input_["createdAt"],
            ),
        )
        user = await self.get_user_by_id(input_["id"])
        if not user:
            raise RuntimeError("Failed to create user.")
        return user

    async def update_user(self, id: str, patch: dict[str, Any]) -> User:
        await self._execute(
            "UPDATE users "
            "SET verified_at = COALESCE(%s, verified_at), "
            "verification_code_hash = %s, "
            "verification_expires_at = %s "
            "WHERE id = %s",
            (
                patch.get("verifiedAt"),
                patch.get("verificationCodeHash"),
                patch.get("verificationExpiresAt"),
                id,
            ),
        )
        user = await self.get_user_by_id(id)
        if not user:
            raise RuntimeError("User not found.")
        return user

    async def get_recent_routes(self, user_id: str) -> list[RecentRoute]:
        rows = await self._fetchall(
            "SELECT id, start_label, start_lat, start_lon, end_label, end_lat, end_lon, mode, created_at "
            "FROM recent_routes WHERE user_id = %s ORDER BY created_at DESC LIMIT 10",
            (user_id,),
        )
        return [
            RecentRoute(
                id=row["id"],
                startLabel=row["start_label"],
                startLatitude=_float(row["start_lat"]),
                startLongitude=_float(row["start_lon"]),
                endLabel=row["end_label"],
                endLatitude=_float(row["end_lat"]),
                endLongitude=_float(row["end_lon"]),
                mode=row["mode"],
                createdAt=_iso(row["created_at"]),
            )
            for row in rows
        ]

    async def add_recent_route(self, user_id: str, input_: dict[str, Any]) -> RecentRoute:
        await self._execute(
            "DELETE FROM recent_routes "
            "WHERE user_id = %s AND start_lat = %s AND start_lon = %s AND end_lat = %s AND end_lon = %s",
            (
                user_id,
                input_["startLatitude"],
                input_["startLongitude"],
                input_["endLatitude"],
                input_["endLongitude"],
            ),
        )
        route_id = str(uuid.uuid4())
        await self._execute(
            "INSERT INTO recent_routes "
            "(id, user_id, start_label, start_lat, start_lon, end_label, end_lat, end_lon, mode) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (
                route_id,
                user_id,
                input_["startLabel"],
                input_["startLatitude"],
                input_["startLongitude"],
                input_["endLabel"],
                input_["endLatitude"],
                input_["endLongitude"],
                input_["mode"],
            ),
        )
        await self._execute(
            "DELETE FROM recent_routes "
            "WHERE user_id = %s AND id NOT IN ("
            "  SELECT id FROM recent_routes WHERE user_id = %s ORDER BY created_at DESC LIMIT 10"
            ")",
            (user_id, user_id),
        )
        saved = await self.get_recent_routes(user_id)
        if not saved:
            raise RuntimeError("Failed to save recent route.")
        return saved[0]

    @staticmethod
    def _row_to_user(row: dict) -> User:
        return User(
            id=row["id"],
            email=row["email"],
            name=row["name"],
            passwordHash=row["password_hash"],
            verifiedAt=_iso_opt(row.get("verified_at")),
            verificationCodeHash=row.get("verification_code_hash"),
            verificationExpiresAt=_iso_opt(row.get("verification_expires_at")),
            createdAt=_iso(row.get("created_at")),
        )
