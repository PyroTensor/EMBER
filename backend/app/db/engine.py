"""Async engines (read-write + read-only), session factories and the availability probe."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings
from app.db.availability import DbAvailability

_MAX_OVERFLOW = 5


def _make_engine(url: str, settings: Settings) -> AsyncEngine:
    # Creating an engine does not connect; the first checkout (or the probe) does.
    return create_async_engine(
        url,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=_MAX_OVERFLOW,
        pool_pre_ping=True,
        connect_args={"timeout": settings.DB_CONNECT_TIMEOUT_S},
    )


class Database:
    def __init__(self, settings: Settings) -> None:
        self.rw_engine = _make_engine(settings.DATABASE_URL, settings)
        self.ro_engine = _make_engine(settings.DATABASE_URL_READONLY, settings)
        self.rw_sessionmaker: async_sessionmaker[AsyncSession] = async_sessionmaker(
            self.rw_engine, expire_on_commit=False
        )
        self.ro_sessionmaker: async_sessionmaker[AsyncSession] = async_sessionmaker(
            self.ro_engine, expire_on_commit=False
        )
        self.availability = DbAvailability(
            self.rw_engine,
            settings.DATA_BACKEND,
            ttl_s=settings.DB_PROBE_TTL_S,
            timeout_s=settings.DB_CONNECT_TIMEOUT_S,
        )

    async def dispose(self) -> None:
        await self.rw_engine.dispose()
        await self.ro_engine.dispose()


__all__ = ["Database"]
