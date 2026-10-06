"""Test fixtures.

The suite runs against in-memory SQLite, so it needs no Postgres and no Docker.
That is a deliberate trade: it means the tests cannot catch Postgres-specific
behaviour, but it also means they run in a second and nobody skips them.

Environment variables are set **before** importing anything from ``src``,
because settings are read at import time.
"""

import os
import uuid

os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-to-pass-32")
os.environ.setdefault("DATABASE_URL_OVERRIDE", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("RATE_LIMIT_AUTH", "1000/minute")
os.environ.setdefault("RATE_LIMIT_SCAN", "1000/minute")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.core.db import Base, get_db
from src.main import app
from src.models.medicine import Batch, BatchStatus, Product


@pytest.fixture
async def engine():
    # StaticPool keeps one connection alive, otherwise each checkout gets a
    # fresh empty in-memory database.
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session_factory(engine):
    return async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


@pytest.fixture
async def db(session_factory):
    async with session_factory() as session:
        yield session


@pytest.fixture
async def seeded(db):
    """A catalogue and register matching the seed script."""
    panadol = Product(
        gtin="05000158103054", name="Panadol", salt="Paracetamol", dose="500mg"
    )
    db.add(panadol)
    await db.flush()

    db.add_all(
        [
            Batch(batch_number="49302", product_id=panadol.id, status=BatchStatus.SAFE),
            Batch(batch_number="ABC-123", product_id=panadol.id, status=BatchStatus.SAFE),
            Batch(batch_number="FAKE-999", status=BatchStatus.UNSAFE),
        ]
    )
    await db.commit()
    return panadol


@pytest.fixture
async def client(session_factory):
    """HTTP client wired to the app with the test database substituted in."""

    async def _override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_client(client):
    """A client with a registered user's bearer token already attached."""
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    response = await client.post(
        "/auth/register",
        json={"name": "Test User", "email": email, "password": "correct-horse"},
    )
    assert response.status_code == 201, response.text
    client.headers["Authorization"] = f"Bearer {response.json()['token']}"
    return client
