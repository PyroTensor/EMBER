"""Application lifespan: build the Database, pick the LLM provider, warm the embedder; dispose on shutdown."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.db.engine import Database
from app.embeddings.factory import get_embedder, warm
from app.llm.factory import get_llm_provider

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
        logger.info("llm provider: %s", get_llm_provider().name)
        embedder = get_embedder()
        if settings.EMBED_WARMUP:
            await warm(embedder)
        else:
            logger.info("embedder=%s dim=%d (warm-up disabled)", embedder.name, embedder.dim)
        yield
    finally:
        await db.dispose()
        logger.info("EMBER backend stopped")
