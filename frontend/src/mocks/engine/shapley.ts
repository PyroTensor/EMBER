// Port of backend/app/domain/risk/shapley.py: exact Shapley values by full coalition enumeration.
// Same enumeration order, weights and summation order as Python: for each player i (in order), for each
// coalition size r = 0..n-1, for each itertools.combinations(others, r): phi[i] += w(r) * (v(S ∪ {i}) - v(S)).

function factorial(n: number): number {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

/** Same order as Python's itertools.combinations(items, r). */
function* combinations<T>(items: readonly T[], r: number, start = 0, prefix: T[] = []): Generator<T[]> {
  if (prefix.length === r) {
    yield prefix;
    return;
  }
  for (let i = start; i <= items.length - (r - prefix.length); i++) {
    yield* combinations(items, r, i + 1, [...prefix, items[i] as T]);
  }
}

export function exactShapley<P extends string>(
  valueFn: (coalition: ReadonlySet<P>) => number,
  players: readonly P[],
): Record<P, number> {
  const names = [...players];
  const n = names.length;
  const cache = new Map<string, number>();

  // Cache key is order-independent (like Python's frozenset).
  const v = (s: readonly P[]): number => {
    const key = [...s].sort().join("|");
    let val = cache.get(key);
    if (val === undefined) {
      val = valueFn(new Set(s));
      cache.set(key, val);
    }
    return val;
  };

  const phi = Object.fromEntries(names.map((k) => [k, 0.0])) as Record<P, number>;
  for (const i of names) {
    const others = names.filter((k) => k !== i);
    for (let r = 0; r < n; r++) {
      const w = (factorial(r) * factorial(n - r - 1)) / factorial(n);
      for (const subset of combinations(others, r)) {
        phi[i] += w * (v([...subset, i]) - v(subset));
      }
    }
  }
  return phi;
}
