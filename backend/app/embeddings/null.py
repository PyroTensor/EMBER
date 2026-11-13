"""No-op embedder: returns ``None`` so retrieval runs keyword-only (BM25 / tsvector)."""

from __future__ import annotations

from collections.abc import Sequence

from app.embeddings.base import Embedder


class NullEmbedder(Embedder):
    name = "null"

    def __init__(self, dim: int = 0) -> None:
        self.dim = dim

    async def embed_query(self, text: str) -> None:
        return None

    async def embed_documents(self, texts: Sequence[str]) -> None:
        return None


__all__ = ["NullEmbedder"]
