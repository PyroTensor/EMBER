"""Stage 2 - Parse: CSV / JSON readers, markdown-with-page-markers, PDFs, plain text (form-feed pages).

One bad file (corrupt PDF, broken front matter, ...) is logged and skipped, never crashes the run.

Every document becomes a `Document` with `pages[i]` = text of page i+1, so citations can
always point at [doc_id, page] - for real PDFs and for the proxy markdown alike.

Proxy markdown convention:
    ---            YAML front matter (doc_id, title, source_type, investigation, fuel, ...)
    ---
    <!-- page: 1 -->
    ...text...
    <!-- page: 2 -->

Tables: PDF tables (PyMuPDF ``find_tables``) and markdown pipe tables also become structured
``Document.tables`` (``PageTable``), which stage 4 maps to test-run rows (``table_rows.py``). PDF tables are
still appended to the page text as markdown, so chunks and the LLM keep seeing them.

TODO(squad1-A): OCR for scanned NTRS PDFs.
"""

from __future__ import annotations

import csv
import json
import logging
import re
from pathlib import Path
from typing import Any

import yaml

from app.schemas.ingestion import Document, PageTable

logger = logging.getLogger(__name__)

PAGE_MARKER = re.compile(r"<!--\s*page:\s*(\d+)\s*-->")
FRONT_MATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_PIPE_ROW = re.compile(r"^\s*\|.*\|\s*$")
_PIPE_SEPARATOR = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")


def _clean_cell(cell: Any) -> str | None:
    """Collapse whitespace (incl. multi-line header cells) to single spaces; empty -> None."""
    if cell is None:
        return None
    text = re.sub(r"\s+", " ", str(cell)).strip()
    return text or None


def _split_pipe_row(line: str) -> list[Any]:
    body = line.strip()
    body = body[1:] if body.startswith("|") else body
    body = body[:-1] if body.endswith("|") else body
    return body.split("|")


def _make_table(page_no: int, raw_rows: list[list[Any]]) -> PageTable | None:
    """First non-empty row = header; the remaining non-empty rows are padded/trimmed to its width."""
    rows = [[_clean_cell(c) for c in r] for r in raw_rows]
    rows = [r for r in rows if any(c is not None for c in r)]
    if len(rows) < 2:
        return None
    header = [c or "" for c in rows[0]]
    width = len(header)
    body = [(r + [None] * width)[:width] for r in rows[1:]]
    return PageTable(page=page_no, header=header, rows=body)


def markdown_tables(page_no: int, text: str) -> list[PageTable]:
    """GitHub pipe tables on one page: header row + ``|---|`` separator + body rows."""
    tables: list[PageTable] = []
    lines = text.splitlines()
    i = 0
    while i < len(lines) - 1:
        if _PIPE_ROW.match(lines[i]) and _PIPE_SEPARATOR.match(lines[i + 1]):
            block = [_split_pipe_row(lines[i])]
            j = i + 2
            while j < len(lines) and _PIPE_ROW.match(lines[j]):
                block.append(_split_pipe_row(lines[j]))
                j += 1
            table = _make_table(page_no, block)
            if table is not None:
                tables.append(table)
            i = j
        else:
            i += 1
    return tables


VALID_SOURCE_TYPES = frozenset({"ntrs", "iss_page", "psi_dataset"})
IMAGE_PAGE_MAX_CHARS = 40  # PDF pages with fewer extracted chars are treated as scanned images
DOC_SUFFIXES = frozenset({".md", ".pdf", ".txt"})


def _doc_source_type(declared: Any, fallback: str | None, path: Path) -> str:
    """Front-matter ``source_type`` if valid, else the folder-derived type from fetch, else ``ntrs``."""
    folder_type = fallback if fallback in VALID_SOURCE_TYPES else "ntrs"
    if declared is None:
        return folder_type
    if declared not in VALID_SOURCE_TYPES:
        logger.warning(
            "'%s': source_type %r not in %s; using %r",
            path,
            declared,
            sorted(VALID_SOURCE_TYPES),
            folder_type,
        )
        return folder_type
    return str(declared)


def parse_markdown(path: Path, source_type: str | None = None) -> Document:
    """``source_type`` = fetch's folder-derived type, used when front matter has none or an invalid one."""
    text = Path(path).read_text(encoding="utf-8")
    meta: dict[str, Any] = {}
    m = FRONT_MATTER.match(text)
    if m:
        try:
            loaded = yaml.safe_load(m.group(1))
        except yaml.YAMLError as exc:
            logger.warning("'%s': invalid YAML front matter (%s); treating as no front matter", path, exc)
            loaded = None
        if loaded is not None and not isinstance(loaded, dict):
            logger.warning("'%s': front matter is not a mapping; treating as no front matter", path)
            loaded = None
        meta = loaded or {}
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
        source_type=_doc_source_type(meta.pop("source_type", None), source_type, Path(path)),
        path=str(path),
        metadata=meta,
        pages=pages,
        tables=[t for i, page in enumerate(pages, start=1) for t in markdown_tables(i, page)],
    )


def _extract_pdf_page(page: Any, page_no: int = 1) -> tuple[str, list[PageTable]]:
    """Page text (tables appended as markdown) + the structured tables found on the page."""
    text: str = page.get_text("text")
    structured: list[PageTable] = []
    if hasattr(page, "find_tables"):
        try:
            for tab in page.find_tables():
                if hasattr(tab, "to_markdown"):
                    md = tab.to_markdown()
                    if md and md.strip():
                        text = f"{text}\n\n{md.strip()}"
                if hasattr(tab, "extract"):
                    table = _make_table(page_no, tab.extract())
                    if table is not None:
                        structured.append(table)
        except Exception:
            pass
    return text, structured


def parse_pdf(path: Path, doc_id: str | None = None) -> Document:
    """Real NTRS PDFs. Requires `uv sync --extra pdf` (PyMuPDF)."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("PyMuPDF not installed: run `uv pip install pymupdf`") from exc
    with fitz.open(path) as pdf:
        extracted = [_extract_pdf_page(page, i) for i, page in enumerate(pdf, start=1)]
        title = pdf.metadata.get("title") or Path(path).stem
    pages = [text for text, _ in extracted]
    tables = [t for _, page_tables in extracted for t in page_tables]
    if sum(len(p.strip()) for p in pages) < 50:
        logger.warning(
            "PDF '%s' extracted < 50 chars across %d pages (likely scanned image PDF)", path, len(pages)
        )
    # investigation / fuel / O2 / gravity metadata: filled in stage 4 (LLMExtractor, --extractor llm).
    # Image-only (scanned) pages: the LLM extractor transcribes them through vision (I8).
    image_pages = [i for i, p in enumerate(pages, start=1) if len(p.strip()) < IMAGE_PAGE_MAX_CHARS]
    return Document(
        doc_id=doc_id or Path(path).stem,
        title=title,
        metadata={"image_pages": image_pages} if image_pages else {},
        source_type="ntrs",
        path=str(path),
        pages=pages,
        tables=tables,
    )


def parse_text(path: Path, source_type: str | None = None) -> Document:
    """Plain text (e.g. ``pdftotext`` output): pages split on form feed ``\\f``, else one page."""
    path = Path(path)
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    pages = [p.strip() for p in text.split("\f")] if "\f" in text else [text.strip()]
    while len(pages) > 1 and not pages[-1]:
        pages.pop()  # pdftotext ends every page (including the last) with \f
    return Document(
        doc_id=path.stem,
        title=path.stem,
        source_type=_doc_source_type(None, source_type, path),
        path=str(path),
        pages=pages,
    )


def parse_documents_with_skipped(
    paths: list[Path], source_types: dict[str, str] | None = None
) -> tuple[list[Document], list[tuple[str, str]]]:
    """Parse every document; a file that fails is logged and skipped instead of crashing the run.

    ``source_types`` maps ``str(path)`` to fetch's folder-derived type (fallback for markdown / text).
    Returns ``(docs, skipped)`` where ``skipped`` is ``[(path, "<ExcClass>: <message>"), ...]``.
    """
    docs: list[Document] = []
    skipped: list[tuple[str, str]] = []
    for p in paths:
        p = Path(p)
        suffix = p.suffix.lower()
        folder_type = (source_types or {}).get(str(p))
        try:
            if suffix == ".md":
                docs.append(parse_markdown(p, folder_type))
            elif suffix == ".pdf":
                docs.append(parse_pdf(p))
            elif suffix == ".txt":
                docs.append(parse_text(p, folder_type))
        except Exception as exc:
            reason = f"{type(exc).__name__}: {exc}"
            logger.warning("skipping %s: %s", p.name, reason)
            skipped.append((str(p), reason))
    return docs, skipped


def parse_documents(paths: list[Path], source_types: dict[str, str] | None = None) -> list[Document]:
    """Like ``parse_documents_with_skipped`` but returns only the parsed documents."""
    return parse_documents_with_skipped(paths, source_types)[0]


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
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and isinstance(data.get("records"), list):
            records: list[dict[str, Any]] = data["records"]
            return records
        raise ValueError(
            f"run file {path.name}: expected a JSON list of rows or an object with a 'records' list, "
            f"got {type(data).__name__}"
        )
    raise ValueError(f"unsupported run file: {path}")


def read_telemetry(path: Path) -> dict[str, dict[str, Any]]:
    """Telemetry series keyed by experiment_id. Accepts a list or ``{"records": [...]}``; entries without
    ``experiment_id`` are skipped (counted, one WARNING) instead of raising ``KeyError``."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    entries = data.get("records", []) if isinstance(data, dict) else data
    if not isinstance(entries, list):
        logger.warning("telemetry file %s has no list of series; ignoring it", Path(path).name)
        return {}
    out: dict[str, dict[str, Any]] = {}
    missing = 0
    for entry in entries:
        if isinstance(entry, dict) and entry.get("experiment_id") not in (None, ""):
            out[str(entry["experiment_id"])] = entry
        else:
            missing += 1
    if missing:
        logger.warning(
            "telemetry file %s: skipped %d entries without experiment_id", Path(path).name, missing
        )
    return out
