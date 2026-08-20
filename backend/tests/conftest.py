"""Shared test fixtures.

Each test module gets a fresh in-memory store + app (mirroring the Node
beforeAll(createApp(new MemoryStore())) pattern). NODE_ENV=test disables rate
limiting and external corridor/region fetches inside the route pipeline."""

import os

os.environ.setdefault("NODE_ENV", "test")

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.store import MemoryStore


@pytest.fixture(scope="module")
def store():
    return MemoryStore()


@pytest.fixture(scope="module")
def app(store):
    return create_app(store)


@pytest.fixture(scope="module")
def client(app):
    with TestClient(app) as test_client:
        yield test_client