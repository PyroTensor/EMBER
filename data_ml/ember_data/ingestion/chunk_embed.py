"""Stage 6 - Chunk & embed: section-aware chunks + metadata (investigation, fuel, O2, gravity).

Chunks never cross a page boundary (so [doc, page] citations stay exact) and are split on
markdown headings first, then on paragraphs up to MAX_CHARS.

Embeddings: local sentence-transformers (BAAI/bge-small-en-v1.5, 384-dim, normalised).
bge expects an instruction prefix on *queries* only - use `embed_query()` at query time.
"""
from __future__ import annotations

import os
import re
from functools import lru_cache

from ember_data.schema import Chunk, Document

MAX_CHARS = 1100
HEADING = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


def _split_sections(page_text: str, carry_section: str) -> list[tuple[str, str]]:
    """-> [(section_title, body)]; text before the first heading inherits carry_section."""
    out: list[tuple[str, str]] = []
    pos, current = 0, carry_section
    for m in HEADING.finditer(page_text):
        body = page_text[pos:m.start()].strip()
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
        **{k: v for k, v in doc.metadata.items() if k in ("investigation", "fuel", "o2_range", "pressure_kpa", "gravity", "proxy")},
    }
    chunks: list[Chunk] = []
    section = doc.title
    for page_no, page_text in enumerate(doc.pages, start=1):
        for sec, body in _split_sections(page_text, section):
            section = sec
            for text in _pack(body):
                if len(text) < 40:  # skip stray fragments
                    continue
                chunks.append(Chunk(doc_id=doc.doc_id, page=page_no, section=sec, text=text, metadata=base_meta))
    return chunks


@lru_cache(maxsize=1)
def get_embedder():
    from sentence_transformers import SentenceTransformer  # heavy import - lazy

    return SentenceTransformer(os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5"))


def embed_texts(texts: list[str]) -> list[list[float]]:
    vecs = get_embedder().encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
    return [v.tolist() for v in vecs]


def embed_query(query: str) -> list[float]:
    return embed_texts([BGE_QUERY_PREFIX + query])[0]


def embed_chunks(chunks: list[Chunk]) -> list[Chunk]:
    texts = [f"{c.metadata.get('title', '')} | {c.section}\n{c.text}" for c in chunks]
    for c, v in zip(chunks, embed_texts(texts)):
        c.embedding = v
    return chunks
