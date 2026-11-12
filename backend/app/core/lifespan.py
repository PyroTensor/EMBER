"""Application lifespan: build the Database on startup, dispose it on shutdown (warmups come later)."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.db.engine import Database

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("EMBER backend starting")
    settings = get_settings()
    db = Database(settings)
    app.state.db = db
    try:
        up = await db.availability.is_up()
        logger.info(
            "data backend: %s (mode=%s, db=%s)",
            "postgres" if up else "snapshot",
            db.availability.mode,
            settings.SAFE_DATABASE_URL,
        )
        yield
    finally:
        await db.dispose()
        logger.info("EMBER backend stopped")
