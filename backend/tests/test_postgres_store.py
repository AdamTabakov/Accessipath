import json
from collections import deque
from datetime import datetime, timedelta, timezone

import pytest

from app.schemas import AiObservation
from app.services import postgres as postgres_module
from app.services.postgres import SCHEMA, RLS_POLICIES, PostgresStore


class _Cursor:
    def __init__(self, rows=None):
        self._rows = rows or []

    async def fetchone(self):
        return self._rows[0] if self._rows else None

    async def fetchall(self):
        return self._rows


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Connection:
    def __init__(self, pool):
        self._pool = pool

    def transaction(self):
        return _Transaction()

    async def execute(self, sql, params=None):
        return self._pool._execute(sql, params)


class _ConnectionContext:
    def __init__(self, pool):
        self._pool = pool

    async def __aenter__(self):
        return _Connection(self._pool)

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakePool:
    def __init__(self, *args, responses=None, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.opened = False
        self.closed = False
        self.executions = []
        self._responses = deque(responses or [])

    async def open(self):
        self.opened = True

    async def close(self):
        self.closed = True

    def connection(self):
        return _ConnectionContext(self)

    def _execute(self, sql, params=None):
        self.executions.append((sql, params))
        rows = self._responses.popleft() if self._responses else []
        return _Cursor(rows)


def test_schema_creates_referenced_tables_before_foreign_key_tables():
    users_index = SCHEMA.index("CREATE TABLE IF NOT EXISTS users")
    route_reports_index = SCHEMA.index("CREATE TABLE IF NOT EXISTS route_reports")
    report_votes_index = SCHEMA.index("CREATE TABLE IF NOT EXISTS report_votes")

    assert "CREATE EXTENSION IF NOT EXISTS postgis" in SCHEMA
    assert route_reports_index < report_votes_index
    assert users_index < report_votes_index
    assert "user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE" in SCHEMA


def test_rls_policies_are_plain_postgres_and_rerunnable():
    assert "auth.uid()" not in RLS_POLICIES
    assert "ALTER TABLE report_votes ENABLE ROW LEVEL SECURITY" in RLS_POLICIES
    assert "DROP POLICY IF EXISTS" in RLS_POLICIES
    assert "current_setting('app.user_id', true)" in RLS_POLICIES
    assert "CREATE POLICY \"recent_routes_own_data\"" in RLS_POLICIES


@pytest.mark.asyncio
async def test_initialize_opens_async_pool_and_executes_schema(monkeypatch):
    created_pools = []

    def fake_pool(*args, **kwargs):
        pool = _FakePool(*args, **kwargs)
        created_pools.append(pool)
        return pool

    monkeypatch.setattr(postgres_module, "AsyncConnectionPool", fake_pool)

    store = PostgresStore("postgresql://example")
    await store.initialize()
    await store.close()

    assert len(created_pools) == 1
    pool = created_pools[0]
    assert pool.args == ("postgresql://example",)
    assert pool.kwargs["min_size"] == 1
    assert pool.kwargs["max_size"] == 10
    assert pool.kwargs["open"] is False
    assert pool.opened is True
    assert pool.closed is True
    assert pool.executions == [(SCHEMA, None), (RLS_POLICIES, None)]


@pytest.mark.asyncio
async def test_create_report_uses_parameterized_postgis_insert_and_saves_ai_observation():
    store = PostgresStore("postgresql://example")
    store.pool = _FakePool()
    observation = AiObservation(
        reportId=None,
        feature="stairs",
        confidence=0.92,
        modelVersion="vision-test",
        createdAt=datetime.now(timezone.utc).isoformat(),
        allDetections=[{"label": "stairs", "score": 0.92}],
    )

    report = await store.create_report(
        {
            "type": "stairs",
            "description": "Temporary stairs block this entrance",
            "latitude": 43.65,
            "longitude": -79.38,
            "photoUrl": "/uploads/report.jpg",
            "aiObservation": observation,
        }
    )

    route_report_sql, route_report_params = store.pool.executions[0]
    ai_sql, ai_params = store.pool.executions[1]

    assert "VALUES (%s,%s,%s,ST_GeogFromText(%s),'pending',%s,%s,%s)" in route_report_sql
    assert route_report_params[1:5] == (
        "stairs",
        "Temporary stairs block this entrance",
        "SRID=4326;POINT(-79.38 43.65)",
        "/uploads/report.jpg",
    )
    assert "Temporary stairs block this entrance" not in route_report_sql
    assert "INSERT INTO ai_observations" in ai_sql
    assert json.loads(ai_params[4]) == [{"label": "stairs", "score": 0.92}]
    assert report.status == "pending"
    assert report.latitude == 43.65
    assert report.longitude == -79.38


@pytest.mark.asyncio
async def test_get_reports_maps_rows_and_passes_user_id_as_query_parameter():
    now = datetime.now(timezone.utc)
    rows = [
        {
            "id": "rep-1",
            "report_type": "blocked_ramp",
            "description": "Ramp is blocked",
            "status": "pending",
            "upvotes": 2,
            "downvotes": 0,
            "verified_at": None,
            "photo_url": None,
            "created_at": now,
            "expires_at": now + timedelta(days=1),
            "my_vote": "up",
            "lat": "43.1",
            "lon": "-79.2",
        }
    ]
    store = PostgresStore("postgresql://example")
    store.pool = _FakePool(responses=[[], rows])

    reports = await store.get_reports("user-1")

    set_ctx_sql, set_ctx_params = store.pool.executions[0]
    sql, params = store.pool.executions[1]
    assert "set_config('app.user_id'" in set_ctx_sql
    assert set_ctx_params == ("user-1",)
    assert "LEFT JOIN LATERAL" in sql
    assert "user_id = %s" in sql
    assert params == ("user-1",)
    assert reports[0].id == "rep-1"
    assert reports[0].type == "blocked_ramp"
    assert reports[0].latitude == 43.1
    assert reports[0].longitude == -79.2
    assert reports[0].myVote == "up"


@pytest.mark.asyncio
async def test_get_profile_uses_connection_from_pool_and_returns_default_profile():
    store = PostgresStore("postgresql://example")
    store.pool = _FakePool(responses=[[], []])

    profile = await store.get_profile()

    set_ctx_sql, set_ctx_params = store.pool.executions[0]
    sql, params = store.pool.executions[1]
    assert "set_config('app.user_id'" in set_ctx_sql
    assert set_ctx_params == ("",)
    assert sql == "SELECT profile_json FROM user_preferences WHERE id = 'default'"
    assert params is None
    assert profile.mobilityProfile == "wheelchair"
    assert profile.avoidStairs is True


@pytest.mark.asyncio
async def test_get_profile_accepts_decoded_jsonb_dict():
    store = PostgresStore("postgresql://example")
    store.pool = _FakePool(responses=[[], [{"profile_json": {"mobilityProfile": "cane", "avoidStairs": False}}]])

    profile = await store.get_profile()

    assert profile.mobilityProfile == "cane"
    assert profile.avoidStairs is False
    assert profile.preferRamps is True


@pytest.mark.asyncio
async def test_get_profile_accepts_json_string():
    store = PostgresStore("postgresql://example")
    store.pool = _FakePool(responses=[[], [{"profile_json": json.dumps({"mobilityProfile": "walker"})}]])

    profile = await store.get_profile()

    assert profile.mobilityProfile == "walker"
    assert profile.avoidStairs is True


@pytest.mark.asyncio
async def test_create_user_lowercases_email_and_fetches_created_user():
    now = datetime.now(timezone.utc)
    created_row = {
        "id": "user-1",
        "email": "person@example.com",
        "name": "Person",
        "password_hash": "hash",
        "verified_at": None,
        "verification_code_hash": "code-hash",
        "verification_expires_at": now + timedelta(minutes=10),
        "created_at": now,
    }
    store = PostgresStore("postgresql://example")
    store.pool = _FakePool(responses=[[], [], [created_row]])

    user = await store.create_user(
        {
            "id": "user-1",
            "email": "Person@Example.COM",
            "name": "Person",
            "passwordHash": "hash",
            "verificationCodeHash": "code-hash",
            "verificationExpiresAt": created_row["verification_expires_at"],
            "createdAt": now,
        }
    )

    insert_sql, insert_params = store.pool.executions[0]
    set_ctx_sql, set_ctx_params = store.pool.executions[1]
    select_sql, select_params = store.pool.executions[2]
    assert "INSERT INTO users" in insert_sql
    assert insert_params[1] == "person@example.com"
    assert "Person@Example.COM" not in insert_sql
    assert "SELECT id, email, name, password_hash" in select_sql
    assert select_params == ("user-1",)
    assert user.email == "person@example.com"
    assert "set_config('app.user_id'" in set_ctx_sql
    assert set_ctx_params == ("user-1",)
