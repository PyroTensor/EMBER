"""Okapi BM25 over an in-memory corpus, with the legacy tokenizer and stopword list.

Same scoring as legacy ``backend/app/db/session.py::_bm25_scores`` (k1=1.5, b=0.75, idf = ln(1 + (N - df +
.5) / (df + .5))); document tokens and length statistics are computed once instead of on every query.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Sequence
from typing import Final

STOPWORDS: Final = frozenset(
    {
        "a", "an", "and", "are", "as", "at", "be", "by", "does", "for", "from", "how", "in", "is",
        "it", "of", "on", "or", "that", "the", "to", "what", "when", "where", "which", "why", "with",
    }
)  # fmt: skip
_TOKEN = re.compile(r"[a-z0-9_.-]+")


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if len(t) > 1 and t not in STOPWORDS]


class BM25:
    def __init__(self, documents: Sequence[str], k1: float = 1.5, b: float = 0.75) -> None:
        self.k1, self.b = k1, b
        self._tf = [Counter(tokenize(d)) for d in documents]
        self._len = [sum(tf.values()) for tf in self._tf]
        self._n = len(documents)
        self._avgdl = sum(self._len) / max(self._n, 1)

    def scores(self, query: str) -> dict[int, float]:
        """``{document index: score}`` for documents with a positive score."""
        terms = tokenize(query)
        if not terms or not self._n:
            return {}
        df = {t: sum(1 for tf in self._tf if t in tf) for t in set(terms)}
        out: dict[int, float] = {}
        for i, tf in enumerate(self._tf):
            s = 0.0
            dl = self._len[i] or 1
            for t in terms:
                f = tf.get(t, 0)
                if f == 0:
                    continue
                idf = math.log(1.0 + (self._n - df[t] + 0.5) / (df[t] + 0.5))
                s += idf * (f * (self.k1 + 1.0)) / (f + self.k1 * (1.0 - self.b + self.b * dl / self._avgdl))
            if s > 0:
                out[i] = s
        return out


__all__ = ["BM25", "STOPWORDS", "tokenize"]
