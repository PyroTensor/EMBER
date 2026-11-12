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

import re
from typing import Any, Protocol

from app.core.config import get_settings
from app.schemas.ingestion import Document, Investigation

PROGRAMS = ("BASS-II", "SoFIE", "FLEX", "ACME")


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
    """Offline extractor for the proxy corpus: uses YAML front matter + first paragraph."""

    def extract_investigation(self, doc: Document) -> Investigation | None:
        if doc.source_type != "iss_page":
            return None
        program = doc.metadata.get("investigation")
        if program not in PROGRAMS:
            return None
        title = doc.title.split(":", 1)[-1].strip()
        body = " ".join(doc.pages)
        summary = ""
        m = re.search(r"\*\*Objective:\*\*\s*(.+?)(?:\n\*\*|\Z)", body, re.DOTALL)
        if m:
            summary = re.sub(r"\s+", " ", m.group(1)).strip()
        return Investigation(
            id=program,
            program=program,
            title=title,
            summary=summary or _first_paragraph(doc),
            source_doc_id=doc.doc_id,
        )

    def extract_test_runs(self, doc: Document) -> list[dict[str, Any]]:
        # Proxy test runs arrive as structured CSV; nothing to pull out of prose.
        return []


class GeminiExtractor:  # pragma: no cover - needs API key
    def __init__(self, model: str | None = None):
        self.model = model or get_settings().LLM_MODEL
        raise NotImplementedError("TODO(squad1-A): GeminiExtractor - see module docstring")

    def extract_investigation(self, doc: Document) -> Investigation | None:
        raise NotImplementedError

    def extract_test_runs(self, doc: Document) -> list[dict[str, Any]]:
        raise NotImplementedError


def get_extractor(kind: str | None = None) -> Extractor:
    kind = (kind or "heuristic").lower()
    if kind == "gemini":
        return GeminiExtractor()
    return HeuristicExtractor()
