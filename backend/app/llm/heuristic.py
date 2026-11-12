"""Deterministic offline provider used when no external LLM is configured (tests, eval, zero-key runs)."""

from __future__ import annotations

from app.llm.base import LLMProvider


class HeuristicProvider(LLMProvider):
    """Graph nodes check ``provider.name == "heuristic"`` for rule-based execution, or call ``complete``
    for simple text synthesis (it echoes the prompt)."""

    name = "heuristic"

    async def complete(self, system: str, prompt: str) -> str:
        return prompt.strip()


__all__ = ["HeuristicProvider"]
