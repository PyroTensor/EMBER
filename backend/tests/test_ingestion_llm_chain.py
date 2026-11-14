"""I2: structured LLM chain (OpenAI primary, Gemini fallback) + extraction cache. No network."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, TypeVar

import httpx
import pytest
from pydantic import BaseModel, SecretStr

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.ingestion.extractors import (  # noqa: E402
    ChainResult,
    ExtractionCache,
    ExtractionError,
    GeminiStructured,
    OpenAIStructured,
    StructuredLLMChain,
    build_chain,
    cache_key,
)

T = TypeVar("T", bound=BaseModel)


class Thing(BaseModel):
    name: str
    value: float | None


class FakeLLM:
    def __init__(self, name: str, result: Thing | None = None, error: str | None = None) -> None:
        self.name = name
        self.model = f"{name}-model"
        self.result = result
        self.error = error
        self.calls = 0

    async def extract(self, system: str, user: str, schema: type[T]) -> tuple[T, str]:
        self.calls += 1
        if self.error:
            raise ExtractionError(self.name, self.error)  # type: ignore[arg-type]
        assert self.result is not None
        return schema.model_validate(self.result.model_dump()), self.result.model_dump_json()


# ── chain ─────────────────────────────────────────────────────────────


async def test_openai_ok_gemini_not_called() -> None:
    oa, gm = FakeLLM("openai", Thing(name="a", value=1.0)), FakeLLM("gemini", Thing(name="b", value=2.0))
    res = await StructuredLLMChain([oa, gm]).extract("sys", "user", Thing)
    assert res.ok and res.provider == "openai" and res.model == "openai-model"
    assert isinstance(res.parsed, Thing) and res.parsed.name == "a"
    assert res.attempts == []
    assert gm.calls == 0


async def test_openai_fails_gemini_used_and_attempt_recorded() -> None:
    oa, gm = FakeLLM("openai", error="refusal"), FakeLLM("gemini", Thing(name="b", value=None))
    res = await StructuredLLMChain([oa, gm]).extract("sys", "user", Thing)
    assert res.provider == "gemini"
    assert isinstance(res.parsed, Thing) and res.parsed.name == "b"
    assert res.attempts == [{"provider": "openai", "model": "openai-model", "error": "refusal"}]


async def test_both_fail_parsed_none() -> None:
    res = await StructuredLLMChain(
        [FakeLLM("openai", error="timeout"), FakeLLM("gemini", error="http")]
    ).extract("sys", "user", Thing)
    assert not res.ok and res.parsed is None and res.provider is None
    assert [a["error"] for a in res.attempts] == ["timeout", "http"]


async def test_validation_error_moves_to_next_client() -> None:
    class BadLLM(FakeLLM):
        async def extract(self, system: str, user: str, schema: type[T]) -> tuple[T, str]:
            return schema.model_validate({"name": 1}), "{}"

    res = await StructuredLLMChain(
        [BadLLM("openai"), FakeLLM("gemini", Thing(name="ok", value=0.0))]
    ).extract("s", "u", Thing)
    assert res.provider == "gemini"
    assert res.attempts[0]["error"] == "invalid_json"


def _settings(openai: str = "", gemini: str = "") -> Any:
    return get_settings().model_copy(
        update={"OPENAI_API_KEY": SecretStr(openai), "GEMINI_API_KEY": SecretStr(gemini)}
    )


def test_build_chain_none_without_keys() -> None:
    assert build_chain(_settings()) is None


def test_build_chain_order_openai_first() -> None:
    chain = build_chain(_settings(openai="sk-test", gemini="g-test"))
    assert chain is not None and chain.providers == ["openai", "gemini"]
    only_gemini = build_chain(_settings(gemini="g-test"))
    assert only_gemini is not None and only_gemini.providers == ["gemini"]


# ── cache ─────────────────────────────────────────────────────────────


async def test_cache_hit_skips_clients(tmp_path: Path) -> None:
    cache = ExtractionCache(tmp_path)
    oa = FakeLLM("gemini", Thing(name="cached", value=3.0))
    chain = StructuredLLMChain([oa])
    key = cache_key("inv-v1", Thing.__name__, "page text")

    async def extract_cached() -> dict[str, Any]:
        hit = cache.get("DOC-1", "inv", 1, key)
        if hit is not None:
            return hit
        res = await chain.extract("sys", "page text", Thing)
        cache.put("DOC-1", "inv", 1, key, prompt_version="inv-v1", result=res)
        assert res.parsed is not None
        return res.parsed.model_dump(mode="json")

    first = await extract_cached()
    second = await extract_cached()
    assert first == second == {"name": "cached", "value": 3.0}
    assert oa.calls == 1
    entry = json.loads(cache.path("DOC-1", "inv", 1).read_text(encoding="utf-8"))
    assert entry["provider"] == "gemini" and entry["prompt_version"] == "inv-v1"
    # a different prompt version / text is a different key
    assert cache.get("DOC-1", "inv", 1, cache_key("inv-v2", Thing.__name__, "page text")) is None


def test_failed_result_written_but_not_a_hit(tmp_path: Path) -> None:
    cache = ExtractionCache(tmp_path)
    key = cache_key("runs-v1", "Thing", "x")
    failed = ChainResult(None, None, None, None, [{"provider": "openai", "model": "m", "error": "timeout"}])
    p = cache.put("DOC-1", "runs", 7, key, prompt_version="runs-v1", result=failed)
    assert p.name == "runs_p007.json"
    assert json.loads(p.read_text(encoding="utf-8"))["parsed"] is None
    assert cache.get("DOC-1", "runs", 7, key) is None


def test_cache_path_is_sanitized(tmp_path: Path) -> None:
    p = ExtractionCache(tmp_path).path("../../evil doc", "inv", 2)
    assert p.resolve().is_relative_to(tmp_path.resolve())


# ── OpenAI client (httpx.MockTransport) ───────────────────────────────


def _completion(message: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 0,
        "model": "gpt-test",
        "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", **message}}],
    }


def _openai(handler: Any) -> OpenAIStructured:
    return OpenAIStructured(
        "sk-test",
        "gpt-test",
        timeout_s=5,
        max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


async def test_openai_refusal_raises_extraction_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_completion({"content": None, "refusal": "I can't help with that."}))

    with pytest.raises(ExtractionError) as exc:
        await _openai(handler).extract("sys", "user", Thing)
    assert exc.value.provider == "openai" and exc.value.reason == "refusal"


async def test_openai_parses_structured_output_with_strict_schema() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content))
        return httpx.Response(
            200, json=_completion({"content": '{"name": "PMMA", "value": 21.0}', "refusal": None})
        )

    parsed, raw = await _openai(handler).extract("sys", "user", Thing)
    assert parsed == Thing(name="PMMA", value=21.0) and json.loads(raw)["name"] == "PMMA"
    assert seen["temperature"] == 0 and seen["model"] == "gpt-test"
    assert seen["response_format"]["type"] == "json_schema"


async def test_openai_http_error_maps_to_http() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"message": "bad request"}})

    with pytest.raises(ExtractionError) as exc:
        await _openai(handler).extract("sys", "user", Thing)
    assert exc.value.reason == "http"


# ── Gemini client (fake SDK client) ───────────────────────────────────


class _FakeModels:
    def __init__(self, responses: list[Any]) -> None:
        self.responses = responses
        self.calls = 0

    async def generate_content(self, **kwargs: Any) -> Any:
        self.calls += 1
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _gemini(responses: list[Any], max_retries: int = 2) -> tuple[GeminiStructured, _FakeModels, list[float]]:
    models = _FakeModels(responses)
    sleeps: list[float] = []

    async def fake_sleep(s: float) -> None:
        sleeps.append(s)

    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    g = GeminiStructured("g-test", "gemini-test", 5, max_retries, client=client, sleep=fake_sleep)
    return g, models, sleeps


async def test_gemini_retries_429_then_parses_text() -> None:
    from google.genai import errors

    rate_limited = errors.APIError(429, {"error": {"message": "slow down", "status": "RESOURCE_EXHAUSTED"}})
    ok = SimpleNamespace(parsed=None, text='{"name": "Nomex", "value": null}')
    g, models, sleeps = _gemini([rate_limited, ok])
    parsed, _ = await g.extract("sys", "user", Thing)
    assert parsed == Thing(name="Nomex", value=None)
    assert models.calls == 2 and sleeps == [1.0]


async def test_gemini_bad_json_and_400_are_not_retried() -> None:
    from google.genai import errors

    g, models, _ = _gemini([SimpleNamespace(parsed=None, text="not json")])
    with pytest.raises(ExtractionError) as exc:
        await g.extract("sys", "user", Thing)
    assert exc.value.reason == "invalid_json"

    bad_request = errors.APIError(400, {"error": {"message": "bad", "status": "INVALID_ARGUMENT"}})
    g, models, sleeps = _gemini([bad_request])
    with pytest.raises(ExtractionError) as exc:
        await g.extract("sys", "user", Thing)
    assert exc.value.reason == "http" and models.calls == 1 and sleeps == []
