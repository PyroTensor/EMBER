"""Google Gemini provider. One ``genai.Client`` per process (the factory caches the provider).

The SDK call is blocking, so it runs in a worker thread and never blocks the event loop.
"""

from __future__ import annotations

from functools import partial
from typing import Any

import anyio.to_thread

from app.llm.base import LLMProvider


class GeminiProvider(LLMProvider):  # pragma: no cover - requires GEMINI_API_KEY
    name = "gemini"

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash") -> None:
        from google import genai  # heavy import: lazy

        self._client: Any = genai.Client(api_key=api_key)
        self._model = model

    def _generate(self, contents: str) -> str:
        resp = self._client.models.generate_content(model=self._model, contents=contents)
        return (resp.text or "").strip()

    async def complete(self, system: str, prompt: str) -> str:
        return await anyio.to_thread.run_sync(partial(self._generate, f"{system}\n\n{prompt}"))


__all__ = ["GeminiProvider"]
