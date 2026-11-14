"""Structured-output LLM clients (OpenAI primary, Gemini fallback) + extraction cache for stage 4."""

from __future__ import annotations

from app.ingestion.extractors.cache import ExtractionCache, cache_key
from app.ingestion.extractors.llm_clients import (
    ChainResult,
    ExtractionError,
    GeminiStructured,
    OpenAIStructured,
    StructuredLLM,
    StructuredLLMChain,
    build_chain,
)

__all__ = [
    "ChainResult",
    "ExtractionCache",
    "ExtractionError",
    "GeminiStructured",
    "OpenAIStructured",
    "StructuredLLM",
    "StructuredLLMChain",
    "build_chain",
    "cache_key",
]
