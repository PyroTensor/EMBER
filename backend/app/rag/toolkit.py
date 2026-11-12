"""Everything a RAG node needs, injected per request. Nodes never open sessions or read globals."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.embeddings.base import Embedder
from app.llm.base import LLMProvider
from app.repositories.interfaces import ChunkSearcher, TestRunReader


@dataclass
class RagToolkit:
    runs: TestRunReader
    chunks: ChunkSearcher
    embedder: Embedder
    llm: LLMProvider
    settings: Settings


__all__ = ["RagToolkit"]
