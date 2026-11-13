"""Provider-agnostic LLM interface (ported from legacy ``llm/provider.py``)."""

from __future__ import annotations

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """``name`` is what ``/api/health`` reports; RAG nodes branch on ``name == "heuristic"``."""

    name: str = "base"

    @abstractmethod
    async def complete(self, system: str, prompt: str) -> str:
        """Return a completion string for ``system`` + ``prompt``."""


__all__ = ["LLMProvider"]
