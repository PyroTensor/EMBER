"""Stage 2 - Parse: CSV / JSON readers, markdown-with-page-markers, PDFs.

Every document becomes a `Document` with `pages[i]` = text of page i+1, so citations can
always point at [doc_id, page] - for real PDFs and for the proxy markdown alike.

Proxy markdown convention:
    ---            YAML front matter (doc_id, title, source_type, investigation, fuel, ...)
    ---
    <!-- page: 1 -->
    ...text...
    <!-- page: 2 -->

TODO(squad1-A): Docling for tables / layout; OCR (e.g. Tesseract) for scanned NTRS PDFs.
"""

from __future__ import annotations

import csv
import json
import logging
import re
from pathlib import Path
from typing import Any

import yaml

from app.schemas.ingestion import Document

logger = logging.getLogger(__name__)

PAGE_MARKER = re.compile(r"<!--\s*page:\s*(\d+)\s*-->")
FRONT_MATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_markdown(path: Path) -> Document:
    text = Path(path).read_text(encoding="utf-8")
    meta: dict[str, Any] = {}
    m = FRONT_MATTER.match(text)
    if m:
        meta = yaml.safe_load(m.group(1)) or {}
        text = text[m.end() :]

    parts = PAGE_MARKER.split(text)
    # parts = [preamble, '1', page1, '2', page2, ...]
    pages: list[str] = []
    if len(parts) == 1:
        pages = [text.strip()]
    else:
        by_page: dict[int, list[str]] = {}
        preamble = parts[0].strip()
        if preamble:
            by_page.setdefault(1, []).append(preamble)
        for i in range(1, len(parts), 2):
            page_no = max(1, int(parts[i]))
            body = parts[i + 1].strip()
            by_page.setdefault(page_no, []).append(body)
        max_page = max(by_page) if by_page else 0
        pages = ["\n\n".join(filter(None, by_page.get(p, []))) for p in range(1, max_page + 1)]

    doc_id = str(meta.pop("doc_id", Path(path).stem))
    return Document(
        doc_id=doc_id,
        title=str(meta.pop("title", doc_id)),
        source_type=meta.pop("source_type", "ntrs"),
        path=str(path),
        metadata=meta,
        pages=pages,
    )


def _extract_pdf_page(page: Any) -> str:
    text: str = page.get_text("text")
    if hasattr(page, "find_tables"):
        try:
            tables = page.find_tables()
            for tab in tables:
                if hasattr(tab, "to_markdown"):
                    md = tab.to_markdown()
                    if md and md.strip():
                        text = f"{text}\n\n{md.strip()}"
        except Exception:
            pass
    return text


def parse_pdf(path: Path, doc_id: str | None = None) -> Document:
    """Real NTRS PDFs. Requires `uv sync --extra pdf` (PyMuPDF)."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("PyMuPDF not installed: run `uv pip install pymupdf`") from exc
    with fitz.open(path) as pdf:
        pages = [_extract_pdf_page(page) for page in pdf]
        title = pdf.metadata.get("title") or Path(path).stem
    if sum(len(p.strip()) for p in pages) < 50:
        logger.warning(
            "PDF '%s' extracted < 50 chars across %d pages (likely scanned image PDF)", path, len(pages)
        )
    # TODO(squad1-A): pull investigation / fuel / O2 / gravity metadata via llm_extract
    return Document(
        doc_id=doc_id or Path(path).stem, title=title, source_type="ntrs", path=str(path), pages=pages
    )


def parse_documents(paths: list[Path]) -> list[Document]:
    docs = []
    for p in paths:
        p = Path(p)
        suffix = p.suffix.lower()
        if suffix == ".md":
            docs.append(parse_markdown(p))
        elif suffix == ".pdf":
            docs.append(parse_pdf(p))
    return docs


def read_rows(path: Path) -> list[dict[str, Any]]:
    """Raw test-run rows from CSV or JSON - no cleaning (that's normalize.py)."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        raw_bytes = path.read_bytes()
        try:
            text = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw_bytes.decode("cp1252")
        rows: list[dict[str, Any]] = []
        for r in csv.DictReader(text.splitlines()):
            cleaned = {k: v for k, v in r.items() if k is not None}
            if any(v is not None and str(v).strip() != "" for v in cleaned.values()):
                rows.append(cleaned)
        return rows
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else data.get("records", [])
    raise ValueError(f"unsupported run file: {path}")


def read_telemetry(path: Path) -> dict[str, dict[str, Any]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {d["experiment_id"]: d for d in data}
