"""Stage 4a - deterministic table rows: ``Document.tables`` -> raw test-run rows (no LLM, free and exact).

A table is used only when at least ``MIN_MAPPED_REQUIRED`` of the 10 required schema_v1 fields map from its
header through the SAME column map the CSVs use (``normalize._build_lookup``). Each non-empty row becomes a
raw row keyed by the original header cells, so ``normalize_rows`` applies the same units, aliases and
``extra_telemetry`` rules as for CSV files. Provenance (``source_doc_id`` / ``source_page``) is set here by
code. Pages that produced rows are recorded in ``doc.metadata["table_row_pages"]`` so the LLM extractor
(``LLMExtractor.candidate_pages``) skips them.
"""

from __future__ import annotations

from typing import Any

from app.ingestion.stages import normalize
from app.ingestion.stages.llm_extract import REQUIRED_RUN_FIELDS
from app.schemas.ingestion import Document, PageTable

MIN_MAPPED_REQUIRED = 4


def mapped_required_fields(table: PageTable, lookup: dict[str, tuple[str, str | None]]) -> set[str]:
    """Required schema_v1 fields that the table header maps to."""
    fields = {lookup[h.strip().lower()][0] for h in table.header if h and h.strip().lower() in lookup}
    return fields & set(REQUIRED_RUN_FIELDS)


def rows_from_tables(doc: Document, column_map: dict[str, Any]) -> list[dict[str, Any]]:
    lookup = normalize._build_lookup(column_map)
    rows: list[dict[str, Any]] = []
    used_pages: set[int] = set()
    investigation = doc.metadata.get("investigation")
    for t_idx, table in enumerate(doc.tables, start=1):
        mapped = mapped_required_fields(table, lookup)
        if len(mapped) < MIN_MAPPED_REQUIRED:
            continue
        before = len(rows)
        for r_idx, cells in enumerate(table.rows, start=1):
            if not any(c is not None and c.strip() for c in cells):
                continue
            raw: dict[str, Any] = {h: c for h, c in zip(table.header, cells, strict=False) if h}
            if "experiment_id" not in mapped or not _cell(raw, lookup, "experiment_id"):
                raw["experiment_id"] = f"{doc.doc_id}-p{table.page:03d}-t{t_idx:02d}-r{r_idx:02d}"
            if investigation and ("program" not in mapped or not _cell(raw, lookup, "program")):
                raw["program"] = investigation
            raw["source_doc_id"] = doc.doc_id
            raw["source_page"] = table.page
            raw["extra_telemetry"] = {
                "extraction": {"provider": "table", "confidence": 1.0, "quote_found": True, "table": t_idx}
            }
            rows.append(raw)
        if len(rows) > before:
            used_pages.add(table.page)
    if used_pages:
        previous = {int(p) for p in doc.metadata.get("table_row_pages", [])}
        doc.metadata["table_row_pages"] = sorted(previous | used_pages)
    return rows


def _cell(raw: dict[str, Any], lookup: dict[str, tuple[str, str | None]], field: str) -> str | None:
    """First non-empty cell whose header maps to ``field``."""
    for header, value in raw.items():
        mapped = lookup.get(str(header).strip().lower())
        if mapped and mapped[0] == field and value is not None and str(value).strip():
            return str(value)
    return None


def count_tables(rows: list[dict[str, Any]]) -> int:
    """Distinct (doc, page, table) that produced rows (for the stage log)."""
    return len(
        {
            (r.get("source_doc_id"), r.get("source_page"), r["extra_telemetry"]["extraction"].get("table"))
            for r in rows
        }
    )


__all__ = ["MIN_MAPPED_REQUIRED", "count_tables", "mapped_required_fields", "rows_from_tables"]
