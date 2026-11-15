"""``GET /api/documents``, ``GET /api/documents/{doc_id}``, and file downloads."""

from __future__ import annotations

import csv
import io
import mimetypes
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.repositories.interfaces import DocumentReader, TestRunReader
from app.schemas.document import DocumentDetail, DocumentSummary

_TOKEN = re.compile(r"[a-z0-9_.-]+")
_PSI_NUM = re.compile(r"^PSI-(\d+)", re.IGNORECASE)
_EXT_PREF = {".pdf": 0, ".csv": 1, ".md": 2, ".txt": 3}
_CSV_COLS = (
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
    "spread_or_burn_rate",
    "limiting_oxygen_index_pct",
    "peak_radiative_flux_kw_m2",
    "max_temp_c",
    "soot_onset",
    "source_doc_id",
    "source_page",
)


@dataclass(frozen=True)
class DownloadPayload:
    filename: str
    media_type: str
    file_path: Path | None = None
    content: bytes | None = None


def _norm_key(value: str) -> str:
    stem = Path(value).stem if "." in value else value
    return re.sub(r"[^a-z0-9]+", "_", stem.lower()).strip("_")


def _search_dirs() -> list[Path]:
    settings = get_settings()
    ingestion_source = Path(__file__).resolve().parents[1] / "ingestion" / "source"
    candidates = [
        settings.SEED_DIR / "corpus",
        settings.CACHE_DIR / "raw" / "corpus",
        settings.SEED_DIR / "iss_pages",
        settings.CACHE_DIR / "raw" / "iss_pages",
        settings.SEED_DIR,
        ingestion_source,
    ]
    out: list[Path] = []
    seen: set[Path] = set()
    for d in candidates:
        resolved = d.resolve()
        if resolved not in seen and resolved.is_dir():
            seen.add(resolved)
            out.append(resolved)
    return out


def resolve_document_file(doc_id: str) -> Path | None:
    """Safely find the raw source file (.pdf, .csv, .md, .txt) matching ``doc_id``."""
    cleaned = doc_id.strip()
    if not cleaned:
        return None
    want_lower = cleaned.lower()
    want_stem_lower = Path(cleaned).stem.lower() if "." in cleaned else want_lower
    want_norm = _norm_key(cleaned)
    iss_norm = _norm_key(cleaned[4:]) if cleaned.upper().startswith("ISS-") else None
    psi_match = _PSI_NUM.match(cleaned)
    is_table_doc = want_lower.endswith(("-table", "-tables", ".csv"))

    best: tuple[tuple[int, int, str], Path] | None = None
    for idx_dir, directory in enumerate(_search_dirs()):
        for entry in directory.iterdir():
            if not entry.is_file():
                continue
            ext = entry.suffix.lower()
            if ext not in _EXT_PREF:
                continue
            name_low = entry.name.lower()
            stem_low = entry.stem.lower()
            norm = _norm_key(entry.stem)

            match_rank: int | None = None
            if name_low == want_lower:
                match_rank = 0
            elif stem_low == want_stem_lower and (not want_lower.endswith(".csv") or ext == ".csv"):
                match_rank = 1
            elif norm == want_norm or (iss_norm is not None and norm == iss_norm):
                match_rank = 2
            elif (
                is_table_doc
                and psi_match
                and norm.startswith(f"psi_{psi_match.group(1)}_")
                and ("experimental_table" in norm or ext == ".csv")
            ):
                match_rank = 3

            if match_rank is None:
                continue
            ext_rank = 0 if (want_lower.endswith(".csv") and ext == ".csv") else _EXT_PREF[ext]
            key = (match_rank, idx_dir * 10 + ext_rank, entry.name)
            if best is None or key < best[0]:
                best = (key, entry)
    return best[1] if best is not None else None


def _media_type_for(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".pdf":
        return "application/pdf"
    if ext == ".csv":
        return "text/csv; charset=utf-8"
    if ext == ".md":
        return "text/markdown; charset=utf-8"
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def _rows_to_csv_bytes(rows: list[dict[str, Any]]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=_CSV_COLS, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({k: row.get(k) for k in _CSV_COLS})
    return buf.getvalue().encode("utf-8")


def _detail_to_markdown_bytes(detail: DocumentDetail) -> bytes:
    lines = [f"# {detail.title}", "", f"- Document ID: `{detail.doc_id}`"]
    if detail.investigation:
        lines.append(f"- Investigation: {detail.investigation}")
    if detail.url:
        lines.append(f"- Official URL: {detail.url}")
    lines.append("")
    for page in detail.pages:
        lines.append(f"## Page {page.page}")
        lines.append("")
        for sec in page.sections:
            if sec.section:
                lines.append(f"### {sec.section}")
                lines.append("")
            lines.append(sec.text)
            lines.append("")
    return "\n".join(lines).encode("utf-8")


def _matches_query(doc: DocumentSummary, query: str) -> bool:
    terms = [t for t in _TOKEN.findall(query.lower()) if t]
    if not terms:
        return True
    parts: list[str] = [
        doc.doc_id,
        doc.title,
        doc.source_type,
        doc.investigation or "",
        doc.url or "",
        *doc.sources,
        *doc.related_experiment_ids,
    ]
    for page in doc.pages:
        for sec in page.sections:
            parts.append(sec.section)
            parts.append(sec.text)
    haystack = " ".join(parts).lower()
    return any(t in haystack for t in terms)


class DocumentService:
    def __init__(self, reader: DocumentReader) -> None:
        self._reader = reader

    async def list_all(self, q: str | None = None) -> list[DocumentSummary]:
        rows = await self._reader.list_all()
        docs = [DocumentSummary.model_validate(r) for r in rows]
        if q and q.strip():
            docs = [d for d in docs if _matches_query(d, q)]
        return docs

    async def get(self, doc_id: str) -> DocumentDetail:
        doc = await self._reader.get_detail(doc_id)
        if doc is None:
            raise NotFoundError(
                f"No document with id '{doc_id}'",
                code="DOCUMENT_NOT_FOUND",
                details={"doc_id": doc_id},
            )
        return DocumentDetail.model_validate(doc)

    async def prepare_download(
        self, doc_id: str, runs_reader: TestRunReader | None = None
    ) -> DownloadPayload:
        """Resolve a downloadable file (PDF, CSV, or reconstructed Markdown/CSV) for ``doc_id``."""
        want_low = doc_id.strip().lower()
        if want_low.endswith(".csv") and runs_reader is not None:
            all_runs = await runs_reader.list()
            matching = [r for r in all_runs if str(r.get("source_doc_id") or "").lower() == want_low]
            if matching:
                safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", Path(doc_id).name)
                if not safe_name.lower().endswith(".csv"):
                    safe_name = f"{safe_name}.csv"
                return DownloadPayload(
                    filename=safe_name,
                    media_type="text/csv; charset=utf-8",
                    content=_rows_to_csv_bytes(matching),
                )

        file_path = resolve_document_file(doc_id)
        if file_path is not None:
            return DownloadPayload(
                filename=file_path.name,
                media_type=_media_type_for(file_path),
                file_path=file_path,
            )

        detail = await self.get(doc_id)
        safe_stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", detail.doc_id)
        return DownloadPayload(
            filename=f"{safe_stem}.md",
            media_type="text/markdown; charset=utf-8",
            content=_detail_to_markdown_bytes(detail),
        )


__all__ = ["DocumentService", "DownloadPayload", "resolve_document_file"]
