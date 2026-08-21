import pytest

from app.services import store as store_module
from app.services.store import MemoryStore, create_store


class _FakePostgresStore:
    kind = "postgres"

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        self.initialized = False

    async def initialize(self) -> None:
        self.initialized = True


@pytest.mark.asyncio
async def test_create_store_uses_postgres_when_database_url_is_set(monkeypatch):
    import sys
    import types

    fake_module = types.ModuleType("app.services.postgres")
    fake_module.PostgresStore = _FakePostgresStore
    monkeypatch.setitem(sys.modules, "app.services.postgres", fake_module)
    monkeypatch.setattr(store_module.settings, "database_url", "postgresql://example")

    store = await create_store()

    assert getattr(store, "kind", None) == "postgres"
    assert isinstance(store, _FakePostgresStore)
    assert store.database_url == "postgresql://example"
    assert store.initialized is True


@pytest.mark.asyncio
async def test_create_store_falls_back_to_memory_when_postgres_fails(monkeypatch):
    import sys
    import types

    class _BrokenPostgresStore:
        def __init__(self, _database_url: str) -> None:
            pass

        async def initialize(self) -> None:
            raise RuntimeError("boom")

    fake_module = types.ModuleType("app.services.postgres")
    fake_module.PostgresStore = _BrokenPostgresStore
    monkeypatch.setitem(sys.modules, "app.services.postgres", fake_module)
    monkeypatch.setattr(store_module.settings, "database_url", "postgresql://example")

    store = await create_store()

    assert isinstance(store, MemoryStore)
