"""OpenAI Chat Completions provider using async ``httpx`` (no extra SDK dependency)."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.exceptions import UpstreamTimeoutError, UpstreamUnavailableError
from app.llm.base import LLMProvider

_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"


class OpenAIProvider(LLMProvider):  # pragma: no cover - requires OPENAI_API_KEY
    name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4.1-mini",
        *,
        timeout_s: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout_s = timeout_s
        self._transport = transport

    async def complete(self, system: str, prompt: str) -> str:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout_s, transport=self._transport) as client:
                resp = await client.post(_CHAT_COMPLETIONS_URL, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(
                f"OpenAI request timed out after {self._timeout_s:g} s",
                details={"provider": self.name, "model": self._model},
            ) from exc
        except httpx.HTTPError as exc:
            raise UpstreamUnavailableError(
                f"OpenAI request failed: {type(exc).__name__}",
                details={"provider": self.name, "model": self._model},
            ) from exc

        if resp.status_code >= 400:
            raise UpstreamUnavailableError(
                f"OpenAI returned HTTP {resp.status_code}",
                details={"provider": self.name, "model": self._model, "status_code": resp.status_code},
            )

        data: dict[str, Any] = resp.json()
        choices = data.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = [p.get("text", "") for p in content if isinstance(p, dict)]
            return "".join(parts).strip()
        return ""


__all__ = ["OpenAIProvider"]
