"""Database engine, session factory and the request-scoped session dependency."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
 
from .config import env


class Base(DeclarativeBase):
    """Declarative base. Every model must be imported before Alembic
    autogenerate runs, or its table will be silently missing from the
    migration. See ``src/models/__init__.py``."""


engine = create_async_engine(
    env.DATABASE_URL, 
    echo=env.DB_ECHO,
    pool_size=env.DB_POOL_SIZE,
    max_overflow=env.DB_MAX_OVERFLOW,
    # Without this, a connection killed by the DB or a proxy is handed to a
    # request and fails with a confusing "server closed the connection".
    pool_pre_ping=True,
    # Postgres and most poolers drop idle connections well before this.
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession]:
    """Yields a session that commits on success and rolls back on failure.

    Committing here rather than in each route means no endpoint can forget to,
    and a route that raises can never leave a half-written transaction behind.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
