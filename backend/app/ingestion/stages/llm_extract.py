"""Stage 4 - LLM extraction: Pydantic schema -> investigations + test runs, with source doc + page per field.

Interface:
    extractor.extract_investigation(doc) -> Investigation | None
    extractor.extract_test_runs(doc)     -> list[dict]   (raw rows; normalize + validate follow)

`HeuristicExtractor` (default, offline) reads the proxy front matter and first paragraphs.
`GeminiExtractor` is the real thing for NTRS PDFs (Nov 14+).

TODO(squad1-A): implement GeminiExtractor with google-genai structured output:
    client.models.generate_content(model, contents=[page_text],
        config={"response_mime_type": "application/json", "response_schema": list[TestRunExtraction]})
  - one call per page so every extracted field carries (doc_id, page)
  - keep temperature 0; store the raw LLM JSON in .cache/extractions/ for audit
  - send low-confidence fields to validate.py's human review queue
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


class Extractor(Protocol):
    def extract_investigation(self, doc: Document) -> Investigation | None: ...
    def extract_test_runs(self, doc: Document) -> list[dict[str, Any]]: ...


def _first_paragraph(doc: Document) -> str:
    for page in doc.pages:
        for block in re.split(r"\n\s*\n", page):
            b = block.strip()
            if b and not b.startswith(("#", ">", "|", "**Facility")):
                return re.sub(r"\s+", " ", b)[:600]
    return ""


class HeuristicExtractor:
    """Offline extractor for the proxy corpus and NTRS markdown/PDFs."""

    def extract_investigation(self, doc: Document) -> Investigation | None:
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

    def extract_test_runs(self, doc: Document) -> list[dict[str, Any]]:
        # Proxy test runs arrive as structured CSV; nothing to pull out of prose.
        return []


class GeminiExtractor:  # pragma: no cover - needs API key
    def __init__(self, model: str | None = None):
        settings = get_settings()
        self.model = model or settings.LLM_MODEL
        self._fallback = HeuristicExtractor()
        self._api_key = settings.GEMINI_API_KEY.get_secret_value()
        if not self._api_key:
            logger.warning("GEMINI_API_KEY not set; GeminiExtractor falling back to HeuristicExtractor")

    def extract_investigation(self, doc: Document) -> Investigation | None:
        return self._fallback.extract_investigation(doc)

    def extract_test_runs(self, doc: Document) -> list[dict[str, Any]]:
        return self._fallback.extract_test_runs(doc)


def get_extractor(kind: str | None = None) -> Extractor:
    resolved = (kind or str(get_settings().LLM_PROVIDER)).lower()
    if resolved == "gemini":
        try:
            return GeminiExtractor()
        except Exception as exc:
            logger.warning("Failed to initialize GeminiExtractor (%s); using HeuristicExtractor", exc)
            return HeuristicExtractor()
    return HeuristicExtractor()
