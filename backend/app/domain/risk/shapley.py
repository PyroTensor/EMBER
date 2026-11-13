"""Exact Shapley values by full coalition enumeration (model-agnostic).

Same enumeration order, weights and floating-point summation order as the legacy ``risk.shapley``:
for each player i (in ``players`` order), for each coalition size r = 0..n-1, for each
``itertools.combinations(others, r)``: ``phi[i] += w(r) * (v(S ∪ {i}) - v(S))``.
"""

from __future__ import annotations

import itertools
import math
from collections.abc import Callable, Hashable, Sequence


def exact_shapley[P: Hashable](
    value_fn: Callable[[frozenset[P]], float], players: Sequence[P]
) -> dict[P, float]:
    names = list(players)
    n = len(names)
    cache: dict[frozenset[P], float] = {}

    def v(s: frozenset[P]) -> float:
        if s not in cache:
            cache[s] = value_fn(s)
        return cache[s]

    phi = {k: 0.0 for k in names}
    for i in names:
        others = [k for k in names if k != i]
        for r in range(n):
            w = math.factorial(r) * math.factorial(n - r - 1) / math.factorial(n)
            for subset in itertools.combinations(others, r):
                s = frozenset(subset)
                phi[i] += w * (v(s | {i}) - v(s))
    return phi


__all__ = ["exact_shapley"]
