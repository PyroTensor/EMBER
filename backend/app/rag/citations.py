"""Citation tags and a citation-aware sentence splitter (fixes context.md §10.9).

Tags: ``[DOC-XX p.Y]`` for document pages, ``[EXP-XXXX]`` / ``[PSI-25_B1]`` for test runs.
``split_sentences`` understands LLM-style output: it splits on ``. ! ?`` + whitespace and on newlines,
strips bullet markers (``- ``, ``* ``, ``1. ``), never splits inside a ``[ ... ]`` tag, and keeps tags
that follow the full stop (``Claim. [DOC-01 p.3]``) with the sentence they belong to. Closing emphasis,
quotes or brackets right after the terminator stay with the sentence (``**Do X.** Then Y.`` is two
sentences, so an uncited bold heading can't hide inside the next, cited one).
"""

from __future__ import annotations

import re
from typing import Final

DOC_CITE: Final = re.compile(r"\[([A-Za-z0-9_-]+)\s+p\.(\d+)\]")
# Test-run ids: proxy ``EXP-0012``; official PSI ids kept verbatim (``PSI-25_B1``, ``PSI-99_2-5``).
RUN_ID: Final = r"(?:[A-Z][A-Z0-9]*-[A-Za-z0-9][A-Za-z0-9_.-]*|[A-Za-z][A-Za-z0-9]*-\d+[A-Za-z0-9_.-]*)"
EXP_CITE: Final = re.compile(rf"\[({RUN_ID})\]")
# A run id mentioned in a free-text question ("what happened in psi-25_b1?", "EXP-0012").
RUN_ID_MENTION: Final = re.compile(r"\b(?:exp-\d{4}|[a-z][a-z0-9]*-\d+_[a-z0-9][a-z0-9.-]*[a-z0-9])\b", re.I)

_TERMINATORS: Final = ".!?"
# Markdown emphasis, closing quotes and brackets that may sit between a terminator and the next sentence.
_CLOSERS: Final = "*_\"')”’"
_BULLET: Final = re.compile(r"[ \t]*(?:[-*•][ \t]+|\d{1,3}[.)][ \t]+)")
# A citation tag right after a full stop, optionally separated by spaces, commas or semicolons.
_TRAILING_TAG: Final = re.compile(rf"[ \t,;]*\[(?:[A-Za-z0-9_-]+\s+p\.\d+|{RUN_ID})\]")


def format_doc_tag(doc_id: str, page: int) -> str:
    return f"[{doc_id} p.{page}]"


def format_exp_tag(experiment_id: str) -> str:
    return f"[{experiment_id}]"


def extract_tags(text: str) -> tuple[list[tuple[str, int]], list[str]]:
    """Return ``(doc_tags, experiment_ids)`` in order of first appearance, without duplicates."""
    docs = list(dict.fromkeys((doc_id, int(page)) for doc_id, page in DOC_CITE.findall(text)))
    exps = list(dict.fromkeys(EXP_CITE.findall(text)))
    return docs, exps


def _absorb_trailing_tags(text: str, pos: int) -> int:
    while m := _TRAILING_TAG.match(text, pos):
        pos = m.end()
    return pos


def _ends_sentence(text: str, nxt: int) -> bool:
    """A terminator ends a sentence when followed by end of text, whitespace or a tag (so not ``2.5``)."""
    return nxt == len(text) or text[nxt].isspace() or text[nxt] == "["


def split_sentences(text: str) -> list[str]:
    """Split ``text`` into stripped, non-empty sentences (see the module docstring for the rules)."""
    sentences: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        sentence = "".join(buf).strip()
        if sentence:
            sentences.append(sentence)
        buf.clear()

    n, i, depth, line_start = len(text), 0, 0, True
    while i < n:
        if line_start:
            line_start = False
            if depth == 0 and (m := _BULLET.match(text, i)):
                i = m.end()
                continue
        ch = text[i]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth = max(0, depth - 1)
        elif depth == 0 and ch == "\n":
            flush()
            line_start = True
            i += 1
            continue
        elif depth == 0 and ch in _TERMINATORS:
            after = i + 1
            while after < n and text[after] in _CLOSERS:  # ``Claim.**`` / ``"Claim."`` / ``(Claim.)``
                after += 1
            if _ends_sentence(text, after):
                end = _absorb_trailing_tags(text, after)
                buf.append(text[i:end])
                flush()
                i = end
                continue
        buf.append(ch)
        i += 1
    flush()
    return sentences


__all__ = [
    "DOC_CITE",
    "EXP_CITE",
    "RUN_ID",
    "RUN_ID_MENTION",
    "extract_tags",
    "format_doc_tag",
    "format_exp_tag",
    "split_sentences",
]
