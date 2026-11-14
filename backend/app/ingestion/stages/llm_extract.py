"""Stage 4 - LLM extraction: Pydantic schema -> investigations + test runs, with source doc + page per field.

Interface (async, so the LLM extractor can make concurrent calls):
    await extractor.extract_investigation(doc) -> Investigation | None
    await extractor.extract_test_runs(doc)     -> list[dict]   (raw rows; normalize + validate follow)

`HeuristicExtractor` (default, offline) reads the proxy front matter and first paragraphs.
The extractor is chosen by ``settings.EXTRACTOR`` (``heuristic`` | ``llm``), independent of
``LLM_PROVIDER`` (RAG only), so a RAG provider switch never starts paid extraction calls.
`LLMExtractor` (``EXTRACTOR=llm`` / ``--extractor llm``) uses the structured chain (OpenAI primary, Gemini
fallback, see ``app.ingestion.extractors``). Documents that already carry front-matter metadata never call the
LLM, so the seed corpus stays free. Other documents (NTRS PDFs) get an investigation and their missing
``doc.metadata`` keys (investigation, fuel, o2_range, pressure_kpa, gravity) filled in, so their chunks
(stage 6, after this stage) carry the same metadata as markdown docs.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.config import get_settings
from app.ingestion.extractors import ExtractionCache, StructuredLLMChain, build_chain, cache_key
from app.ingestion.extractors.schemas import (
    INV_PROMPT_VERSION,
    RUNS_PROMPT_VERSION,
    InvestigationExtraction,
    PageRunsExtraction,
    RunExtraction,
)
from app.ingestion.stages import normalize
from app.schemas.enums import CombustionRegime, DiluentGas, FuelGeometry, FuelMaterial, Program
from app.schemas.ingestion import Document, Investigation

logger = logging.getLogger(__name__)

PROGRAMS: tuple[str, ...] = tuple(p.value for p in Program)
_PROGRAM_LOOKUP: dict[str, Program] = {p.value.lower(): p for p in Program}
_OBJECTIVE_RE = re.compile(
    r"(?:\*\*Objective\s*:?\*\*|Objective\s*:|##\s*Abstract\s*\n)\s*(.+?)(?:\n\*\*|\n##|\n\s*\n|\Z)",
    re.DOTALL | re.IGNORECASE,
)

EXTRACTOR_KINDS: tuple[str, ...] = ("heuristic", "llm")
_LEGACY_ALIASES: dict[str, str] = {"gemini": "llm", "openai": "llm"}


class Extractor(Protocol):
    async def extract_investigation(self, doc: Document) -> Investigation | None: ...
    async def extract_test_runs(self, doc: Document) -> list[dict[str, Any]]: ...


def _first_paragraph(doc: Document) -> str:
    for page in doc.pages:
        for block in re.split(r"\n\s*\n", page):
            b = block.strip()
            if b and not b.startswith(("#", ">", "|", "**Facility")):
                return re.sub(r"\s+", " ", b)[:600]
    return ""


def heuristic_investigation(doc: Document) -> Investigation | None:
    """Synchronous heuristic investigation extraction (front matter + objective/first paragraph).

    Shared by ``HeuristicExtractor`` and sync callers (the snapshot's in-memory seed fallback).
    """
    if doc.source_type not in ("iss_page", "ntrs"):
        return None
    raw_prog = doc.metadata.get("investigation") or doc.metadata.get("program")
    if not raw_prog:
        return None
    prog_enum = _PROGRAM_LOOKUP.get(str(raw_prog).strip().lower())
    if prog_enum is None:
        return None
    title = doc.title.split(":", 1)[-1].strip() if ":" in doc.title else doc.title.strip()
    body = "\n".join(doc.pages)
    summary = ""
    m = _OBJECTIVE_RE.search(body)
    if m:
        summary = re.sub(r"\s+", " ", m.group(1)).strip()
    return Investigation(
        id=prog_enum.value,
        program=prog_enum,
        title=title,
        summary=summary or _first_paragraph(doc),
        source_doc_id=doc.doc_id,
    )


class HeuristicExtractor:
    """Offline extractor for the proxy corpus and NTRS markdown/PDFs."""

    async def extract_investigation(self, doc: Document) -> Investigation | None:
        return heuristic_investigation(doc)

    async def extract_test_runs(self, doc: Document) -> list[dict[str, Any]]:
        # Proxy test runs arrive as structured CSV; nothing to pull out of prose.
        return []


# ── LLM extractor ─────────────────────────────────────────────────────

INV_SYSTEM_PROMPT = (
    "You extract metadata about NASA microgravity combustion investigations from document text. "
    "Use ONLY the text provided; never guess. "
    f"program: one of {', '.join(PROGRAMS)} if the text clearly names that investigation, else null. "
    "title: the document title, else null. "
    "summary: 1-3 sentences (max 600 characters) stating the objective or main result, else null. "
    "fuels: material/fuel names exactly as written (empty list if none). "
    "o2_pct_min / o2_pct_max: oxygen concentration range in percent by volume (convert mole fractions x100), "
    "null if not stated. pressures_kpa: tested pressures converted to kPa (1 atm = 101.325 kPa, "
    "1 psia = 6.895 kPa). gravity_levels_g: gravity levels in g (microgravity = 0.0, Moon = 0.16, "
    "Mars = 0.38). evidence_page: the page number where the program evidence appears, else null."
)
INV_MAX_PAGES = 3
INV_MAX_CHARS = 12_000
_SUMMARY_MAX = 600


def _enum_list(enum: type[Program | FuelMaterial | FuelGeometry | DiluentGas | CombustionRegime]) -> str:
    return ", ".join(e.value for e in enum)


RUNS_SYSTEM_PROMPT = (
    "You extract individually reported microgravity combustion test runs from ONE page of a NASA document. "
    "Extract ONLY individually reported experimental runs or table rows with measured conditions. "
    "Never invent values: use null when a value is not stated for that run. "
    "Ranges or parametric sweeps without per-run outcomes are NOT runs. "
    'If the page has no such runs, return {"runs": []}.\n'
    "Units (convert to these): oxygen_pct in % by volume (mole fraction x100); pressure_kpa in kPa "
    "(1 psia = 6.895 kPa, 1 atm = 101.325 kPa, 1 mmHg = 0.1333 kPa); flow_velocity_cm_s in cm/s "
    "(1 mm/s = 0.1 cm/s); gravity_g in g (microgravity/ISS = 0.0, Moon = 0.16, Mars = 0.38, Earth = 1.0); "
    "peak_radiative_flux_kw_m2 in kW/m2; burn_duration_s in s; limiting_oxygen_index_pct in %.\n"
    f"Allowed spellings - program: {_enum_list(Program)}; fuel_material: {_enum_list(FuelMaterial)}; "
    f"fuel_geometry: {_enum_list(FuelGeometry)}; diluent_gas: {_enum_list(DiluentGas)}; "
    f"combustion_regime: {_enum_list(CombustionRegime)}. If the text names another material/gas, copy it "
    "verbatim.\n"
    "experiment_id: ONLY a run/test id that appears verbatim on the page, else null. "
    "confidence: 0-1, your confidence that this is one real measured run. "
    "evidence_quote: at most 200 characters copied verbatim from the page (the table row or sentence)."
)
REQUIRED_RUN_FIELDS = (
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
MIN_REQUIRED_FIELDS = 4
_RUN_VALUE_FIELDS = tuple(f for f in RunExtraction.model_fields if f not in ("confidence", "evidence_quote"))
_SIGNAL_RE = re.compile(
    r"\bO2\b|\boxygen\b|\bkPa\b|\bpsia\b|\batm\b|cm/s|mm/s|µg|μg|microgravity|\bLOI\b|extinct|ignit",
    re.IGNORECASE,
)
_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|", re.MULTILINE)
_NUMBER_RE = re.compile(r"(?<![\w.])[-+]?\d+(?:\.\d+)?")
MIN_SIGNALS = 2
MIN_NUMBERS = 6


def _normalise_text(text: str) -> str:
    """Lowercase, table pipes and whitespace runs collapsed: used for verbatim-quote checks."""
    return re.sub(r"[\s|]+", " ", text).strip().lower()


def is_candidate_page(text: str) -> bool:
    """>= 2 distinct condition signals AND (a markdown table row OR >= 6 numbers)."""
    signals = {m.group(0).lower() for m in _SIGNAL_RE.finditer(text)}
    if len(signals) < MIN_SIGNALS:
        return False
    return bool(_TABLE_ROW_RE.search(text)) or len(_NUMBER_RE.findall(text)) >= MIN_NUMBERS


@dataclass
class ExtractorStats:
    calls: int = 0  # chain calls (cache misses)
    cache_hits: int = 0
    failures: int = 0  # chain calls where every provider failed
    by_provider: Counter[str] = field(default_factory=Counter)  # investigations by source
    run_pages: int = 0  # candidate pages sent to (or answered from the cache for) run extraction
    runs_extracted: int = 0
    discarded_sparse: int = 0
    budget_skipped: int = 0  # candidate pages skipped because the page budget ran out

    def provider_mix(self) -> str:
        keys = ["openai", "gemini", "cache", "heuristic"]
        keys += sorted(k for k in self.by_provider if k not in keys)
        return ", ".join(f"{k} {self.by_provider[k]}" for k in keys)


def _first_pages_text(doc: Document) -> str:
    """First INV_MAX_PAGES pages, each prefixed '=== page N ===', capped at INV_MAX_CHARS in total."""
    parts: list[str] = []
    total = 0
    for i, page in enumerate(doc.pages[:INV_MAX_PAGES], start=1):
        if not page.strip():
            continue
        block = f"=== page {i} ===\n{page.strip()}\n"[: INV_MAX_CHARS - total]
        parts.append(block)
        total += len(block)
        if total >= INV_MAX_CHARS:
            break
    return "".join(parts).strip()


class LLMExtractor:
    """Structured-LLM extractor (OpenAI primary, Gemini fallback, heuristic as the last resort)."""

    def __init__(
        self,
        chain: StructuredLLMChain,
        *,
        cache: ExtractionCache,
        use_cache: bool = True,
        max_pages: int = 200,
        min_confidence: float = 0.6,
        concurrency: int = 4,
        aliases: dict[str, Any] | None = None,
    ) -> None:
        self.chain = chain
        self.cache = cache
        self.use_cache = use_cache
        self.max_pages = max_pages  # run-extraction page budget (I4)
        self.min_confidence = min_confidence  # review threshold for extracted runs (I4)
        self._sem = asyncio.Semaphore(concurrency)
        self._aliases = aliases if aliases is not None else normalize.load_column_map().get("aliases", {})
        self._heuristic = HeuristicExtractor()
        self.stats = ExtractorStats()
        self._pages_used = 0  # shared LLM page budget across the whole run
        self._budget_warned = False

    def _program(self, raw: str | None) -> Program | None:
        if not raw:
            return None
        mapped = normalize._alias("program", raw, self._aliases)
        return _PROGRAM_LOOKUP.get(str(mapped).strip().lower())

    async def _extract_inv(self, doc: Document, text: str) -> tuple[InvestigationExtraction | None, str]:
        """Cached chain call. Returns (parsed or None, source label: provider | cache | heuristic)."""
        key = cache_key(INV_PROMPT_VERSION, InvestigationExtraction.__name__, text)
        if self.use_cache and (hit := self.cache.get(doc.doc_id, "inv", 1, key)) is not None:
            try:
                cached = InvestigationExtraction.model_validate(hit)
            except ValueError:
                cached = None  # stale/corrupt entry: fall through to a fresh call
            if cached is not None:
                self.stats.cache_hits += 1
                return cached, "cache"
        async with self._sem:
            result = await self.chain.extract(INV_SYSTEM_PROMPT, text, InvestigationExtraction)
        self.stats.calls += 1
        self.cache.put(doc.doc_id, "inv", 1, key, prompt_version=INV_PROMPT_VERSION, result=result)
        if not isinstance(result.parsed, InvestigationExtraction):
            self.stats.failures += 1
            logger.warning("investigation extraction failed for %s; using heuristic", doc.doc_id)
            return None, "heuristic"
        return result.parsed, result.provider or "llm"

    @staticmethod
    def _enrich(doc: Document, ext: InvestigationExtraction, program: Program | None, source: str) -> None:
        """Fill ONLY missing doc.metadata keys (front matter / parse metadata always wins)."""
        candidates: dict[str, Any] = {}
        if program is not None:
            candidates["investigation"] = program.value
        fuels = [f.strip() for f in ext.fuels if f and f.strip()]
        if fuels:
            candidates["fuel"] = fuels
        lo, hi = ext.o2_pct_min, ext.o2_pct_max
        if lo is not None or hi is not None:
            candidates["o2_range"] = [lo if lo is not None else hi, hi if hi is not None else lo]
        if ext.pressures_kpa:
            candidates["pressure_kpa"] = list(ext.pressures_kpa)
        if ext.gravity_levels_g:
            candidates["gravity"] = list(ext.gravity_levels_g)
        added = False
        for key, value in candidates.items():
            if key not in doc.metadata:
                doc.metadata[key] = value
                added = True
        if added:
            doc.metadata.setdefault("metadata_source", f"llm:{source}")

    def _heuristic_result(self, h: Investigation | None) -> Investigation | None:
        if h is not None:
            self.stats.by_provider["heuristic"] += 1
        return h

    async def extract_investigation(self, doc: Document) -> Investigation | None:
        h = await self._heuristic.extract_investigation(doc)
        has_front_matter = bool(doc.metadata.get("investigation") or doc.metadata.get("program"))
        if has_front_matter and h is not None:
            return self._heuristic_result(h)  # no LLM call: the seed corpus stays free
        text = _first_pages_text(doc)
        if not text:
            return self._heuristic_result(h)
        ext, source = await self._extract_inv(doc, text)
        if ext is None:
            return self._heuristic_result(h)
        program = self._program(ext.program)
        self._enrich(doc, ext, program, source)
        if program is None:
            return self._heuristic_result(h)
        self.stats.by_provider[source] += 1
        summary = re.sub(r"\s+", " ", ext.summary or "").strip()[:_SUMMARY_MAX]
        return Investigation(
            id=program.value,
            program=program,
            title=(ext.title or "").strip() or doc.title,
            summary=summary,
            source_doc_id=doc.doc_id,
        )

    # ── test runs (I4) ────────────────────────────────────────────────

    def _reserve_page(self) -> bool:
        """Take one page from the shared budget (synchronous, so concurrent docs never overspend)."""
        if self._pages_used < self.max_pages:
            self._pages_used += 1
            return True
        self.stats.budget_skipped += 1
        if not self._budget_warned:
            logger.warning("LLM page budget exhausted (%d); remaining pages skipped", self.max_pages)
            self._budget_warned = True
        return False

    def candidate_pages(self, doc: Document) -> list[int]:
        """1-based pages worth an LLM call (prefilter; pages already mapped from tables are skipped)."""
        skip = {int(p) for p in doc.metadata.get("table_row_pages", [])}
        return [i for i, text in enumerate(doc.pages, start=1) if i not in skip and is_candidate_page(text)]

    def _row(
        self, doc: Document, page_no: int, idx: int, run: RunExtraction, page_text: str, meta: dict[str, str]
    ) -> dict[str, Any] | None:
        values = run.model_dump(include=set(_RUN_VALUE_FIELDS))
        eid = (values.pop("experiment_id") or "").strip()
        if not (eid and eid in page_text):
            eid = ""
        n_required = sum(1 for f in REQUIRED_RUN_FIELDS[1:] if values.get(f) is not None) + bool(eid)
        if n_required < MIN_REQUIRED_FIELDS:
            self.stats.discarded_sparse += 1
            return None
        if values.get("program") is None and doc.metadata.get("investigation"):
            values["program"] = doc.metadata["investigation"]  # the page rarely restates the program
        quote = run.evidence_quote.strip()[:200]
        return {
            "experiment_id": eid or f"{doc.doc_id}-p{page_no:03d}-r{idx:02d}",
            **{k: v for k, v in values.items() if v is not None},
            # provenance is ALWAYS set by code, never by the LLM
            "source_doc_id": doc.doc_id,
            "source_page": page_no,
            "extra_telemetry": {
                "extraction": {
                    "provider": meta["provider"],
                    "model": meta["model"],
                    "prompt_version": RUNS_PROMPT_VERSION,
                    "confidence": run.confidence,
                    "evidence_quote": quote,
                    "quote_found": bool(quote) and _normalise_text(quote) in _normalise_text(page_text),
                }
            },
        }

    async def _page_runs(self, doc: Document, page_no: int, key: str) -> list[dict[str, Any]]:
        text = doc.pages[page_no - 1]
        async with self._sem:
            result = await self.chain.extract(RUNS_SYSTEM_PROMPT, text, PageRunsExtraction)
        self.stats.calls += 1
        self.cache.put(doc.doc_id, "runs", page_no, key, prompt_version=RUNS_PROMPT_VERSION, result=result)
        if not isinstance(result.parsed, PageRunsExtraction):
            self.stats.failures += 1
            logger.warning("run extraction failed for %s p.%d", doc.doc_id, page_no)
            return []
        meta = {"provider": result.provider or "llm", "model": result.model or ""}
        return self._rows(doc, page_no, result.parsed, meta)

    def _rows(
        self, doc: Document, page_no: int, parsed: PageRunsExtraction, meta: dict[str, str]
    ) -> list[dict[str, Any]]:
        text = doc.pages[page_no - 1]
        rows = [self._row(doc, page_no, i, run, text, meta) for i, run in enumerate(parsed.runs, start=1)]
        kept = [r for r in rows if r is not None]
        self.stats.runs_extracted += len(kept)
        return kept

    async def extract_test_runs(self, doc: Document) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        pending: list[tuple[int, str]] = []
        # synchronous pass: cache hits are free; misses reserve budget BEFORE any await, so the budget is
        # shared deterministically across documents extracted concurrently
        for page_no in self.candidate_pages(doc):
            text = doc.pages[page_no - 1]
            key = cache_key(RUNS_PROMPT_VERSION, PageRunsExtraction.__name__, text)
            entry = self.cache.get_entry(doc.doc_id, "runs", page_no, key) if self.use_cache else None
            if entry is not None:
                try:
                    parsed = PageRunsExtraction.model_validate(entry["parsed"])
                except ValueError:
                    parsed = None
                if parsed is not None:
                    self.stats.cache_hits += 1
                    self.stats.run_pages += 1
                    meta = {
                        "provider": str(entry.get("provider") or "cache"),
                        "model": str(entry.get("model") or ""),
                    }
                    rows.extend(self._rows(doc, page_no, parsed, meta))
                    continue
            if self._reserve_page():
                self.stats.run_pages += 1
                pending.append((page_no, key))
        for page_rows in await asyncio.gather(*(self._page_runs(doc, p, k) for p, k in pending)):
            rows.extend(page_rows)
        return sorted(rows, key=lambda r: (r["source_page"], r["experiment_id"]))


def resolve_extractor_kind(kind: str | None = None) -> str:
    """Map a CLI/setting value to ``heuristic`` | ``llm`` (legacy ``gemini``/``openai`` alias to ``llm``)."""
    resolved = (kind or get_settings().EXTRACTOR).strip().lower()
    if resolved in _LEGACY_ALIASES:
        logger.info("extractor '%s' is a legacy alias for 'llm'", resolved)
        resolved = _LEGACY_ALIASES[resolved]
    if resolved not in EXTRACTOR_KINDS:
        raise ValueError(f"unknown extractor '{kind}'; expected one of {EXTRACTOR_KINDS}")
    return resolved


def get_extractor(
    kind: str | None = None, *, max_pages: int | None = None, use_cache: bool = True
) -> Extractor:
    """Default = ``settings.EXTRACTOR`` (NOT ``LLM_PROVIDER``).

    ``max_pages`` (CLI ``--llm-max-pages``, else ``EXTRACT_MAX_PAGES``) and ``use_cache`` (CLI
    ``--no-llm-cache``) configure the LLM extractor (I3/I4); the heuristic extractor ignores them.
    """
    if resolve_extractor_kind(kind) != "llm":
        return HeuristicExtractor()
    settings = get_settings()
    chain = build_chain(settings)
    if chain is None:
        logger.warning("no OPENAI_API_KEY / GEMINI_API_KEY: using HeuristicExtractor")
        return HeuristicExtractor()
    logger.info("LLMExtractor providers: %s", " -> ".join(chain.providers))
    return LLMExtractor(
        chain,
        cache=ExtractionCache(),
        use_cache=use_cache,
        max_pages=settings.EXTRACT_MAX_PAGES if max_pages is None else max_pages,
        min_confidence=settings.EXTRACT_MIN_CONFIDENCE,
        concurrency=settings.EXTRACT_CONCURRENCY,
    )


__all__ = [
    "EXTRACTOR_KINDS",
    "Extractor",
    "ExtractorStats",
    "HeuristicExtractor",
    "LLMExtractor",
    "get_extractor",
    "heuristic_investigation",
    "resolve_extractor_kind",
]
