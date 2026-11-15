"""I5: deterministic PDF / markdown table rows (no LLM, no network)."""

from __future__ import annotations

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
from app.ingestion.extractors.schemas import PageRunsExtraction  # noqa: E402
from app.ingestion.stages import normalize, parse, validate  # noqa: E402
from app.ingestion.stages.llm_extract import LLMExtractor  # noqa: E402
from app.ingestion.stages.table_rows import count_tables, rows_from_tables  # noqa: E402
from app.schemas.ingestion import Document, PageTable  # noqa: E402

MATRIX_MD = """---
doc_id: DOC-T
title: Test matrix paper
source_type: ntrs
investigation: BASS-II
---
<!-- page: 1 -->
Intro text only.

<!-- page: 2 -->
## Table 2. Test matrix (microgravity, ISS)

| Run ID | O2 (%) | Pressure (psia) | Flow (cm/s) | Sample | Fuel Geometry | Gravity (g) | Diluent | Result |
|---|---|---|---|---|---|---|---|---|
| T-01 | 21 | 14.7 | 10 | PMMA | Flat Sheet | 0 | N2 | Sustained Burn |
| T-02 | 17 | 10.2 | 5 | PMMA | Flat Sheet | 0 | N2 | Self-Extinguished |
|  |  |  |  |  |  |  |  |  |

| Material | O2 (%) | Note |
|---|---|---|
| Nomex | 30 | ignition only |
"""


@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CACHE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _doc(tmp_path: Path) -> Document:
    p = tmp_path / "matrix.md"
    p.write_text(MATRIX_MD, encoding="utf-8")
    (doc,) = parse.parse_documents([p])
    return doc


def test_markdown_pipe_tables_parsed(tmp_path: Path) -> None:
    doc = _doc(tmp_path)
    assert [t.page for t in doc.tables] == [2, 2]
    big, small = doc.tables
    assert big.header[:3] == ["Run ID", "O2 (%)", "Pressure (psia)"]
    assert len(big.rows) == 2  # the all-empty row is dropped
    assert small.header == ["Material", "O2 (%)", "Note"]


def test_table_rows_normalized_with_kpa_and_provenance(tmp_path: Path) -> None:
    doc = _doc(tmp_path)
    cmap = normalize.load_column_map()
    raw = rows_from_tables(doc, cmap)
    assert len(raw) == 2 and count_tables(raw) == 1  # 2-mapped-header table ignored
    rows = normalize.normalize_rows(raw, cmap)
    first = rows[0]
    assert first["experiment_id"] == "T-01"
    assert first["program"] == "BASS-II"  # filled from doc.metadata["investigation"]
    assert first["pressure_kpa"] == pytest.approx(101.353, abs=0.01)  # 14.7 psia -> kPa
    assert first["oxygen_pct"] == 21.0
    assert first["source_doc_id"] == "DOC-T" and first["source_page"] == 2
    assert first["extra_telemetry"]["extraction"]["provider"] == "table"
    assert doc.metadata["table_row_pages"] == [2]


def test_table_rows_validate_with_table_flag(tmp_path: Path) -> None:
    doc = _doc(tmp_path)
    cmap = normalize.load_column_map()
    rep = validate.validate_rows(
        normalize.normalize_rows(rows_from_tables(doc, cmap), cmap), write_queue=False
    )
    assert [r.experiment_id for r in rep.valid] == ["T-01", "T-02"], rep.rejected
    flags = rep.flags["T-01"]
    assert "extraction:table" in flags and "extraction:llm" not in flags
    assert "extraction:quote_not_found" not in flags and "extraction:low_confidence" not in flags


def test_table_with_two_mappable_headers_ignored() -> None:
    doc = Document(
        doc_id="D",
        title="D",
        source_type="ntrs",
        path="d.pdf",
        pages=["x"],
        tables=[PageTable(page=1, header=["Material", "O2 (%)", "Note"], rows=[["Nomex", "30", None]])],
    )
    assert rows_from_tables(doc, normalize.load_column_map()) == []
    assert "table_row_pages" not in doc.metadata


def test_synthetic_id_when_table_has_no_id_column() -> None:
    header = ["O2 (%)", "Pressure (kPa)", "Sample", "Fuel Geometry"]
    doc = Document(
        doc_id="D",
        title="D",
        source_type="ntrs",
        path="d.pdf",
        pages=["x", "y", "z"],
        tables=[PageTable(page=3, header=header, rows=[["21", "101.3", "PMMA", "Rod"]])],
    )
    (row,) = rows_from_tables(doc, normalize.load_column_map())
    assert row["experiment_id"] == "D-p003-t01-r01"
    assert "program" not in row  # no investigation metadata to fill from


class _CountingChain:
    def __init__(self) -> None:
        self.calls = 0

    @property
    def providers(self) -> list[str]:
        return ["openai"]

    async def extract(self, system: str, user: str, schema: type[BaseModel]) -> ChainResult:
        self.calls += 1
        parsed = PageRunsExtraction(runs=[])
        return ChainResult(parsed, "{}", "openai", "m", [])


async def test_mapped_page_is_skipped_by_llm(tmp_path: Path) -> None:
    doc = _doc(tmp_path)
    chain = _CountingChain()
    ext = LLMExtractor(chain, cache=ExtractionCache(tmp_path / "x"))  # type: ignore[arg-type]
    assert 2 in ext.candidate_pages(doc)
    rows_from_tables(doc, normalize.load_column_map())
    assert 2 not in ext.candidate_pages(doc)
    await ext.extract_test_runs(doc)
    assert chain.calls == 0


def test_pdf_tables_extracted(tmp_path: Path) -> None:
    fitz: Any = pytest.importorskip("fitz")
    pdf_path = tmp_path / "table.pdf"
    pdf = fitz.open()
    page = pdf.new_page()
    # plain alphanumeric cells: synthetic insert_text output can reorder punctuation / drop inner spaces
    cells = [
        ["RunID", "Oxygen", "Pressure", "Sample"],
        ["P1", "21", "101", "PMMA"],
        ["P2", "18", "70", "Nomex"],
    ]
    x0, y0, w, h = 72, 72, 110, 24
    for r, row in enumerate(cells):
        for c, text in enumerate(row):
            rect = fitz.Rect(x0 + c * w, y0 + r * h, x0 + (c + 1) * w, y0 + (r + 1) * h)
            page.draw_rect(rect, color=(0, 0, 0), width=0.8)
            page.insert_text((rect.x0 + 4, rect.y1 - 7), text, fontsize=10)
    pdf.save(pdf_path)
    pdf.close()

    doc = parse.parse_pdf(pdf_path)
    if not doc.tables:
        pytest.skip("PyMuPDF find_tables found no table in the synthetic PDF on this build")
    table = doc.tables[0]
    assert table.page == 1
    assert table.header == cells[0]
    assert table.rows == cells[1:]
    assert "PMMA" in doc.pages[0]  # tables still appended to page text for chunks / the LLM
