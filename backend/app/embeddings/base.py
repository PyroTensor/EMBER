"""Embedder interface. ``None`` vectors mean "no embedder": callers fall back to keyword-only retrieval."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence


class Embedder(ABC):
    name: str
    dim: int

    @abstractmethod
    async def embed_query(self, text: str) -> list[float] | None:
        """Embed a search query (bge models add an instruction prefix here)."""

    @abstractmethod
    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]] | None:
        """Embed passages (no prefix). Returns one vector per text, in order."""


__all__ = ["Embedder"]
