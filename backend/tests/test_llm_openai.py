from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import httpx
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.core.exceptions import UpstreamTimeoutError, UpstreamUnavailableError  # noqa: E402
from app.llm.factory import get_llm_provider  # noqa: E402
from app.llm.openai import OpenAIProvider  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_caches() -> None:
    get_settings.cache_clear()
    get_llm_provider.cache_clear()


async def test_openai_provider_complete() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("Authorization")
        seen["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"choices": [{"message": {"content": "  OK  "}}]})

    provider = OpenAIProvider(api_key="sk-test", model="gpt-6-luna", transport=httpx.MockTransport(handler))
    out = await provider.complete("sys", "hi")
    assert out == "OK"
    assert seen["auth"] == "Bearer sk-test"
    assert seen["body"]["model"] == "gpt-6-luna"
    assert seen["body"]["messages"] == [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "hi"},
    ]


async def test_openai_provider_maps_http_error() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "rate limited"}})

    provider = OpenAIProvider(api_key="sk-test", model="gpt-6-luna", transport=httpx.MockTransport(handler))
    with pytest.raises(UpstreamUnavailableError):
        await provider.complete("sys", "hi")


async def test_openai_provider_maps_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    provider = OpenAIProvider(api_key="sk-test", model="gpt-6-luna", transport=httpx.MockTransport(handler))
    with pytest.raises(UpstreamTimeoutError):
        await provider.complete("sys", "hi")


def test_factory_selects_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DB_USER", "ember")
    monkeypatch.setenv("DB_PASSWORD", "ember")
    monkeypatch.setenv("DB_NAME", "ember")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("LLM_MODEL", "gpt-6-luna")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    provider = get_llm_provider()
    assert isinstance(provider, OpenAIProvider)
    assert provider.name == "openai"
