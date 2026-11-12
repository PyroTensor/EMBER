"use client";

import type { RankedExperiment, RankWeights } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtNum } from "@/lib/format";
import { fmtScore, normalizeWeights, SCORE_COMPONENTS, weightPercents } from "../lib/score-format";

interface ScoreBreakdownProps {
  run: RankedExperiment;
  /** The weights the ranking was computed with (from the response). */
  weights: RankWeights;
}

/** How the total score of one run is built: Σ normalised weight × sub-score. */
export function ScoreBreakdown({ run, weights }: ScoreBreakdownProps) {
  const share = normalizeWeights(weights);
  const pct = weightPercents(weights);
  const parts = SCORE_COMPONENTS.map((c) => {
    const score = run[c.key] ?? 0;
    return { ...c, score, points: share[c.key] * score };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-mono text-fg">{run.experiment_id}</span> · rank {run.rank}
        </p>
        <p className="font-mono text-2xl font-semibold text-fg tabular-nums">
          {fmtScore(run.total_score)}
          <span className="ml-1 text-xs font-normal text-muted">/ 100</span>
        </p>
      </div>

      {/* Stacked bar: each segment is that component's points towards the total. */}
      <div
        role="img"
        aria-label={`Total ${fmtScore(run.total_score)}: ${parts.map((p) => `${p.label} ${fmtNum(p.points, 1)} points`).join(", ")}`}
        className="flex h-3 overflow-hidden rounded-full bg-surface-2"
      >
        {parts.map((p) => (
          <div key={p.key} className={cn("h-full transition-[width] duration-300", p.barClass)} style={{ width: `${p.points}%` }} />
        ))}
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] text-muted">
            <th scope="col" className="pb-1 font-medium">Component</th>
            <th scope="col" className="pb-1 text-right font-medium">Weight</th>
            <th scope="col" className="pb-1 text-right font-medium">Score</th>
            <th scope="col" className="pb-1 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {parts.map((p) => (
            <tr key={p.key} className="border-t border-border/60">
              <th scope="row" className="py-1.5 text-left font-sans font-normal text-fg">
                <span aria-hidden className={cn("mr-2 inline-block size-2 rounded-full", p.barClass)} />
                {p.label}
              </th>
              <td className="py-1.5 text-right text-muted">{pct[p.key]} %</td>
              <td className="py-1.5 text-right text-muted">{fmtScore(p.score)}</td>
              <td className="py-1.5 text-right text-fg">{fmtNum(p.points, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
