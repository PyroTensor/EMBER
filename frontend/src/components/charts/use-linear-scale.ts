import { useMemo } from "react";

export type Domain = readonly [number, number];
export type Range = readonly [number, number];

export interface LinearScale {
  (value: number): number;
  invert: (pixel: number) => number;
  domain: Domain;
  range: Range;
}

/** Maps `domain` linearly onto `range` (no clamping). A zero-width domain maps everything to the range middle. */
export function linearScale(domain: Domain, range: Range): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const scale = ((v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0))) as LinearScale;
  scale.invert = (p: number) => (r1 === r0 ? d0 : d0 + ((p - r0) / (r1 - r0)) * span);
  scale.domain = domain;
  scale.range = range;
  return scale;
}

/** A "nice" step (1, 2, 2.5 or 5 × 10^n) giving roughly `count` intervals over `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const factor = residual > 5 ? 10 : residual > 2.5 ? 5 : residual > 2 ? 2.5 : residual > 1 ? 2 : 1;
  return factor * magnitude;
}

/** Domain widened outward to multiples of a nice step. */
export function niceDomain([min, max]: Domain, count = 5): Domain {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return min === 0 ? [-1, 1] : [Math.min(0, min * 2), Math.max(0, max * 2)];
  const step = niceStep(max - min, count);
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

/** Evenly spaced nice tick values inside [min, max]. */
export function niceTicks([min, max]: Domain, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const step = niceStep(max - min, count);
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toPrecision(12))); // strip float noise (0.30000000000000004 → 0.3)
  }
  return ticks;
}

interface ScaleOptions {
  /** Widen the domain to nice round values (default true). */
  nice?: boolean;
  /** Approximate number of ticks (default 5). */
  ticks?: number;
}

/** Memoised linear scale + nice ticks for a chart axis. */
export function useLinearScale(domain: Domain, range: Range, { nice = true, ticks = 5 }: ScaleOptions = {}) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return useMemo(() => {
    const d = nice ? niceDomain([d0, d1], ticks) : ([d0, d1] as const);
    return { scale: linearScale(d, [r0, r1]), ticks: niceTicks(d, ticks) };
  }, [d0, d1, r0, r1, nice, ticks]);
}
