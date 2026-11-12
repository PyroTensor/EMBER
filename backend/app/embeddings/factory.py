"""Cached embedder singleton + startup warm-up."""

from __future__ import annotations

import logging
import time
from functools import lru_cache

from app.core.config import get_settings
from app.embeddings.base import Embedder
from app.embeddings.null import NullEmbedder

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    """bge when ``EMBED_ENABLED`` and the model loads; otherwise ``NullEmbedder`` (logged as a WARNING)."""
    settings = get_settings()
    if not settings.EMBED_ENABLED:
        logger.warning("EMBED_ENABLED=false: using the null embedder (keyword-only retrieval)")
        return NullEmbedder(settings.EMBED_DIM)
    try:
        from app.embeddings.bge import BgeEmbedder

        return BgeEmbedder(settings.EMBED_MODEL, expected_dim=settings.EMBED_DIM)
    except Exception as exc:  # ImportError, model download failure, dim mismatch, ...
        logger.warning(
            "embedder %s unavailable (%s: %s): using the null embedder (keyword-only retrieval)",
            settings.EMBED_MODEL,
            type(exc).__name__,
            exc,
        )
        return NullEmbedder(settings.EMBED_DIM)


async def warm(embedder: Embedder) -> None:
    """Run one query so the first real request does not pay the model warm-up cost."""
    if isinstance(embedder, NullEmbedder):
        logger.info("embedder=null (BM25-only)")
        return
    start = time.perf_counter()
    await embedder.embed_query("warm-up")
    logger.info("embedder=%s dim=%d ready in %.1fs", embedder.name, embedder.dim, time.perf_counter() - start)


__all__ = ["get_embedder", "warm"]
