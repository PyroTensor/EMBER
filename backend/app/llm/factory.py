"""Cached LLM provider singleton. Downgrades to the heuristic provider are logged as WARNINGs."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Final

from app.core.config import get_settings
from app.llm.base import LLMProvider
from app.llm.heuristic import HeuristicProvider

logger = logging.getLogger(__name__)

_NOT_IMPLEMENTED: Final[frozenset[str]] = frozenset({"openai", "anthropic"})


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    """Gemini when configured with a key; otherwise ``HeuristicProvider`` (with a WARNING if that is a
    downgrade from the requested provider)."""
    settings = get_settings()
    requested = str(settings.LLM_PROVIDER.value).lower().strip()
    if requested == "gemini":
        key = settings.GEMINI_API_KEY.get_secret_value()
        if key:
            from app.llm.gemini import GeminiProvider

            return GeminiProvider(api_key=key, model=settings.LLM_MODEL)
        logger.warning("LLM_PROVIDER=gemini but GEMINI_API_KEY is empty: using the heuristic provider")
    elif requested in _NOT_IMPLEMENTED:
        logger.warning("LLM_PROVIDER=%s is not implemented: using the heuristic provider", requested)
    return HeuristicProvider()


__all__ = ["get_llm_provider"]
