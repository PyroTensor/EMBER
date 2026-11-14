"""Stage 4 - LLM extraction: Pydantic schema -> investigations + test runs, with source doc + page per field.

Interface (async, so the LLM extractor can make concurrent calls):
    await extractor.extract_investigation(doc) -> Investigation | None
    await extractor.extract_test_runs(doc)     -> list[dict]   (raw rows; normalize + validate follow)

`HeuristicExtractor` (default, offline) reads the proxy front matter and first paragraphs.
The extractor is chosen by ``settings.EXTRACTOR`` (``heuristic`` | ``llm``), independent of
``LLM_PROVIDER`` (RAG only), so a RAG provider switch never starts paid extraction calls.
The ``llm`` extractor (OpenAI primary, Gemini fallback) lands in I3/I4 of ingestion_plan_impl.md.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Protocol

from app.core.config import get_settings
from app.schemas.enums import Program
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
    del max_pages, use_cache  # consumed by the LLM extractor from I3 on
    if resolve_extractor_kind(kind) == "llm":
        logger.warning("LLM extractor not implemented yet; using HeuristicExtractor")
    return HeuristicExtractor()


__all__ = [
    "EXTRACTOR_KINDS",
    "Extractor",
    "HeuristicExtractor",
    "get_extractor",
    "heuristic_investigation",
    "resolve_extractor_kind",
]
