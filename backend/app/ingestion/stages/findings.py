"""Stage 4b - combustion findings (I10): microgravity-combustion data that fits no other table.

Sources (all feed one ``list[CombustionFinding]``):
  a. LLM page extraction (``--extractor llm``, prompt ``page-v2``): findings + sparse runs  -> llm_extract.py
  b. tables with 1-3 mapped required headers, or with LOI / extinction / ignition / soot ... headers
  c. CSV rows rejected ONLY because an enum value is outside schema_v1 (``ValidationReport.enum_only``)

Everything passes the deterministic relevance gate ``is_microgravity_combustion`` (it has the final say;
LLM findings must ALSO report ``relevance >= FINDINGS_MIN_RELEVANCE``), then ``validate_findings`` (hard
rejects, soft ``finding:*`` flags, dedupe, drop findings that duplicate a run) and its own review queue
``<CACHE_DIR>/findings_review_queue.csv``. Provenance is always set by code, never by the LLM.
"""

from __future__ import annotations

import csv
import hashlib
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from annotated_types import Ge, Le

from app.core.config import get_settings
from app.ingestion.extractors.schemas import FindingExtraction, RunExtraction
from app.ingestion.stages import normalize
from app.schemas.enums import Program
from app.schemas.experiment import TestRunRecord
from app.schemas.ingestion import CombustionFinding, Document, FindingCategory, GravityContext, PageTable

# ── relevance gate ────────────────────────────────────────────────────

_GRAVITY_RE = re.compile(
    r"micro-?gravity|µg|μg|micro-g\b|reduced[- ]gravity|low[- ]gravity|zero[- ]g\b|\bISS\b|space station|"
    r"drop tower|parabolic|sounding rocket|spacecraft|\blunar\b|\bmartian\b|partial[- ]gravity",
    re.IGNORECASE,
)
_COMBUSTION_RE = re.compile(
    r"combust|flame|\bfire|ignit|\bburn|extinct|smold|smould|soot|flammab|\bLOI\b|oxygen index|droplet",
    re.IGNORECASE,
)
_PARTIAL_RE = re.compile(r"\blunar\b|\bmoon\b|\bmartian\b|\bmars\b|partial[- ]gravity", re.IGNORECASE)
_NORMAL_G_RE = re.compile(
    r"\b1\s?-?g\b|normal[- ]gravity|earth gravity|terrestrial|ground[- ]based", re.IGNORECASE
)
_NUMBER_WITH_UNIT_RE = re.compile(
    r"\d(?:[\d.,]*)\s?(?:%|kPa|psia|atm|mm\s?Hg|cm/s|mm/s|mm2/s|mm²/s|kW/m2|kW/m²|W/cm2|ppm|K\b|°C|s\b|mm\b|g\b)",
    re.IGNORECASE,
)
MAX_GRAVITY_G = 0.4  # conditions.gravity_g at or below this counts as reduced gravity


def _gravity_g(conditions: dict[str, Any]) -> float | None:
    g = conditions.get("gravity_g")
    return float(g) if isinstance(g, (int, float)) and not isinstance(g, bool) else None


def is_microgravity_combustion(
    text: str, doc_metadata: dict[str, Any], conditions: dict[str, Any]
) -> tuple[bool, float, str]:
    """Deterministic gate: BOTH a gravity signal AND a combustion signal. Returns (ok, score, reason).

    Gravity signal: a reduced-gravity word in ``text``, ``conditions.gravity_g <= 0.4``, or a document that
    belongs to an investigation. ``text`` should include the page (or row) context, so 1 g baseline data is
    accepted only next to microgravity context.
    """
    g_hits = {m.group(0).lower() for m in _GRAVITY_RE.finditer(text)}
    g = _gravity_g(conditions)
    if g is not None and g <= MAX_GRAVITY_G:
        g_hits.add("conditions.gravity_g")
    if doc_metadata.get("investigation"):
        g_hits.add("doc.investigation")
    c_hits = {m.group(0).lower() for m in _COMBUSTION_RE.finditer(text)}
    if not g_hits and not c_hits:
        return False, 0.0, "no gravity and no combustion signal"
    if not g_hits:
        return False, 0.3, "no reduced-gravity signal"
    if not c_hits:
        return False, 0.3, "no combustion signal"
    score = min(1.0, 0.4 + 0.15 * min(len(g_hits), 2) + 0.15 * min(len(c_hits), 2))
    return True, round(score, 2), f"gravity: {sorted(g_hits)[:3]}, combustion: {sorted(c_hits)[:3]}"


def has_number_with_unit(text: str) -> bool:
    return bool(_NUMBER_WITH_UNIT_RE.search(text))


def classify_gravity(declared: str | None, text: str, conditions: dict[str, Any]) -> GravityContext:
    """conditions.gravity_g first, then the LLM's declared value, then words in ``text``."""
    g = _gravity_g(conditions)
    if g is not None:
        if g <= 0.05:
            return GravityContext.MICROGRAVITY
        if g <= MAX_GRAVITY_G:
            return GravityContext.PARTIAL_GRAVITY
        return GravityContext.NORMAL_G_BASELINE
    if declared:
        try:
            return GravityContext(declared.strip().lower())
        except ValueError:
            pass
    if _NORMAL_G_RE.search(text) and not _GRAVITY_RE.search(text):
        return GravityContext.NORMAL_G_BASELINE
    if _PARTIAL_RE.search(text):
        return GravityContext.PARTIAL_GRAVITY
    return GravityContext.MICROGRAVITY


# ── building findings ─────────────────────────────────────────────────

CONDITION_KEYS = (
    "oxygen_pct",
    "pressure_kpa",
    "gravity_g",
    "flow_velocity_cm_s",
    "diluent_gas",
    "fuel_geometry",
    "temperature_k",
)
_TEXT_CONDITIONS = frozenset({"diluent_gas", "fuel_geometry"})
REQUIRED_FIELDS = (  # schema_v1 required fields (same list as llm_extract.REQUIRED_RUN_FIELDS)
    "experiment_id",
    "program",
    "fuel_material",
    "fuel_geometry",
    "gravity_g",
    "oxygen_pct",
    "pressure_kpa",
    "flow_velocity_cm_s",
    "diluent_gas",
    "combustion_regime",
)
ENUM_FIELDS = frozenset({"program", "fuel_material", "fuel_geometry", "diluent_gas", "combustion_regime"})
_PROGRAM_LOOKUP = {p.value.lower(): p for p in Program}
_STATEMENT_MAX = 400
_QUOTE_MAX = 200


def _normalise(text: str) -> str:
    return re.sub(r"[\s|]+", " ", text).strip().lower()


def _clean_conditions(raw: dict[str, Any]) -> dict[str, float | str]:
    out: dict[str, float | str] = {}
    for key in CONDITION_KEYS:
        value = raw.get(key)
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        if key in _TEXT_CONDITIONS:
            out[key] = str(value).strip()
        else:
            num = normalize._num(value)
            if num is not None:
                out[key] = round(num, 4)
    return out


def _fmt(value: Any) -> str:
    return "" if value is None else f"{value:g}" if isinstance(value, float) else str(value).strip()


def fingerprint(f: dict[str, Any]) -> str:
    """Identity of a finding. Includes ``value_text`` and the conditions so that two table rows with the
    same quantity but different conditions (e.g. "higher" at 0.16 g vs 0.38 g) stay distinct."""
    conditions = f.get("conditions") or {}
    parts = [
        f.get("category"),
        f.get("subject"),
        f.get("quantity"),
        f.get("value_num"),
        f.get("value_text"),
        f.get("unit"),
        ";".join(f"{k}={_fmt(conditions[k])}" for k in sorted(conditions)),
        f.get("source_doc_id"),
        f.get("source_page"),
        f.get("source_file"),
        f.get("source_row"),
    ]
    return "|".join(_normalise(_fmt(p)) for p in parts)


def make_finding(**fields: Any) -> CombustionFinding:
    """Build a finding; ``finding_id`` = sha256(fingerprint)[:16] (stable across re-runs)."""
    fields["statement"] = re.sub(r"\s+", " ", str(fields.get("statement") or "")).strip()[:_STATEMENT_MAX]
    quote = fields.get("evidence_quote")
    fields["evidence_quote"] = str(quote).strip()[:_QUOTE_MAX] if quote else None
    fields["finding_id"] = hashlib.sha256(fingerprint(fields).encode()).hexdigest()[:16]
    return CombustionFinding(**fields)


def _program_fields(raw_program: str | None, aliases: dict[str, Any]) -> tuple[str | None, str | None]:
    """(program as written, investigation_id when it maps to a known Program)."""
    if not raw_program or not str(raw_program).strip():
        return None, None
    program = str(raw_program).strip()
    mapped = _PROGRAM_LOOKUP.get(str(normalize._alias("program", program, aliases)).strip().lower())
    return program, mapped.value if mapped else None


def _category(raw: str | None) -> FindingCategory:
    try:
        return FindingCategory((raw or "").strip().lower())
    except ValueError:
        return FindingCategory.OTHER


def finding_from_llm(
    fx: FindingExtraction,
    doc: Document,
    page_no: int,
    page_text: str,
    meta: dict[str, str],
    *,
    min_relevance: float,
    aliases: dict[str, Any],
) -> tuple[CombustionFinding | None, str]:
    """(finding, "") or (None, reason) when the finding is off-topic."""
    conditions = _clean_conditions(fx.model_dump())
    ok, score, reason = is_microgravity_combustion(
        f"{fx.statement}\n{fx.evidence_quote}\n{page_text}", doc.metadata, conditions
    )
    if not fx.is_microgravity_combustion:
        return None, "llm: not microgravity combustion"
    if not ok:
        return None, f"gate: {reason}"
    if fx.relevance < min_relevance:
        return None, f"llm relevance {fx.relevance:.2f} < {min_relevance:.2f}"
    program, inv = _program_fields(fx.program or doc.metadata.get("investigation"), aliases)
    quote = fx.evidence_quote.strip()[:_QUOTE_MAX]
    return (
        make_finding(
            category=_category(fx.category),
            gravity_context=classify_gravity(fx.gravity_context, f"{fx.statement} {quote}", conditions),
            statement=fx.statement,
            subject=fx.subject,
            program=program,
            investigation_id=inv,
            quantity=fx.quantity,
            value_num=fx.value_num,
            value_text=fx.value_text,
            unit=fx.unit,
            conditions=conditions,
            origin="llm",
            source_doc_id=doc.doc_id,
            source_page=page_no,
            evidence_quote=quote,
            quote_found=bool(quote) and _normalise(quote) in _normalise(page_text),
            confidence=min(max(fx.confidence, 0.0), 1.0),
            relevance=min(max(fx.relevance, 0.0), 1.0),
            extraction=meta,
        ),
        "",
    )


def finding_from_sparse_run(
    run: RunExtraction,
    doc: Document,
    page_no: int,
    page_text: str,
    meta: dict[str, str],
    *,
    aliases: dict[str, Any],
) -> tuple[CombustionFinding | None, str]:
    """An I4 run with < 4 required fields becomes an ``out_of_schema_run`` finding (if it passes the gate)."""
    values = run.model_dump()
    conditions = _clean_conditions(values)
    quote = run.evidence_quote.strip()[:_QUOTE_MAX]
    ok, score, reason = is_microgravity_combustion(f"{quote}\n{page_text}", doc.metadata, conditions)
    if not ok:
        return None, f"gate: {reason}"
    program, inv = _program_fields(run.program or doc.metadata.get("investigation"), aliases)
    outcome = run.combustion_regime or (
        f"rate {run.spread_or_burn_rate:g}" if run.spread_or_burn_rate else None
    )
    statement = _run_statement(
        run.fuel_material, run.fuel_geometry, conditions, outcome, prefix="Partially reported run"
    )
    return (
        make_finding(
            category=FindingCategory.OUT_OF_SCHEMA_RUN,
            gravity_context=classify_gravity(None, quote, conditions),
            statement=statement,
            subject=run.fuel_material,
            program=program,
            investigation_id=inv,
            value_num=run.spread_or_burn_rate,
            value_text=run.combustion_regime,
            conditions=conditions,
            origin="llm",
            source_doc_id=doc.doc_id,
            source_page=page_no,
            evidence_quote=quote,
            quote_found=bool(quote) and _normalise(quote) in _normalise(page_text),
            confidence=min(max(run.confidence, 0.0), 1.0),
            relevance=score,
            extraction=meta,
        ),
        "",
    )


def _run_statement(
    fuel: Any, geometry: Any, conditions: dict[str, float | str], outcome: Any, *, prefix: str
) -> str:
    bits = []
    if "oxygen_pct" in conditions:
        bits.append(f"{_fmt(conditions['oxygen_pct'])}% O2")
    if "pressure_kpa" in conditions:
        bits.append(f"{_fmt(conditions['pressure_kpa'])} kPa")
    if "gravity_g" in conditions:
        bits.append(f"{_fmt(conditions['gravity_g'])} g")
    if "flow_velocity_cm_s" in conditions:
        bits.append(f"{_fmt(conditions['flow_velocity_cm_s'])} cm/s flow")
    what = " ".join(str(x) for x in (fuel, f"({geometry})" if geometry else None) if x)
    cond = f" at {', '.join(bits)}" if bits else ""
    tail = f": {outcome}" if outcome else ""
    head = f"{prefix}: {what}" if what else prefix
    return f"{head}{cond}{tail}."


# ── source b: tables ──────────────────────────────────────────────────

_FINDING_HEADER_RE = re.compile(
    r"\bLOI\b|oxygen index|extinct|ignit|soot|burning rate|flame temp|standoff|\bK\b|flammab|smold",
    re.IGNORECASE,
)
_HEADER_UNIT_RE = re.compile(r"^(.*?)\s*[(\[]\s*([^)\]]+?)\s*[)\]]\s*$")
_CELL_UNIT_RE = re.compile(r"^\s*[-+~≈]?\d[\d.,eE+-]*\s*([A-Za-z%°µ/²0-9]+(?:/[A-Za-z0-9²]+)?)\s*$")


def _category_from_header(header: str) -> FindingCategory:
    h = header.lower()
    if re.search(r"\bloi\b|oxygen index|flammab", h):
        return FindingCategory.FLAMMABILITY_LIMIT
    if "extinct" in h:
        return FindingCategory.EXTINCTION
    if "ignit" in h:
        return FindingCategory.IGNITION
    if re.search(r"soot|radiat|flux", h):
        return FindingCategory.SOOT_RADIATION
    if re.search(r"burning rate|\bk\b", h):
        return FindingCategory.BURNING_RATE
    if "spread" in h:
        return FindingCategory.FLAME_SPREAD
    if re.search(r"flame temp|standoff", h):
        return FindingCategory.FLAME_STRUCTURE
    return FindingCategory.OTHER


def _split_header_unit(header: str) -> tuple[str, str | None]:
    """ "LOI (%)" -> ("LOI", "%"). A bracket holding a number ("Buoyant velocity (56.5 kPa)") is a condition
    note, not a unit: the header is kept whole and the unit comes from the cell instead."""
    m = _HEADER_UNIT_RE.match(header)
    if not m or re.search(r"\d", m.group(2)):
        return header.strip(), None
    return m.group(1).strip() or header, m.group(2).strip()


def findings_from_tables(doc: Document, column_map: dict[str, Any]) -> tuple[list[CombustionFinding], int]:
    """Findings from tables that are not run tables (I5 takes tables with >= 4 mapped required fields).

    One finding per (row, value column). Returns (findings, off_topic_rows).
    """
    lookup = normalize._build_lookup(column_map)
    aliases = column_map.get("aliases", {})
    findings: list[CombustionFinding] = []
    off_topic = 0
    page_text_of = {i: t for i, t in enumerate(doc.pages, start=1)}
    for table in doc.tables:
        mapped = {
            i: lookup[h.strip().lower()]
            for i, h in enumerate(table.header)
            if h and h.strip().lower() in lookup
        }
        required = {f for f, _ in mapped.values() if f in REQUIRED_FIELDS}
        keyword_cols = [i for i, h in enumerate(table.header) if h and _FINDING_HEADER_RE.search(h)]
        if len(required) >= 4 or (not required and not keyword_cols):
            continue
        findings_t, off = _table_findings(doc, table, mapped, aliases, page_text_of.get(table.page, ""))
        findings.extend(findings_t)
        off_topic += off
    return findings, off_topic


def _table_findings(
    doc: Document,
    table: PageTable,
    mapped: dict[int, tuple[str, str | None]],
    aliases: dict[str, Any],
    page_text: str,
) -> tuple[list[CombustionFinding], int]:
    condition_cols = {i: fu for i, fu in mapped.items() if fu[0] in REQUIRED_FIELDS}
    value_cols = [i for i, h in enumerate(table.header) if h and i not in condition_cols]
    subject_col = next((i for i, (f, _) in condition_cols.items() if f == "fuel_material"), None)
    if subject_col is None and table.header and 0 not in mapped and 0 in value_cols and len(value_cols) > 1:
        subject_col = 0  # first column labels the row (e.g. "Material")
        value_cols.remove(0)
    program_col = next((i for i, (f, _) in condition_cols.items() if f == "program"), None)
    findings: list[CombustionFinding] = []
    off_topic = 0
    for cells in table.rows:
        conditions_raw: dict[str, Any] = {}
        for i, (fname, unit) in condition_cols.items():
            cell = cells[i] if i < len(cells) else None
            if cell is None or fname not in CONDITION_KEYS:
                continue
            conditions_raw[fname] = normalize.UNIT_CONVERTERS[unit](cell) if unit else cell
        conditions = _clean_conditions(conditions_raw)
        quote = " | ".join(c for c in cells if c)[:_QUOTE_MAX]
        ok, score, _ = is_microgravity_combustion(
            f"{' '.join(table.header)}\n{quote}\n{page_text}", doc.metadata, conditions
        )
        if not ok:
            off_topic += 1
            continue
        subject = cells[subject_col] if subject_col is not None and subject_col < len(cells) else None
        raw_program = cells[program_col] if program_col is not None and program_col < len(cells) else None
        program, inv = _program_fields(raw_program or doc.metadata.get("investigation"), aliases)
        for i in value_cols:
            cell = cells[i] if i < len(cells) else None
            if cell is None or not cell.strip():
                continue
            quantity, unit = _split_header_unit(table.header[i])
            value_num = normalize._num(cell)
            if unit is None and (m := _CELL_UNIT_RE.match(cell)):
                unit = m.group(1)
            # the cell as printed (keeps ranges / "~"); add the header unit when the cell has none
            shown = cell if unit is None or unit in cell else f"{cell}{'' if unit == '%' else ' '}{unit}"
            statement = _run_statement(subject, None, conditions, None, prefix=f"{quantity} = {shown}")
            findings.append(
                make_finding(
                    category=_category_from_header(table.header[i]),
                    gravity_context=classify_gravity(None, f"{quote} {page_text}", conditions),
                    statement=statement,
                    subject=subject,
                    program=program,
                    investigation_id=inv,
                    quantity=quantity,
                    value_num=value_num,
                    value_text=cell,  # the original cell keeps ranges / qualifiers ("5-10 cm/s", "~9")
                    unit=unit,
                    conditions=conditions,
                    origin="table",
                    source_doc_id=doc.doc_id,
                    source_page=table.page,
                    evidence_quote=quote,
                    quote_found=True,
                    confidence=1.0,
                    relevance=score,
                )
            )
    return findings, off_topic


# ── source c: CSV rows rejected only for enum values ──────────────────


def findings_from_enum_rejects(
    rows: list[dict[str, Any]],
    origins: dict[int, tuple[str, int]],
    column_map: dict[str, Any] | None = None,
) -> tuple[list[CombustionFinding], int]:
    """``ValidationReport.enum_only`` rows -> ``out_of_schema_run`` findings.

    ``origins`` maps id(row) -> (run file name, 1-based data row).

    Returns (findings, off_topic). Rows without a known origin (e.g. document rows) are skipped.
    """
    aliases = (column_map or {}).get("aliases", {})
    findings: list[CombustionFinding] = []
    off_topic = 0
    for row in rows:
        origin = origins.get(id(row))
        if origin is None:
            continue
        source_file, source_row = origin
        conditions = _clean_conditions(row)
        text = "combustion test run: " + " ".join(
            f"{k}={v}" for k, v in row.items() if k != "extra_telemetry" and v is not None
        )
        text += " " + " ".join(str(v) for v in (row.get("extra_telemetry") or {}).values())
        ok, score, _ = is_microgravity_combustion(text, {}, conditions)
        if not ok:
            off_topic += 1
            continue
        raw_program = row.get("program") or (row.get("extra_telemetry") or {}).get("psi_investigation_code")
        program, inv = _program_fields(raw_program, aliases)
        regime = row.get("combustion_regime")
        findings.append(
            make_finding(
                category=FindingCategory.OUT_OF_SCHEMA_RUN,
                gravity_context=classify_gravity(None, text, conditions),
                statement=_run_statement(
                    row.get("fuel_material"),
                    row.get("fuel_geometry"),
                    conditions,
                    regime,
                    prefix=f"Out-of-schema run {row.get('experiment_id') or ''}".rstrip(),
                ),
                subject=row.get("fuel_material"),
                program=program,
                investigation_id=inv,
                value_num=normalize._num(row.get("spread_or_burn_rate")),
                value_text=str(regime) if regime else None,
                conditions=conditions,
                origin="csv_reject",
                source_file=source_file,
                source_row=source_row,
                confidence=1.0,
                relevance=score,
            )
        )
    return findings, off_topic


# ── validate + dedupe + review queue ──────────────────────────────────


def _range(field_name: str) -> tuple[float | None, float | None]:
    lo = hi = None
    for meta in TestRunRecord.model_fields[field_name].metadata:
        if isinstance(meta, Ge):
            lo = float(meta.ge)  # type: ignore[arg-type]
        elif isinstance(meta, Le):
            hi = float(meta.le)  # type: ignore[arg-type]
    return lo, hi


# same physical ranges as test runs (TestRunRecord); temperature_k is findings-only
CONDITION_RANGES: dict[str, tuple[float | None, float | None]] = {
    k: _range(k) for k in ("oxygen_pct", "pressure_kpa", "gravity_g", "flow_velocity_cm_s")
}
CONDITION_RANGES["temperature_k"] = (0.0, 5000.0)
ORIGIN_FLAGS = {"llm": "finding:llm", "table": "finding:table", "csv_reject": "finding:csv_reject"}


def findings_review_queue_path() -> Path:
    return get_settings().CACHE_DIR / "findings_review_queue.csv"


@dataclass
class FindingsReport:
    kept: list[CombustionFinding] = field(default_factory=list)
    rejected: list[dict[str, Any]] = field(default_factory=list)  # {finding, errors}
    deduped: int = 0
    dropped_as_run: int = 0

    @property
    def flagged(self) -> int:
        """Findings with a flag beyond their origin flag."""
        return sum(1 for f in self.kept if any(fl not in ORIGIN_FLAGS.values() for fl in f.review_flags))

    def by_origin(self) -> dict[str, int]:
        counts = {"llm": 0, "table": 0, "csv_reject": 0}
        for f in self.kept:
            counts[f.origin] += 1
        return counts


def _hard_errors(f: CombustionFinding, min_relevance: float) -> list[str]:
    errors = []
    if not f.statement.strip():
        errors.append("statement: empty")
    has_doc = f.source_doc_id is not None and f.source_page is not None
    has_csv = f.source_file is not None and f.source_row is not None
    if not (has_doc or has_csv):
        errors.append("source: no doc/page and no file/row")
    if f.value_num is not None and not math.isfinite(f.value_num):
        errors.append("value_num: not finite")
    for key, value in f.conditions.items():
        if key not in CONDITION_KEYS:
            errors.append(f"conditions.{key}: not a canonical key")
            continue
        lo, hi = CONDITION_RANGES.get(key, (None, None))
        if isinstance(value, (int, float)) and (
            not math.isfinite(value) or (lo is not None and value < lo) or (hi is not None and value > hi)
        ):
            errors.append(f"conditions.{key}: {value} outside [{lo}, {hi}]")
    if f.origin == "llm" and f.category != FindingCategory.OUT_OF_SCHEMA_RUN and f.relevance < min_relevance:
        errors.append(f"relevance: {f.relevance} < {min_relevance}")
    return errors


def _soft_flags(f: CombustionFinding, min_confidence: float) -> list[str]:
    flags = [ORIGIN_FLAGS[f.origin]]
    if f.confidence < min_confidence:
        flags.append("finding:low_confidence")
    if f.quote_found is False:
        flags.append("finding:quote_not_found")
    if f.gravity_context == GravityContext.NORMAL_G_BASELINE:
        flags.append("finding:normal_g_baseline")
    if f.program and f.investigation_id is None:
        flags.append("finding:unknown_program")
    return flags


def validate_findings(
    findings: list[CombustionFinding],
    runs: list[TestRunRecord] | None = None,
    *,
    write_queue: bool = True,
    min_confidence: float | None = None,
    min_relevance: float | None = None,
) -> FindingsReport:
    settings = get_settings()
    min_conf = settings.EXTRACT_MIN_CONFIDENCE if min_confidence is None else min_confidence
    min_rel = settings.FINDINGS_MIN_RELEVANCE if min_relevance is None else min_relevance
    rep = FindingsReport()

    run_quotes = set()
    for r in runs or []:
        quote = (r.extra_telemetry.get("extraction") or {}).get("evidence_quote")
        if r.source_doc_id and r.source_page and quote:
            run_quotes.add((r.source_doc_id, r.source_page, _normalise(str(quote))))

    best: dict[str, CombustionFinding] = {}
    for f in findings:
        errors = _hard_errors(f, min_rel)
        if errors:
            rep.rejected.append({"finding": f, "errors": errors})
            continue
        if f.evidence_quote and (f.source_doc_id, f.source_page, _normalise(f.evidence_quote)) in run_quotes:
            rep.dropped_as_run += 1  # already stored as a test run
            continue
        f = f.model_copy(update={"review_flags": _soft_flags(f, min_conf)})
        prev = best.get(f.finding_id)
        if prev is not None:
            rep.deduped += 1
            if f.confidence <= prev.confidence:
                continue
        best[f.finding_id] = f
    rep.kept = list(best.values())
    if write_queue:
        _write_queue(rep)
    return rep


def _load_signoffs(queue: Path) -> dict[str, tuple[str, str]]:
    if not queue.exists():
        return {}
    out: dict[str, tuple[str, str]] = {}
    try:
        with queue.open("r", newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                fid = (row.get("finding_id") or "").strip()
                rev, sig = (row.get("reviewer") or "").strip(), (row.get("signoff") or "").strip()
                if fid and (rev or sig):
                    out[fid] = (rev, sig)
    except (OSError, csv.Error):
        return {}
    return out


def _write_queue(rep: FindingsReport) -> None:
    queue = findings_review_queue_path()
    signoffs = _load_signoffs(queue)
    queue.parent.mkdir(parents=True, exist_ok=True)
    header = [
        "finding_id",
        "category",
        "statement",
        "source_doc_id",
        "source_page",
        "source_file",
        "source_row",
        "flags",
        "reviewer",
        "signoff",
    ]
    # flagged-beyond-origin first, then by origin / provenance
    kept = sorted(
        rep.kept,
        key=lambda f: (-len(f.review_flags), f.origin, f.source_doc_id or f.source_file or "", f.finding_id),
    )
    with queue.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        for f in kept:
            rev, sig = signoffs.get(f.finding_id, ("", ""))
            w.writerow(
                [
                    f.finding_id,
                    f.category.value,
                    f.statement,
                    f.source_doc_id or "",
                    f.source_page or "",
                    f.source_file or "",
                    f.source_row or "",
                    ";".join(f.review_flags),
                    rev,
                    sig,
                ]
            )
        for rej in rep.rejected:
            f = rej["finding"]
            rev, sig = signoffs.get(f.finding_id, ("", ""))
            w.writerow(
                [
                    f.finding_id,
                    f.category.value,
                    f.statement,
                    f.source_doc_id or "",
                    f.source_page or "",
                    f.source_file or "",
                    f.source_row or "",
                    "REJECTED:" + ";".join(rej["errors"]),
                    rev,
                    sig,
                ]
            )


__all__ = [
    "CONDITION_KEYS",
    "FindingsReport",
    "classify_gravity",
    "finding_from_llm",
    "finding_from_sparse_run",
    "findings_from_enum_rejects",
    "findings_from_tables",
    "findings_review_queue_path",
    "has_number_with_unit",
    "is_microgravity_combustion",
    "make_finding",
    "validate_findings",
]
