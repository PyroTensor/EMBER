import type { RankWeights } from "@/lib/api/types";
import { fmtNum } from "@/lib/format";

export type ScoreComponent = keyof RankWeights;

/** The three ranker sub-scores (each 0–100), in display order. */
export const SCORE_COMPONENTS: readonly {
  key: ScoreComponent;
  label: string;
  short: string;
  description: string;
  /** Tailwind bg class for mini-bars (full literal for Tailwind detection). */
  barClass: string;
}[] = [
  {
    key: "similarity",
    label: "Similarity",
    short: "Sim",
    description: "How close the run's O₂, pressure, flow and gravity are to the scenario (material/diluent match)",
    barClass: "bg-sky-400",
  },
  {
    key: "completeness",
    label: "Completeness",
    short: "Comp",
    description: "Share of optional outputs present plus richness of extra telemetry",
    barClass: "bg-live",
  },
  {
    key: "criticality",
    label: "Criticality",
    short: "Crit",
    description: "Regime severity, radiative flux and O₂ margin over the LOI",
    barClass: "bg-accent",
  },
];

/** Score display: one decimal, "—" for missing. */
export const fmtScore = (v: number | null | undefined) => fmtNum(v, 1);

/** Clamp a 0–100 score into a bar width percentage. */
export const scoreWidth = (v: number | null | undefined) => `${Math.min(100, Math.max(0, v ?? 0))}%`;

/** Weights as shares of their sum (the ranker divides by the sum, so only proportions matter). */
export function normalizeWeights(w: RankWeights): RankWeights {
  const sum = w.similarity + w.completeness + w.criticality;
  if (sum <= 0) return { similarity: 1 / 3, completeness: 1 / 3, criticality: 1 / 3 };
  return { similarity: w.similarity / sum, completeness: w.completeness / sum, criticality: w.criticality / sum };
}

/** Normalized weights as whole percentages that always add up to 100 (largest-remainder rounding). */
export function weightPercents(w: RankWeights): Record<ScoreComponent, number> {
  const n = normalizeWeights(w);
  const keys = SCORE_COMPONENTS.map((c) => c.key);
  const raw = keys.map((k) => n[k] * 100);
  const floors = raw.map(Math.floor);
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of byRemainder) {
    if (rest <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    rest--;
  }
  return Object.fromEntries(keys.map((k, i) => [k, floors[i] ?? 0])) as Record<ScoreComponent, number>;
}
