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
import re
from pathlib import Path
from typing import Any

import yaml

from app.schemas.ingestion import Document

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
        for i in range(1, len(parts), 2):
            page_no = int(parts[i])
            while len(pages) < page_no - 1:
                pages.append("")
            pages.append(parts[i + 1].strip())

    doc_id = str(meta.pop("doc_id", Path(path).stem))
    return Document(
        doc_id=doc_id,
        title=str(meta.pop("title", doc_id)),
        source_type=meta.pop("source_type", "ntrs"),
        path=str(path),
        metadata=meta,
        pages=pages,
    )


def parse_pdf(path: Path, doc_id: str | None = None) -> Document:
    """Real NTRS PDFs. Requires `uv sync --extra pdf` (PyMuPDF)."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("PyMuPDF not installed: run `uv pip install pymupdf`") from exc
    with fitz.open(path) as pdf:
        pages = [page.get_text("text") for page in pdf]
        title = pdf.metadata.get("title") or Path(path).stem
    # TODO(squad1-A): pull investigation / fuel / O2 / gravity metadata via llm_extract
    return Document(
        doc_id=doc_id or Path(path).stem, title=title, source_type="ntrs", path=str(path), pages=pages
    )


def parse_documents(paths: list[Path]) -> list[Document]:
    docs = []
    for p in paths:
        p = Path(p)
        if p.suffix == ".md":
            docs.append(parse_markdown(p))
        elif p.suffix == ".pdf":
            docs.append(parse_pdf(p))
    return docs


def read_rows(path: Path) -> list[dict[str, Any]]:
    """Raw test-run rows from CSV or JSON - no cleaning (that's normalize.py)."""
    path = Path(path)
    if path.suffix == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as fh:
            return [dict(r) for r in csv.DictReader(fh)]
    if path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else data.get("records", [])
    raise ValueError(f"unsupported run file: {path}")


def read_telemetry(path: Path) -> dict[str, dict[str, Any]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {d["experiment_id"]: d for d in data}
