"""Local sentence-transformers embedder (BAAI/bge-small-en-v1.5 by default, normalized vectors).

bge expects an instruction prefix on *queries* only (copied from legacy ``ingestion/chunk_embed.py``).
``encode`` is CPU-bound, so it runs in a worker thread and never blocks the event loop.
"""

from __future__ import annotations

from collections.abc import Sequence
from functools import partial
from typing import Any, Final

import anyio.to_thread

from app.embeddings.base import Embedder

BGE_QUERY_PREFIX: Final = "Represent this sentence for searching relevant passages: "
_BATCH_SIZE: Final = 32


class BgeEmbedder(Embedder):
    name = "bge"

    def __init__(self, model_name: str, expected_dim: int | None = None) -> None:
        from sentence_transformers import SentenceTransformer  # heavy import: lazy

        self.model_name = model_name
        self._model: Any = SentenceTransformer(model_name)
        # sentence-transformers renamed get_sentence_embedding_dimension -> get_embedding_dimension
        get_dim = getattr(self._model, "get_embedding_dimension", None) or (
            self._model.get_sentence_embedding_dimension
        )
        dim = get_dim()
        if not isinstance(dim, int):
            raise ValueError(f"{model_name} does not report an embedding dimension")
        if expected_dim is not None and dim != expected_dim:
            raise ValueError(f"{model_name} produces {dim}-dim vectors but EMBED_DIM={expected_dim}")
        self.dim = dim

    def _encode(self, texts: list[str]) -> list[list[float]]:
        vecs = self._model.encode(
            texts, normalize_embeddings=True, batch_size=_BATCH_SIZE, show_progress_bar=False
        )
        return [v.tolist() for v in vecs]

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        return await anyio.to_thread.run_sync(partial(self._encode, list(texts)))

    async def embed_query(self, text: str) -> list[float]:
        return (await self.embed_documents([BGE_QUERY_PREFIX + text]))[0]


__all__ = ["BGE_QUERY_PREFIX", "BgeEmbedder"]
