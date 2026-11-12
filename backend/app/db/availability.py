"""Cached Postgres availability probe (plan.md D3).

``DATA_BACKEND=postgres|snapshot`` forces the answer. ``auto`` runs ``SELECT 1`` with a short timeout and
caches the result for ``ttl_s`` so callers decide once per TTL instead of timing out on every query.
"""

from __future__ import annotations

import asyncio
import logging
import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import DataBackend

logger = logging.getLogger(__name__)


class DbAvailability:
    def __init__(self, engine: AsyncEngine, mode: DataBackend, ttl_s: float, timeout_s: float) -> None:
        self._engine = engine
        self._mode = mode
        self._ttl_s = ttl_s
        self._timeout_s = timeout_s
        self._lock = asyncio.Lock()
        self._up: bool | None = None  # None = never probed
        self._checked_at = 0.0

    @property
    def mode(self) -> DataBackend:
        return self._mode

    def _fresh(self) -> bool:
        return self._up is not None and (time.monotonic() - self._checked_at) < self._ttl_s

    async def is_up(self) -> bool:
        if self._mode is DataBackend.POSTGRES:
            return True
        if self._mode is DataBackend.SNAPSHOT:
            return False
        if self._fresh():
            return bool(self._up)
        async with self._lock:
            if self._fresh():  # another task probed while we waited
                return bool(self._up)
            up = await self._probe()
            if not up and self._up is not False:
                logger.warning("Postgres unreachable; using the snapshot for the next %.0fs", self._ttl_s)
            elif up and self._up is False:
                logger.info("Postgres reachable again")
            self._up = up
            self._checked_at = time.monotonic()
            return up

    def mark_down(self) -> None:
        """Record a failure seen elsewhere (e.g. a query error); the next probe waits a full TTL."""
        if self._mode is not DataBackend.AUTO:
            return
        if self._up is not False:
            logger.warning("Postgres marked down; using the snapshot for the next %.0fs", self._ttl_s)
        self._up = False
        self._checked_at = time.monotonic()

    async def _probe(self) -> bool:
        try:
            async with asyncio.timeout(self._timeout_s), self._engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception as exc:  # any failure (timeout, refused, auth, ...) means "not usable"
            logger.debug("DB probe failed: %s: %s", type(exc).__name__, exc)
            return False
        return True


__all__ = ["DbAvailability"]
