"""``documents`` table access: upsert (ingestion) + summary/detail reads for the Document Reader."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

from app.models.chunk import Chunk
from app.models.document import Document
from app.models.test_run import TestRun
from app.repositories.base import SqlRepository


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
    meta: dict[str, Any] = {}
    for ch in chunks:
        m = ch.get("metadata")
        if isinstance(m, dict) and m:
            meta = m
            break
    url = doc_row.get("url") or meta.get("url")
    raw_sources = meta.get("sources")
    sources = [str(s) for s in raw_sources if s] if isinstance(raw_sources, list) else []
    if url and url not in sources:
        sources = [str(url), *sources]
    elif not url and sources:
        url = sources[0]
    page_count = int(doc_row.get("page_count") or max((int(c.get("page") or 1) for c in chunks), default=1))
    inv = meta.get("investigation")
    return {
        "doc_id": str(doc_row["doc_id"]),
        "title": str(doc_row.get("title") or meta.get("title") or doc_row["doc_id"]),
        "source_type": str(doc_row.get("source_type") or meta.get("source_type") or "ntrs"),
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
            return None
        doc_row = dict(doc_mapping)
        chunk_res = await self.session.execute(
            select(
                Chunk.id,
                Chunk.doc_id,
                Chunk.page,
                Chunk.section,
                Chunk.text,
                Chunk.metadata_.label("metadata"),
            )
            .where(Chunk.doc_id == doc_id)
            .order_by(Chunk.page, Chunk.id)
        )
        chunks = [dict(r) for r in chunk_res.mappings()]
        run_res = await self.session.execute(
            select(TestRun.experiment_id)
            .where(TestRun.source_doc_id == doc_id)
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
