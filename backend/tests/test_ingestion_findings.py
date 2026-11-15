"""I10: combustion_findings - gate, sources, validation, dedupe, queue, payload (fake chain, no network)."""

from __future__ import annotations

import csv
import sys
from pathlib import Path
from typing import Any

import pytest
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.ingestion.extractors import ChainResult, ExtractionCache  # noqa: E402
from app.ingestion.extractors.schemas import FindingExtraction, PageExtraction, RunExtraction  # noqa: E402
from app.ingestion.stages import findings, normalize, validate  # noqa: E402
from app.ingestion.stages.llm_extract import LLMExtractor  # noqa: E402
from app.ingestion.stages.load import build_payload  # noqa: E402
from app.repositories.snapshot.store import SnapshotStore  # noqa: E402
from app.schemas.ingestion import Document, FindingCategory, GravityContext, PageTable  # noqa: E402

ALIASES = normalize.load_column_map().get("aliases", {})


@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CACHE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _doc(pages: list[str], doc_id: str = "DOC-F", **meta: Any) -> Document:
    return Document(
        doc_id=doc_id, title=doc_id, source_type="ntrs", path=f"{doc_id}.pdf", metadata=meta, pages=pages
    )


def _fx(**overrides: Any) -> FindingExtraction:
    data: dict[str, Any] = {
        "category": "flammability_limit",
        "gravity_context": "microgravity",
        "statement": "The limiting oxygen index of Nomex in microgravity was 25%.",
        "subject": "Nomex",
        "program": "BASS 2",
        "quantity": "LOI",
        "value_num": 25.0,
        "value_text": None,
        "unit": "%",
        "oxygen_pct": None,
        "pressure_kpa": 101.3,
        "gravity_g": None,
        "flow_velocity_cm_s": None,
        "diluent_gas": None,
        "fuel_geometry": None,
        "temperature_k": None,
        "evidence_quote": "LOI of Nomex in microgravity was 25%",
        "confidence": 0.9,
        "relevance": 0.9,
        "is_microgravity_combustion": True,
    }
    data.update(overrides)
    return FindingExtraction.model_validate(data)


META = {"provider": "openai", "model": "gpt-test", "prompt_version": "page-v2"}


# ── gate ──────────────────────────────────────────────────────────────


def test_gate_1g_loi_without_gravity_context_rejected() -> None:
    page = "Table 4: LOI of Nomex in 1 g air was 28%. Samples were burned in a standard chamber."
    fx = _fx(
        statement="The LOI of Nomex in 1 g air was 28%.",
        evidence_quote="LOI of Nomex in 1 g air was 28%",
        gravity_context="normal_g_baseline",
        gravity_g=1.0,
    )
    finding, reason = findings.finding_from_llm(
        fx, _doc([page]), 1, page, META, min_relevance=0.7, aliases=ALIASES
    )
    assert finding is None and "gravity" in reason


def test_gate_1g_loi_next_to_iss_context_is_normal_g_baseline() -> None:
    page = (
        "Aboard the ISS, Nomex was tested in microgravity. "
        "For comparison, the LOI of Nomex in 1 g air was 28%."
    )
    fx = _fx(
        statement="The LOI of Nomex in 1 g air was 28%.",
        evidence_quote="the LOI of Nomex in 1 g air was 28%",
        gravity_context="normal_g_baseline",
        gravity_g=1.0,
    )
    finding, _ = findings.finding_from_llm(
        fx, _doc([page]), 1, page, META, min_relevance=0.7, aliases=ALIASES
    )
    assert finding is not None
    assert finding.gravity_context is GravityContext.NORMAL_G_BASELINE
    rep = findings.validate_findings([finding], write_queue=False)
    assert "finding:normal_g_baseline" in rep.kept[0].review_flags


def test_gate_terrestrial_wildfire_is_off_topic() -> None:
    page = "Terrestrial wildfire spread rates in grassland reached 2 m/s under 30 km/h winds."
    fx = _fx(
        category="flame_spread",
        statement="Wildfire spread rates reached 2 m/s.",
        evidence_quote="Terrestrial wildfire spread rates in grassland reached 2 m/s",
        is_microgravity_combustion=False,
    )
    finding, _ = findings.finding_from_llm(
        fx, _doc([page]), 1, page, META, min_relevance=0.7, aliases=ALIASES
    )
    assert finding is None
    ok, _, reason = findings.is_microgravity_combustion(page, {}, {})
    assert not ok and "gravity" in reason


def test_llm_low_relevance_dropped() -> None:
    page = "In microgravity aboard the ISS the flame extinguished at 15% O2."
    fx = _fx(relevance=0.4, evidence_quote="the flame extinguished at 15% O2")
    finding, reason = findings.finding_from_llm(
        fx, _doc([page]), 1, page, META, min_relevance=0.7, aliases=ALIASES
    )
    assert finding is None and "relevance" in reason


# ── LLM page extraction (page-v2) ─────────────────────────────────────


RESULTS_PAGE = """Results aboard the ISS (microgravity).
| Run ID | O2 (%) | Pressure (kPa) | Flow (cm/s) |
|---|---|---|---|
| R-01 | 21 | 101.3 | 10 |
The limiting oxygen index of Nomex in microgravity was 25%. Soot volume fraction peaked at 3 ppm.
"""


def _run(**overrides: Any) -> RunExtraction:
    data: dict[str, Any] = {
        "experiment_id": "R-01",
        "program": "BASS-II",
        "fuel_material": "PMMA",
        "fuel_geometry": "Flat Sheet",
        "gravity_g": 0.0,
        "oxygen_pct": 21.0,
        "pressure_kpa": 101.3,
        "flow_velocity_cm_s": 10.0,
        "diluent_gas": "N2",
        "combustion_regime": "Sustained Burn",
        "spread_or_burn_rate": None,
        "peak_radiative_flux_kw_m2": None,
        "limiting_oxygen_index_pct": None,
        "burn_duration_s": None,
        "confidence": 0.9,
        "evidence_quote": "| R-01 | 21 | 101.3 | 10 |",
    }
    data.update(overrides)
    return RunExtraction.model_validate(data)


class PageChain:
    def __init__(self, parsed: PageExtraction) -> None:
        self.parsed = parsed
        self.schemas: list[str] = []

    @property
    def providers(self) -> list[str]:
        return ["openai"]

    async def extract(self, system: str, user: str, schema: type[BaseModel]) -> ChainResult:
        self.schemas.append(schema.__name__)
        return ChainResult(self.parsed, self.parsed.model_dump_json(), "openai", "gpt-test", [])


def _llm(chain: PageChain, tmp_path: Path) -> LLMExtractor:
    return LLMExtractor(chain, cache=ExtractionCache(tmp_path / "ex"), extract_findings=True)  # type: ignore[arg-type]


async def test_page_with_run_and_two_findings(tmp_path: Path) -> None:
    soot = _fx(
        category="soot_radiation",
        statement="Soot volume fraction peaked at 3 ppm.",
        subject=None,
        quantity="soot volume fraction",
        value_num=3.0,
        unit="ppm",
        evidence_quote="Soot volume fraction peaked at 3 ppm.",
    )
    loi_fx = _fx(evidence_quote="The limiting oxygen index of Nomex in microgravity was 25%.")
    chain = PageChain(PageExtraction(runs=[_run()], findings=[loi_fx, soot]))
    ext = _llm(chain, tmp_path)
    rows = await ext.extract_test_runs(_doc(["Cover", RESULTS_PAGE]))
    assert chain.schemas == ["PageExtraction"]  # one call per page for runs AND findings
    (row,) = rows
    assert (
        row["experiment_id"] == "R-01" and row["extra_telemetry"]["extraction"]["prompt_version"] == "page-v2"
    )
    assert len(ext.findings) == 2
    for f in ext.findings:
        assert (f.source_doc_id, f.source_page) == ("DOC-F", 2)  # set by code
        assert f.origin == "llm" and f.extraction["prompt_version"] == "page-v2"
        assert f.quote_found is True
    loi = next(f for f in ext.findings if f.quantity == "LOI")
    assert loi.investigation_id == "BASS-II" and loi.program == "BASS 2"  # alias -> known Program
    assert "source_doc_id" not in FindingExtraction.model_fields  # the LLM cannot even send provenance


async def test_findings_off_keeps_runs_v1_prompt(tmp_path: Path) -> None:
    chain = PageChain(PageExtraction(runs=[_run()], findings=[_fx()]))
    ext = LLMExtractor(chain, cache=ExtractionCache(tmp_path / "ex"))  # type: ignore[arg-type]
    await ext.extract_test_runs(_doc([RESULTS_PAGE]))
    assert chain.schemas == ["PageRunsExtraction"] and ext.findings == []


async def test_sparse_run_becomes_out_of_schema_run(tmp_path: Path) -> None:
    sparse = _run(
        experiment_id=None,
        program=None,
        fuel_geometry=None,
        flow_velocity_cm_s=None,
        diluent_gas=None,
        combustion_regime=None,
        pressure_kpa=None,
        evidence_quote="The limiting oxygen index of Nomex in microgravity was 25%.",
    )
    chain = PageChain(PageExtraction(runs=[sparse], findings=[]))
    ext = _llm(chain, tmp_path)
    assert await ext.extract_test_runs(_doc([RESULTS_PAGE])) == []
    (f,) = ext.findings
    assert f.category is FindingCategory.OUT_OF_SCHEMA_RUN
    assert f.conditions["oxygen_pct"] == 21.0 and f.subject == "PMMA"
    assert ext.stats.sparse_to_findings == 1 and ext.stats.discarded_sparse == 1


def test_finding_pages_qualify_without_run_signals(tmp_path: Path) -> None:
    page = "Aboard the ISS the droplet flame extinguished after 12 s."
    ext = _llm(PageChain(PageExtraction(runs=[], findings=[])), tmp_path)
    assert ext.candidate_pages(_doc([page])) == [1]
    no_findings = LLMExtractor(
        PageChain(PageExtraction(runs=[], findings=[])), cache=ExtractionCache(tmp_path)
    )  # type: ignore[arg-type]
    assert no_findings.candidate_pages(_doc([page])) == []


# ── validate: dedupe, duplicates of runs, signoffs ────────────────────


def test_finding_duplicating_a_run_quote_is_dropped() -> None:
    page = RESULTS_PAGE
    finding, _ = findings.finding_from_llm(
        _fx(evidence_quote="| R-01 | 21 | 101.3 | 10 |"),
        _doc([page]),
        1,
        page,
        META,
        min_relevance=0.7,
        aliases=ALIASES,
    )
    assert finding is not None
    run_row = normalize.normalize_rows(
        [
            {
                **_run().model_dump(exclude={"confidence", "evidence_quote"}),
                "source_doc_id": "DOC-F",
                "source_page": 1,
                "extra_telemetry": {"extraction": {"evidence_quote": "| R-01 | 21 | 101.3 | 10 |"}},
            }
        ]
    )
    runs = validate.validate_rows(run_row, write_queue=False).valid
    rep = findings.validate_findings([finding], runs, write_queue=False)
    assert rep.kept == [] and rep.dropped_as_run == 1


def test_dedupe_keeps_higher_confidence() -> None:
    page = "In microgravity the LOI of Nomex was 25%."
    low, _ = findings.finding_from_llm(
        _fx(confidence=0.5), _doc([page]), 1, page, META, min_relevance=0.7, aliases=ALIASES
    )
    high, _ = findings.finding_from_llm(
        _fx(confidence=0.95), _doc([page]), 1, page, META, min_relevance=0.7, aliases=ALIASES
    )
    assert low is not None and high is not None and low.finding_id == high.finding_id
    rep = findings.validate_findings([low, high], write_queue=False)
    (kept,) = rep.kept
    assert kept.confidence == 0.95 and rep.deduped == 1
    assert "finding:low_confidence" not in kept.review_flags


def test_hard_rejects() -> None:
    base, _ = findings.finding_from_llm(
        _fx(),
        _doc(["In microgravity the LOI of Nomex was 25%."]),
        1,
        "In microgravity ...",
        META,
        min_relevance=0.7,
        aliases=ALIASES,
    )
    assert base is not None
    bad_range = base.model_copy(update={"conditions": {"oxygen_pct": 140.0}, "finding_id": "x1"})
    no_source = base.model_copy(update={"source_doc_id": None, "source_page": None, "finding_id": "x2"})
    rep = findings.validate_findings([bad_range, no_source], write_queue=False)
    assert rep.kept == []
    errors = [e for r in rep.rejected for e in r["errors"]]
    assert any("oxygen_pct" in e for e in errors) and any("source" in e for e in errors)


def test_signoffs_survive_rerun() -> None:
    page = "In microgravity the LOI of Nomex was 25%."
    f, _ = findings.finding_from_llm(_fx(), _doc([page]), 1, page, META, min_relevance=0.7, aliases=ALIASES)
    assert f is not None
    findings.validate_findings([f], write_queue=True)
    queue = findings.findings_review_queue_path()
    rows = list(csv.DictReader(queue.open(encoding="utf-8")))
    rows[0]["reviewer"], rows[0]["signoff"] = "alice", "accept"
    with queue.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    findings.validate_findings([f], write_queue=True)
    (row,) = list(csv.DictReader(queue.open(encoding="utf-8")))
    assert (row["finding_id"], row["reviewer"], row["signoff"]) == (f.finding_id, "alice", "accept")


# ── source c: CSV enum-only rejects ───────────────────────────────────


def _csv_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "experiment_id": "EXP-9001",
        "program": "BASS-II",
        "fuel_material": "n-Dodecane",
        "fuel_geometry": "Droplet",
        "gravity_g": "0",
        "oxygen_pct": "21",
        "pressure_kpa": "101.3",
        "flow_velocity_cm_s": "0",
        "diluent_gas": "N2",
        "combustion_regime": "Sustained Burn",
    }
    row.update(overrides)
    return row


def test_csv_enum_only_reject_becomes_finding() -> None:
    # (the step names "Ethanol", but this column_map aliases Ethanol -> Methanol, so it is a valid row here)
    rows = normalize.normalize_rows([_csv_row(), _csv_row(experiment_id="EXP-9002", oxygen_pct="140")])
    rep = validate.validate_rows(rows, write_queue=False)
    assert len(rep.rejected) == 2 and rep.enum_only == [rows[0]]  # the 140% O2 row is a real error
    origins = {id(rows[0]): ("runs.csv", 1), id(rows[1]): ("runs.csv", 2)}
    found, off = findings.findings_from_enum_rejects(rep.enum_only, origins)
    (f,) = found
    assert off == 0
    assert f.origin == "csv_reject" and f.category is FindingCategory.OUT_OF_SCHEMA_RUN
    assert (f.source_file, f.source_row, f.source_doc_id) == ("runs.csv", 1, None)
    assert f.subject == "n-Dodecane" and f.conditions["gravity_g"] == 0.0
    assert f.investigation_id == "BASS-II"


def test_csv_reject_at_1g_without_context_is_off_topic() -> None:
    rows = normalize.normalize_rows([_csv_row(gravity_g="1")])
    rep = validate.validate_rows(rows, write_queue=False)
    found, off = findings.findings_from_enum_rejects(rep.enum_only, {id(rows[0]): ("runs.csv", 1)})
    assert found == [] and off == 1


# ── source b: tables ──────────────────────────────────────────────────


def test_two_header_material_loi_table_gives_findings_with_percent_unit() -> None:
    table = PageTable(page=1, header=["Material", "LOI (%)"], rows=[["Nomex", "25"], ["PMMA", "17.5"]])
    doc = _doc(["Limiting oxygen index measured aboard the ISS"], tables=[table])
    doc.tables = [table]
    found, off = findings.findings_from_tables(doc, normalize.load_column_map())
    assert off == 0 and len(found) == 2
    nomex = next(f for f in found if f.subject == "Nomex")
    assert nomex.unit == "%" and nomex.value_num == 25.0 and nomex.quantity == "LOI"
    assert nomex.category is FindingCategory.FLAMMABILITY_LIMIT and nomex.origin == "table"
    assert (nomex.source_doc_id, nomex.source_page) == ("DOC-F", 1)


def test_run_tables_are_left_to_table_rows() -> None:
    header = ["Run ID", "O2 (%)", "Pressure (kPa)", "Sample", "LOI"]
    table = PageTable(page=1, header=header, rows=[["T-1", "21", "101.3", "PMMA", "18"]])
    doc = _doc(["microgravity flame tests on the ISS"])
    doc.tables = [table]
    assert findings.findings_from_tables(doc, normalize.load_column_map()) == ([], 0)


# ── payload / snapshot ────────────────────────────────────────────────


def test_build_payload_includes_findings_and_old_snapshot_loads() -> None:
    page = "In microgravity the LOI of Nomex was 25%."
    doc = _doc([page])
    f, _ = findings.finding_from_llm(_fx(), doc, 1, page, META, min_relevance=0.7, aliases=ALIASES)
    assert f is not None
    payload = build_payload([], [doc], {}, [], {}, {}, [], [], [f])
    (row,) = payload["combustion_findings"]
    assert row["finding_id"] == f.finding_id and row["investigation_id"] is None  # no investigation loaded
    assert build_payload([], [doc], {}, [], {}, {}, [], [])["combustion_findings"] == []
    assert SnapshotStore({"test_runs": []}, source="file").combustion_findings == []
    assert SnapshotStore(payload, source="file").combustion_findings == [row]
