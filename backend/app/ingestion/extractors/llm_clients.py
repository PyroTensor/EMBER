"""Structured-output LLM clients for ingestion extraction: OpenAI primary, Gemini fallback.

``StructuredLLMChain`` tries each client in order; any ``ExtractionError`` or pydantic ``ValidationError``
moves on to the next one. When every client fails the chain returns ``parsed=None`` (the caller falls back
to the heuristic result) - it never raises.

Schemas passed to ``extract`` must be OpenAI-strict and Gemini compatible: no ``dict[str, Any]``, no default
values, optional fields as ``X | None`` (all fields required), only str/float/int/bool/list/nested models.

Logging: provider, model and failure reason only - never the prompt, page text or API key.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.config import Settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

Reason = Literal["timeout", "http", "refusal", "invalid_json", "empty"]


class ExtractionError(Exception):
    """One provider failed to return a usable structured result."""

    def __init__(self, provider: str, reason: Reason, detail: str = "") -> None:
        self.provider = provider
        self.reason: Reason = reason
        self.detail = detail
        super().__init__(f"{provider}: {reason}" + (f" ({detail})" if detail else ""))


class StructuredLLM(Protocol):
    name: str
    model: str

    async def extract(
        self, system: str, user: str, schema: type[T], image_png: bytes | None = None
    ) -> tuple[T, str]:
        """Return ``(parsed, raw_json)`` or raise ``ExtractionError``. ``image_png``: optional page image."""
        ...


# ── OpenAI (primary) ──────────────────────────────────────────────────


class OpenAIStructured:
    name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_s: float,
        max_retries: int,
        *,
        # openai>=3 is typed against httpx2 but also accepts an httpx.AsyncClient (tests: MockTransport)
        http_client: Any | None = None,
    ) -> None:
        from openai import AsyncOpenAI  # lazy: keep the default (heuristic) path import-light

        self.model = model
        # the SDK retries 429/5xx/connection errors itself, with backoff
        self._client = AsyncOpenAI(
            api_key=api_key, timeout=timeout_s, max_retries=max_retries, http_client=http_client
        )

    async def extract(
        self, system: str, user: str, schema: type[T], image_png: bytes | None = None
    ) -> tuple[T, str]:
        import openai

        user_content: Any = user
        if image_png is not None:
            data_url = "data:image/png;base64," + base64.b64encode(image_png).decode("ascii")
            user_content = [
                {"type": "text", "text": user},
                {"type": "image_url", "image_url": {"url": data_url}},
            ]
        try:
            completion = await self._client.chat.completions.parse(
                model=self.model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user_content}],
                response_format=schema,
                temperature=0,
            )
        except openai.APITimeoutError as exc:
            raise ExtractionError(self.name, "timeout") from exc
        except openai.ContentFilterFinishReasonError as exc:
            raise ExtractionError(self.name, "refusal", "content filter") from exc
        except openai.LengthFinishReasonError as exc:
            raise ExtractionError(self.name, "invalid_json", "output truncated") from exc
        except ValidationError as exc:
            raise ExtractionError(
                self.name, "invalid_json", f"{exc.error_count()} validation errors"
            ) from exc
        except openai.APIError as exc:
            status = getattr(exc, "status_code", None)
            raise ExtractionError(
                self.name, "http", f"status {status}" if status else type(exc).__name__
            ) from exc

        if not completion.choices:
            raise ExtractionError(self.name, "empty")
        message = completion.choices[0].message
        if message.refusal:
            raise ExtractionError(self.name, "refusal")
        if message.parsed is None:
            raise ExtractionError(self.name, "invalid_json")
        return message.parsed, message.content or message.parsed.model_dump_json()


# ── Gemini (fallback) ─────────────────────────────────────────────────


class GeminiStructured:
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_s: float,
        max_retries: int,
        *,
        client: Any | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.model = model
        self._timeout_s = timeout_s
        self._max_retries = max_retries
        self._sleep = sleep
        if client is None:
            from google import genai  # heavy import: lazy

            client = genai.Client(api_key=api_key)
        self._client: Any = client

    async def _call(
        self, system: str, user: str, schema: type[BaseModel], image_png: bytes | None = None
    ) -> Any:
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0,
            response_mime_type="application/json",
            response_schema=schema,
        )
        contents: Any = user
        if image_png is not None:
            contents = [types.Part.from_bytes(data=image_png, mime_type="image/png"), user]
        return await asyncio.wait_for(
            self._client.aio.models.generate_content(model=self.model, contents=contents, config=config),
            timeout=self._timeout_s,
        )

    async def extract(
        self, system: str, user: str, schema: type[T], image_png: bytes | None = None
    ) -> tuple[T, str]:
        from google.genai import errors

        attempt = 0
        while True:
            try:
                resp = await self._call(system, user, schema, image_png)
                break
            except (TimeoutError, errors.APIError) as exc:
                code = getattr(exc, "code", None)
                retryable = isinstance(exc, TimeoutError) or code == 429 or (code or 0) >= 500
                if not retryable or attempt >= self._max_retries:
                    if isinstance(exc, TimeoutError):
                        raise ExtractionError(self.name, "timeout") from exc
                    raise ExtractionError(self.name, "http", f"status {code}") from exc
                await self._sleep(2.0**attempt)  # 1s, 2s, 4s ...
                attempt += 1

        parsed = getattr(resp, "parsed", None)
        text = getattr(resp, "text", None) or ""
        if isinstance(parsed, schema):
            return parsed, text or parsed.model_dump_json()
        if not text.strip():
            raise ExtractionError(self.name, "empty")
        try:
            return schema.model_validate_json(text), text
        except ValidationError as exc:
            raise ExtractionError(
                self.name, "invalid_json", f"{exc.error_count()} validation errors"
            ) from exc


# ── chain ─────────────────────────────────────────────────────────────


@dataclass
class ChainResult:
    parsed: BaseModel | None
    raw: str | None
    provider: str | None
    model: str | None
    attempts: list[dict[str, str]] = field(default_factory=list)  # [{provider, model, error}]

    @property
    def ok(self) -> bool:
        return self.parsed is not None


class StructuredLLMChain:
    def __init__(self, clients: list[StructuredLLM]) -> None:
        if not clients:
            raise ValueError("StructuredLLMChain needs at least one client")
        self.clients = clients

    @property
    def providers(self) -> list[str]:
        return [c.name for c in self.clients]

    async def extract(
        self, system: str, user: str, schema: type[BaseModel], image_png: bytes | None = None
    ) -> ChainResult:
        attempts: list[dict[str, str]] = []
        for client in self.clients:
            try:
                if image_png is None:  # text-only call: same signature as before I8
                    parsed, raw = await client.extract(system, user, schema)
                else:
                    parsed, raw = await client.extract(system, user, schema, image_png=image_png)
            except ExtractionError as exc:
                error = exc.reason
            except ValidationError as exc:
                error = "invalid_json"
                logger.debug("%s/%s validation errors: %d", client.name, client.model, exc.error_count())
            else:
                return ChainResult(parsed, raw, client.name, client.model, attempts)
            logger.warning("extraction via %s/%s failed: %s", client.name, client.model, error)
            attempts.append({"provider": client.name, "model": client.model, "error": error})
        return ChainResult(None, None, None, None, attempts)


def build_chain(settings: Settings) -> StructuredLLMChain | None:
    """OpenAI first (if ``OPENAI_API_KEY``), then Gemini (if ``GEMINI_API_KEY``); ``None`` when neither."""
    clients: list[StructuredLLM] = []
    openai_key = settings.OPENAI_API_KEY.get_secret_value()
    if openai_key:
        clients.append(
            OpenAIStructured(
                openai_key,
                settings.EXTRACT_OPENAI_MODEL,
                settings.EXTRACT_TIMEOUT_S,
                settings.EXTRACT_MAX_RETRIES,
            )
        )
    gemini_key = settings.GEMINI_API_KEY.get_secret_value()
    if gemini_key:
        clients.append(
            GeminiStructured(
                gemini_key,
                settings.EXTRACT_GEMINI_MODEL,
                settings.EXTRACT_TIMEOUT_S,
                settings.EXTRACT_MAX_RETRIES,
            )
        )
    return StructuredLLMChain(clients) if clients else None


__all__ = [
    "ChainResult",
    "ExtractionError",
    "GeminiStructured",
    "OpenAIStructured",
    "StructuredLLM",
    "StructuredLLMChain",
    "build_chain",
]
