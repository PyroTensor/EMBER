"""I1: extractor factory defaults + async HeuristicExtractor (no network)."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.ingestion.stages import llm_extract, parse  # noqa: E402
from app.ingestion.stages.llm_extract import (  # noqa: E402
    HeuristicExtractor,
    get_extractor,
    heuristic_investigation,
    resolve_extractor_kind,
)
from app.schemas.enums import Program  # noqa: E402

BASS_II_MD = BACKEND_DIR / "data" / "seed" / "iss_pages" / "bass_ii.md"


@pytest.fixture(autouse=True)
def _clear_settings() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_default_is_heuristic_even_when_rag_uses_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("EXTRACTOR", raising=False)
    assert get_settings().EXTRACTOR == "heuristic"
    assert resolve_extractor_kind() == "heuristic"
    assert isinstance(get_extractor(), HeuristicExtractor)


@pytest.mark.parametrize("alias", ["gemini", "openai", "GEMINI"])
def test_legacy_aliases_resolve_to_llm(alias: str, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger=llm_extract.__name__):
        assert resolve_extractor_kind(alias) == "llm"
    assert "legacy alias" in caplog.text


def test_llm_not_implemented_falls_back_with_warning(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger=llm_extract.__name__):
        ext = get_extractor("llm", max_pages=5, use_cache=False)
    assert isinstance(ext, HeuristicExtractor)
    assert "not implemented yet" in caplog.text


def test_extractor_setting_is_respected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EXTRACTOR", "llm")
    assert resolve_extractor_kind() == "llm"


def test_unknown_kind_raises() -> None:
    with pytest.raises(ValueError, match="unknown extractor"):
        resolve_extractor_kind("claude")


async def test_heuristic_async_results_unchanged_on_bass_ii() -> None:
    (doc,) = parse.parse_documents([BASS_II_MD])
    ext = HeuristicExtractor()
    inv = await ext.extract_investigation(doc)
    assert inv is not None
    assert inv.id == "BASS-II"
    assert inv.program is Program.BASS_II
    assert inv.source_doc_id == doc.doc_id
    assert inv.summary
    # same result as the sync helper used by the snapshot seed fallback
    assert inv == heuristic_investigation(doc)
    assert await ext.extract_test_runs(doc) == []
