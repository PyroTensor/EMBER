"""``documents`` table access: upsert (ingestion) + summary/detail reads for the Document Reader."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import func, select

from app.models.chunk import Chunk
from app.models.document import Document
from app.models.test_run import TestRun
from app.repositories.base import SqlRepository

_JUNK_TITLES = frozenset(
    {
        "letterhead",
        "untitled",
        "slide 1",
        "no slide title",
        "powerpoint presentation",
        "powerpoint-präsentation",
    }
)
_ACRONYMS = frozenset(
    {
        "nasa",
        "ntrs",
        "psi",
        "iss",
        "acme",
        "bass",
        "bass-ii",
        "flex",
        "flex-2",
        "sofie",
        "saffire",
        "spice",
        "slice",
        "same",
        "same-r",
        "daft",
        "daft-2",
        "cfi",
        "cfi-g",
        "cld",
        "srd",
        "scr",
        "dld",
        "dod",
        "pmma",
        "fm2",
        "mir",
        "e-field",
        "s-flame",
        "feanics",
        "as204",
    }
)
_EXACT_TITLES: dict[str, str] = {
    "ACME_CFI-G_Final_Report": "ACME Cool Flames Investigation with Gases (CFI-G) Final Report",
    "BASS_DLD": "BASS Data Logging Document (DLD)",
    "BASS_SRD": "BASS Science Requirements Document (Feb 2010)",
    "BASS-II_SRD": "BASS-II Science Requirements Document (SRD)",
    "DAFT_30-Day_Postflight_Report": "DAFT 30-Day Postflight Science Report",
    "FEANICS_SRD": "FEANICS Science Requirements Document (SRD)",
    "FLEX_SRD": "FLEX Science Requirements Document (SRD)",
    "SAFFIRE_Objectives_Development_Status": "Saffire Objectives & Development Status (8th IAASS)",
    "SAME-R_Final_Report": "SAME-R Final Science Report",
    "SAME_Final_Science_Report": "SAME Final Science Report",
    "SPICE_Dotson_Thesis_Smoke_Points": "SPICE Smoke Points in Co-Flow Flames (Dotson Thesis)",
    "SPICE_Final_Report": "SPICE Final Science Report",
}
_PSI_INVESTIGATIONS: dict[str, str] = {
    "10": "ACME Flame Design",
    "20": "ACME CLD Flame",
    "21": "ACME CLD Flame",
    "22": "ACME E-FIELD Flames",
    "23": "ACME s-Flame",
    "25": "BASS-II",
    "26": "BASS",
    "39": "FLEX CFI",
    "47": "DAFT",
    "60": "SoFIE-GEL",
    "62": "FLEX",
    "68": "FLEX-2",
    "69": "FLEX",
    "98": "Saffire-I",
    "99": "Saffire-II",
    "100": "Saffire-III",
    "101": "Saffire-IV",
    "102": "Saffire-V",
    "106": "SoFIE-MIST",
    "107": "FEANICS",
    "117": "BASS",
    "142": "Saffire-VI",
    "159": "ACME CFI-G",
}
_DOC_TO_PSI: dict[str, str] = {
    "ACME_CFI-G_Final_Report": "PSI-159",
    "BASS-II_SRD": "PSI-25",
    "BASS_DLD": "PSI-26",
    "BASS_SRD": "PSI-26",
    "DAFT_30-Day_Postflight_Report": "PSI-47",
    "ISS-ACME": "PSI-159",
    "ISS-BASS-II": "PSI-25",
    "ISS-FLEX": "PSI-69",
    "ISS-Saffire": "PSI-98",
}
_NTRS_RE = re.compile(r"NTRS-(\d{6,})", re.IGNORECASE)
_PSI_RE = re.compile(r"\bPSI-(\d+)\b", re.IGNORECASE)
_DATE_SUFFIX_RE = re.compile(r"[_\s-]+(20\d{2})(\d{2})(\d{2})$")


def _title_token(tok: str) -> str:
    low = tok.lower()
    if low == "scidoc":
        return "Science Document"
    if low == "s-flame":
        return "s-Flame"
    if low == "same-r":
        return "SAME-R"
    if low == "daft-2":
        return "DAFT-2"
    if low == "flex-2":
        return "FLEX-2"
    if low == "bass-ii":
        return "BASS-II"
    if low == "cfi-g":
        return "CFI-G"
    if low in _ACRONYMS:
        return tok.upper()
    if low.startswith("psi-") or low.startswith("ntrs-"):
        return tok.upper()
    if re.fullmatch(r"v\d+(?:\.\d+)?", low):
        return low
    return tok.capitalize()


def _humanize_doc_id(doc_id: str) -> str:
    if doc_id in _EXACT_TITLES:
        return _EXACT_TITLES[doc_id]
    if m_exact := re.fullmatch(r"NTRS-(\d+)", doc_id, re.IGNORECASE):
        return f"NASA Technical Reports Server Document (NTRS-{m_exact.group(1)})"
    s = doc_id
    s = re.sub(r"^(?:NASA|WEB)[_-]+", "", s, flags=re.IGNORECASE)
    date_label = ""
    if m_date := _DATE_SUFFIX_RE.search(s):
        date_label = f" ({m_date.group(1)}-{m_date.group(2)}-{m_date.group(3)})"
        s = s[: m_date.start()]
    s = re.sub(r"_+|-+$", " ", s.replace("_", " "))
    # Preserve hyphenated terms like BASS-II, CFI-G, E-FIELD, s-Flame while splitting plain slugs
    parts = [p for p in s.split() if p]
    out_words: list[str] = []
    for part in parts:
        low = part.lower()
        if low in _ACRONYMS or low.startswith(("psi-", "ntrs-")):
            out_words.append(_title_token(part))
        elif "-" in part:
            subparts = part.split("-")
            if all(sp.lower() in _ACRONYMS or len(sp) <= 3 for sp in subparts):
                out_words.append(_title_token(part))
            else:
                out_words.extend(_title_token(sp) for sp in subparts if sp)
        else:
            out_words.append(_title_token(part))
    label = " ".join(out_words).strip() or doc_id
    if doc_id.startswith("NASA_") and "NASA" not in label:
        label = f"NASA {label}"
    return f"{label}{date_label}"


def _clean_doc_title(doc_id: str, raw_title: str | None) -> str:
    raw = (raw_title or "").strip()
    low = raw.lower()
    if raw.startswith(("Microsoft Word - ", "Microsoft PowerPoint - ")):
        stripped = re.sub(r"^Microsoft (?:Word|PowerPoint) - ", "", raw).strip()
        stripped = re.sub(r"\.(?:docx?|pptx?|pdf)$", "", stripped, flags=re.IGNORECASE).strip()
        stripped = re.sub(r"\s+", " ", stripped.replace("_", " "))
        if stripped and len(stripped) > 4:
            return stripped
    is_junk = (
        not raw
        or low == doc_id.lower()
        or low in _JUNK_TITLES
        or low.startswith("title date")
        or bool(re.fullmatch(r"[a-z0-9_.-]+\.(?:pdf|docx?|pptx?|md|csv)", low))
    )
    if is_junk:
        return _humanize_doc_id(doc_id)
    return raw


def _infer_investigation(doc_id: str, title: str, existing: Any) -> str | None:
    if existing:
        return str(existing)
    if m_psi := _PSI_RE.search(doc_id):
        num = m_psi.group(1)
        if num in _PSI_INVESTIGATIONS:
            return _PSI_INVESTIGATIONS[num]
        return f"PSI-{num}"
    combined = f"{doc_id} {title}".lower()
    for token, name in (
        ("bass-ii", "BASS-II"),
        ("bass", "BASS"),
        ("sofie", "SoFIE"),
        ("saffire", "Saffire"),
        ("cfi-g", "ACME CFI-G"),
        ("e-field", "ACME E-FIELD Flames"),
        ("s-flame", "ACME s-Flame"),
        ("acme", "ACME"),
        ("flex-2", "FLEX-2"),
        ("flex", "FLEX"),
        ("spice", "SPICE"),
        ("slice", "SLICE"),
        ("same", "SAME"),
        ("daft", "DAFT"),
    ):
        if token in combined:
            return name
    return None


def build_pages(chunks: list[dict[str, Any]], page_count: int) -> list[dict[str, Any]]:
    """Group ordered chunk rows into pages, merging adjacent chunks from the same section."""
    by_page: dict[int, list[dict[str, str]]] = {}
    for ch in chunks:
        p = int(ch.get("page") or 1)
        sec = str(ch.get("section") or "")
        txt = str(ch.get("text") or "")
        sections = by_page.setdefault(p, [])
        if sections and sections[-1]["section"] == sec:
            sections[-1]["text"] = f"{sections[-1]['text']}\n\n{txt}"
        else:
            sections.append({"section": sec, "text": txt})
    max_page = max(page_count, max(by_page.keys(), default=1))
    return [
        {"page": p, "sections": by_page.get(p, [])}
        for p in range(1, max_page + 1)
        if p in by_page or p <= page_count
    ]


def extract_doc_meta(doc_row: dict[str, Any], chunks: list[dict[str, Any]]) -> dict[str, Any]:
    """Assemble ``DocumentSummary`` fields from a document row and its chunk metadata."""
    doc_id = str(doc_row["doc_id"])
    meta: dict[str, Any] = {}
    for ch in chunks:
        m = ch.get("metadata")
        if isinstance(m, dict) and m:
            meta = m
            break
    url = doc_row.get("url") or meta.get("url")
    raw_sources = meta.get("sources")
    sources = [str(s) for s in raw_sources if s] if isinstance(raw_sources, list) else []

    if not url:
        if m_ntrs := _NTRS_RE.search(doc_id):
            url = f"https://ntrs.nasa.gov/citations/{m_ntrs.group(1)}"
        elif psi_code := _DOC_TO_PSI.get(doc_id):
            url = f"https://psi.nasa.gov/physci/repo/data/investigations/{psi_code}"
        elif m_psi := _PSI_RE.search(doc_id):
            url = f"https://psi.nasa.gov/physci/repo/data/investigations/PSI-{m_psi.group(1)}"

    if url and url not in sources:
        sources = [str(url), *sources]
    elif not url and sources:
        url = sources[0]

    page_count = int(doc_row.get("page_count") or max((int(c.get("page") or 1) for c in chunks), default=1))
    title = _clean_doc_title(doc_id, doc_row.get("title") or meta.get("title"))
    inv = _infer_investigation(doc_id, title, meta.get("investigation"))
    proxy = meta.get("proxy")
    return {
        "doc_id": doc_id,
        "title": title,
        "source_type": str(doc_row.get("source_type") or meta.get("source_type") or "ntrs"),
        "is_proxy": proxy if isinstance(proxy, bool) else None,
        "investigation": str(inv) if inv else None,
        "url": str(url) if url else None,
        "sources": sources,
        "page_count": page_count,
    }


class PgDocumentRepository(SqlRepository[Document]):
    model = Document
    conflict_cols = ("doc_id",)

    async def list_all(self) -> list[dict[str, Any]]:
        doc_res = await self.session.execute(select(self.table).order_by(self.table.c.doc_id))
        doc_rows = [dict(r) for r in doc_res.mappings()]
        chunk_res = await self.session.execute(
            select(
                Chunk.id,
                Chunk.doc_id,
                Chunk.page,
                Chunk.section,
                Chunk.text,
                Chunk.metadata_.label("metadata"),
            ).order_by(Chunk.doc_id, Chunk.page, Chunk.id)
        )
        chunks_by_doc: dict[str, list[dict[str, Any]]] = {}
        for r in chunk_res.mappings():
            chunks_by_doc.setdefault(str(r["doc_id"]), []).append(dict(r))
        run_res = await self.session.execute(
            select(TestRun.source_doc_id, TestRun.experiment_id)
            .where(TestRun.source_doc_id.is_not(None))
            .order_by(TestRun.source_doc_id, TestRun.experiment_id)
        )
        runs_by_doc: dict[str, list[str]] = {}
        for r in run_res.mappings():
            runs_by_doc.setdefault(str(r["source_doc_id"]), []).append(str(r["experiment_id"]))
        out: list[dict[str, Any]] = []
        for d in doc_rows:
            doc_id = str(d["doc_id"])
            doc_chunks = chunks_by_doc.get(doc_id, [])
            summary = extract_doc_meta(d, doc_chunks)
            out.append(
                {
                    **summary,
                    "pages": build_pages(doc_chunks, summary["page_count"]),
                    "related_experiment_ids": runs_by_doc.get(doc_id, []),
                }
            )
        return out

    async def get_detail(self, doc_id: str) -> dict[str, Any] | None:
        doc_res = await self.session.execute(select(self.table).where(self.table.c.doc_id == doc_id))
        doc_mapping = doc_res.mappings().first()
        if doc_mapping is None:
            doc_res = await self.session.execute(
                select(self.table).where(func.lower(self.table.c.doc_id) == doc_id.lower())
            )
            doc_mapping = doc_res.mappings().first()
        if doc_mapping is None:
            return None
        doc_row = dict(doc_mapping)
        canonical_id = str(doc_row["doc_id"])
        chunk_res = await self.session.execute(
            select(
                Chunk.id,
                Chunk.doc_id,
                Chunk.page,
                Chunk.section,
                Chunk.text,
                Chunk.metadata_.label("metadata"),
            )
            .where(Chunk.doc_id == canonical_id)
            .order_by(Chunk.page, Chunk.id)
        )
        chunks = [dict(r) for r in chunk_res.mappings()]
        run_res = await self.session.execute(
            select(TestRun.experiment_id)
            .where(TestRun.source_doc_id == canonical_id)
            .order_by(TestRun.experiment_id)
        )
        related_runs = [str(r) for r in run_res.scalars()]
        summary = extract_doc_meta(doc_row, chunks)
        return {
            **summary,
            "pages": build_pages(chunks, summary["page_count"]),
            "related_experiment_ids": related_runs,
        }


__all__ = ["PgDocumentRepository", "build_pages", "extract_doc_meta"]
