"""Stage 6 - Chunk & embed: section-aware chunks + metadata (investigation, fuel, O2, gravity).

Chunks never cross a page boundary (so [doc, page] citations stay exact) and are split on
markdown headings first, then on paragraphs up to MAX_CHARS.

Embeddings come from ``app.embeddings.factory.get_embedder()`` (bge-small-en-v1.5, 384-dim, normalised by
default). bge expects an instruction prefix on *queries* only - the embedder's ``embed_query()`` adds it.
With the null embedder (``EMBED_ENABLED=false`` or model unavailable) chunks keep ``embedding=None``.
"""

from __future__ import annotations

import re

from app.embeddings.factory import get_embedder
from app.schemas.ingestion import Chunk, Document

MAX_CHARS = 1100
HEADING = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
CHUNK_META_KEYS = ("investigation", "fuel", "o2_range", "pressure_kpa", "gravity", "proxy", "url", "sources")


def _split_sections(page_text: str, carry_section: str) -> list[tuple[str, str]]:
    """-> [(section_title, body)]; text before the first heading inherits carry_section."""
    out: list[tuple[str, str]] = []
    pos, current = 0, carry_section
    for m in HEADING.finditer(page_text):
        body = page_text[pos : m.start()].strip()
        if body:
            out.append((current, body))
        current, pos = m.group(2).strip(), m.end()
    tail = page_text[pos:].strip()
    if tail:
        out.append((current, tail))
    return out


def _pack(body: str) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    chunks, buf = [], ""
    for p in paras:
        if buf and len(buf) + len(p) + 2 > MAX_CHARS:
            chunks.append(buf)
            buf = p
        else:
            buf = f"{buf}\n\n{p}" if buf else p
    if buf:
        chunks.append(buf)
    return chunks


def chunk_document(doc: Document) -> list[Chunk]:
    base_meta = {
        "title": doc.title,
        "source_type": doc.source_type,
        **{k: v for k, v in doc.metadata.items() if k in CHUNK_META_KEYS},
    }
    chunks: list[Chunk] = []
    section = doc.title
    for page_no, page_text in enumerate(doc.pages, start=1):
        for sec, body in _split_sections(page_text, section):
            section = sec
            for text in _pack(body):
                if len(text) < 40:  # skip stray fragments
                    continue
                chunks.append(
                    Chunk(doc_id=doc.doc_id, page=page_no, section=sec, text=text, metadata=base_meta)
                )
    return chunks


async def embed_texts(texts: list[str]) -> list[list[float]] | None:
    """Passage embeddings (no query prefix); ``None`` with the null embedder."""
    return await get_embedder().embed_documents(texts)


async def embed_query(query: str) -> list[float] | None:
    return await get_embedder().embed_query(query)


async def embed_chunks(chunks: list[Chunk]) -> list[Chunk]:
    texts = [f"{c.metadata.get('title', '')} | {c.section}\n{c.text}" for c in chunks]
    vectors = await embed_texts(texts)
    if vectors is None:  # null embedder: keyword-only retrieval
        return chunks
    for c, v in zip(chunks, vectors, strict=True):
        c.embedding = v
    return chunks
