"""I4: LLM test-run extraction, provenance, review flags (fake chain, no network)."""

from __future__ import annotations

import csv
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.ingestion.extractors import ChainResult, ExtractionCache  # noqa: E402
from app.ingestion.extractors.schemas import PageRunsExtraction, RunExtraction  # noqa: E402
from app.ingestion.stages import normalize, validate  # noqa: E402
from app.ingestion.stages.llm_extract import LLMExtractor, is_candidate_page  # noqa: E402
from app.schemas.ingestion import Document  # noqa: E402

TABLE_PAGE = """## Test matrix
Opposed-flow flame spread over thin PMMA in microgravity aboard the ISS.

| Run ID | O2 (%) | Pressure (kPa) | Flow (cm/s) | Result |
|---|---|---|---|---|
| BASS-T07 | 21 | 101.3 | 10 | Sustained Burn, spread 0.12 cm/s |
| BASS-T08 | 17 | 101.3 | 5 | Self-Extinguished |
"""
PROSE_PAGE = "Introduction. Fire safety on spacecraft matters for crew health and mission success."


def _run(**overrides: Any) -> RunExtraction:
    data: dict[str, Any] = {
        "experiment_id": "BASS-T07",
        "program": "BASS-II",
        "fuel_material": "PMMA",
        "fuel_geometry": "Flat Sheet",
        "gravity_g": 0.0,
        "oxygen_pct": 21.0,
        "pressure_kpa": 101.3,
        "flow_velocity_cm_s": 10.0,
        "diluent_gas": "N2",
        "combustion_regime": "Sustained Burn",
        "spread_or_burn_rate": 0.12,
        "peak_radiative_flux_kw_m2": None,
        "limiting_oxygen_index_pct": None,
        "burn_duration_s": None,
        "confidence": 0.9,
        "evidence_quote": "| BASS-T07 | 21 | 101.3 | 10 | Sustained Burn, spread 0.12 cm/s |",
    }
    data.update(overrides)
    return RunExtraction.model_validate(data)


class FakeChain:
    def __init__(self, responder: Callable[[str], list[RunExtraction]]) -> None:
        self.responder = responder
        self.calls: list[str] = []

    @property
    def providers(self) -> list[str]:
        return ["openai"]

    async def extract(self, system: str, user: str, schema: type[BaseModel]) -> ChainResult:
        self.calls.append(user)
        parsed = PageRunsExtraction(runs=self.responder(user))
        return ChainResult(parsed, parsed.model_dump_json(), "openai", "gpt-test", [])


def _doc(doc_id: str = "DOC-X", pages: list[str] | None = None, **meta: Any) -> Document:
    return Document(
        doc_id=doc_id,
        title=doc_id,
        source_type="ntrs",
        path=f"{doc_id}.pdf",
        metadata=meta,
        pages=pages if pages is not None else [PROSE_PAGE, TABLE_PAGE],
    )


def _ext(chain: FakeChain, tmp_path: Path, **kw: Any) -> LLMExtractor:
    return LLMExtractor(chain, cache=ExtractionCache(tmp_path / "extractions"), **kw)  # type: ignore[arg-type]


@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CACHE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_prefilter_skips_prose_only_page() -> None:
    assert not is_candidate_page(PROSE_PAGE)
    assert is_candidate_page(TABLE_PAGE)
    # >= 6 numbers without a table also qualifies
    assert is_candidate_page("Oxygen 21, 17, 15 at 101.3, 70, 50 kPa were tested.")


async def test_provenance_from_code_even_if_llm_returns_other_doc_page(tmp_path: Path) -> None:
    chain = FakeChain(lambda text: [_run()])
    rows = await _ext(chain, tmp_path).extract_test_runs(_doc())
    assert len(chain.calls) == 1  # prose page skipped by the prefilter
    (row,) = rows
    assert row["source_doc_id"] == "DOC-X" and row["source_page"] == 2
    assert row["experiment_id"] == "BASS-T07"  # verbatim on the page -> kept
    ext = row["extra_telemetry"]["extraction"]
    assert ext["provider"] == "openai" and ext["model"] == "gpt-test" and ext["prompt_version"] == "runs-v1"
    assert ext["quote_found"] is True


async def test_synthetic_id_when_not_verbatim(tmp_path: Path) -> None:
    chain = FakeChain(lambda text: [_run(experiment_id="RUN-999"), _run(experiment_id=None)])
    rows = await _ext(chain, tmp_path).extract_test_runs(_doc())
    assert [r["experiment_id"] for r in rows] == ["DOC-X-p002-r01", "DOC-X-p002-r02"]


async def test_sparse_run_discarded(tmp_path: Path) -> None:
    sparse = _run(
        experiment_id=None,
        program=None,
        fuel_material="PMMA",
        fuel_geometry=None,
        gravity_g=None,
        oxygen_pct=21.0,
        pressure_kpa=101.3,
        flow_velocity_cm_s=None,
        diluent_gas=None,
        combustion_regime=None,
    )
    ext = _ext(FakeChain(lambda text: [sparse, _run()]), tmp_path)
    rows = await ext.extract_test_runs(_doc())
    assert len(rows) == 1 and ext.stats.discarded_sparse == 1


async def test_program_filled_from_doc_metadata(tmp_path: Path) -> None:
    ext = _ext(FakeChain(lambda text: [_run(program=None)]), tmp_path)
    (row,) = await ext.extract_test_runs(_doc(investigation="BASS-II"))
    assert row["program"] == "BASS-II"


async def test_budget_respected_across_two_docs(tmp_path: Path) -> None:
    chain = FakeChain(lambda text: [_run(experiment_id=None)])
    ext = _ext(chain, tmp_path, max_pages=3)
    two_tables = [TABLE_PAGE, TABLE_PAGE + "\n(second sheet)"]
    a = await ext.extract_test_runs(_doc("DOC-A", two_tables))
    b = await ext.extract_test_runs(_doc("DOC-B", two_tables))
    assert len(chain.calls) == 3
    assert len(a) == 2 and len(b) == 1
    assert ext.stats.budget_skipped == 1


async def test_cache_hit_on_second_run(tmp_path: Path) -> None:
    chain = FakeChain(lambda text: [_run()])
    first = await _ext(chain, tmp_path).extract_test_runs(_doc())
    second_ext = _ext(chain, tmp_path, max_pages=0)  # cache hits need no budget
    second = await second_ext.extract_test_runs(_doc())
    assert len(chain.calls) == 1 and second == first
    assert second_ext.stats.cache_hits == 1
    assert second[0]["extra_telemetry"]["extraction"]["provider"] == "openai"  # real provider, not "cache"
    await _ext(chain, tmp_path, use_cache=False).extract_test_runs(_doc())
    assert len(chain.calls) == 2


async def test_table_row_pages_skipped(tmp_path: Path) -> None:
    chain = FakeChain(lambda text: [_run()])
    assert await _ext(chain, tmp_path).extract_test_runs(_doc(table_row_pages=[2])) == []
    assert chain.calls == []


# ── validate: flags + queue ───────────────────────────────────────────


async def _validated(tmp_path: Path, runs: list[RunExtraction], csv_rows: list[dict[str, Any]] | None = None):
    rows = await _ext(FakeChain(lambda text: runs), tmp_path).extract_test_runs(_doc())
    all_rows = normalize.normalize_rows(csv_rows or []) + normalize.normalize_rows(rows)
    return validate.validate_rows(all_rows, write_queue=True)


async def test_quote_not_found_and_low_confidence_flags(tmp_path: Path) -> None:
    rep = await _validated(
        tmp_path, [_run(confidence=0.3, evidence_quote="a sentence that is not on the page")]
    )
    (flags,) = rep.flags.values()
    assert "extraction:llm" in flags
    assert "extraction:low_confidence" in flags
    assert "extraction:quote_not_found" in flags


async def test_good_row_only_llm_flag_and_queue_has_provenance(tmp_path: Path) -> None:
    rep = await _validated(tmp_path, [_run()])
    flags = rep.flags["BASS-T07"]
    assert "extraction:llm" in flags
    assert "extraction:low_confidence" not in flags and "extraction:quote_not_found" not in flags
    with validate.review_queue_path().open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert list(rows[0])[:3] == ["experiment_id", "source_doc_id", "source_page"]
    assert rows[0]["experiment_id"] == "BASS-T07"
    assert rows[0]["source_doc_id"] == "DOC-X" and rows[0]["source_page"] == "2"


async def test_csv_wins_on_duplicate_id(tmp_path: Path) -> None:
    csv_row = {
        "experiment_id": "BASS-T07",
        "program": "BASS-II",
        "fuel_material": "PMMA",
        "fuel_geometry": "Flat Sheet",
        "gravity_g": "0",
        "oxygen_pct": "21",
        "pressure_kpa": "101.3",
        "flow_velocity_cm_s": "12",
        "diluent_gas": "N2",
        "combustion_regime": "Sustained Burn",
    }
    rep = await _validated(tmp_path, [_run()], csv_rows=[csv_row])
    (kept,) = [r for r in rep.valid if r.experiment_id == "BASS-T07"]
    assert kept.flow_velocity_cm_s == 12.0 and "extraction" not in kept.extra_telemetry
    assert any("duplicate" in e for rej in rep.rejected for e in rej["errors"])
    (rejected,) = rep.rejected
    assert rejected["row"]["source_doc_id"] == "DOC-X"  # rejected rows still show doc/page in the queue


async def test_old_queue_without_provenance_columns_keeps_signoffs(tmp_path: Path) -> None:
    queue = validate.review_queue_path()
    queue.parent.mkdir(parents=True, exist_ok=True)
    queue.write_text(
        "experiment_id,n_flags,flags,reviewed_by,decision\nBASS-T07,1,extraction:llm,alice,accept\n",
        encoding="utf-8",
    )
    await _validated(tmp_path, [_run()])
    with queue.open(encoding="utf-8") as fh:
        (row,) = list(csv.DictReader(fh))
    assert (row["reviewed_by"], row["decision"]) == ("alice", "accept")
