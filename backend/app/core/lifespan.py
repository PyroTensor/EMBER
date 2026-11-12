"""Application lifespan (DB engines and warmups are added in later steps)."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("EMBER backend starting")
    try:
        yield
    finally:
        logger.info("EMBER backend stopped")
