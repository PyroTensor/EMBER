"""Provider-agnostic LLM interface (Gemini default + deterministic Heuristic fallback).

Switch via `.env`:
  LLM_PROVIDER=gemini | openai | anthropic | heuristic

If `LLM_PROVIDER=gemini` (or openai/anthropic) is configured without an API key,
`get_llm_provider()` automatically falls back to `HeuristicProvider` so the LangGraph
RAG pipeline always runs end-to-end out of the box.

TODO(squad2-A): wire OpenAIProvider and AnthropicProvider when keys are needed.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.config import get_settings


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def complete(self, system: str, prompt: str) -> str:
        """Return a completion string."""


class HeuristicProvider(LLMProvider):
    """Deterministic offline provider used when no external LLM API key is configured."""

    name = "heuristic"

    def complete(self, system: str, prompt: str) -> str:
        # Graph nodes check `provider.name == "heuristic"` for structured rule-based execution
        # or call this method for simple text synthesis.
        return prompt.strip()


class GeminiProvider(LLMProvider):  # pragma: no cover - requires GEMINI_API_KEY
    name = "gemini"

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model

    def complete(self, system: str, prompt: str) -> str:
        resp = self._client.models.generate_content(
            model=self._model,
            contents=f"{system}\n\n{prompt}",
        )
        return (resp.text or "").strip()


def get_llm_provider() -> LLMProvider:
    s = get_settings()
    prov = s.llm_provider.lower().strip()
    if prov == "gemini" and s.gemini_api_key:
        return GeminiProvider(api_key=s.gemini_api_key, model=s.llm_model)
    # Automatic zero-key fallback
    return HeuristicProvider()
