"use client";

import { Check, X } from "lucide-react";
import { DivergingBars } from "@/components/charts/diverging-bars";
import type { CabinEvaluation } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtSigned } from "@/lib/format";

/** Values arrive individually rounded to 0.01 / 0.1, so the identity holds only within a small tolerance. */
export const SUM_CHECK_TOLERANCE = 0.05;

export function sumCheck(evaluation: CabinEvaluation) {
  const sum = (evaluation.contributions ?? []).reduce((s, c) => s + (c.value ?? 0), 0);
  const delta = (evaluation.risk_index ?? 0) - (evaluation.baseline_risk ?? 0);
  return { sum, delta, ok: Math.abs(sum - delta) <= SUM_CHECK_TOLERANCE };
}

/** Shapley attributions as diverging bars, plus the Σ contributions = risk − baseline check. */
export function ShapleyPanel({ evaluation }: { evaluation: CabinEvaluation }) {
  const data = (evaluation.contributions ?? []).map((c, i) => ({
    key: c.feature ?? `c${i}`,
    label: c.label ?? c.feature ?? `Factor ${i + 1}`,
    value: c.value ?? 0,
  }));
  const { sum, delta, ok } = sumCheck(evaluation);

  return (
    <div className="space-y-4">
      <DivergingBars data={data} label="Risk contributions by factor (risk points vs ISS baseline)" />
      <p
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 font-mono text-xs",
          ok ? "border-live/30 bg-live/5 text-fg" : "border-offline/40 bg-offline/10 text-fg",
        )}
      >
        <span>Σ contributions = {fmtSigned(sum, 2)}</span>
        <span className="text-muted">risk − baseline = {fmtSigned(delta, 2)}</span>
        <span className={cn("ml-auto inline-flex items-center gap-1 font-sans font-medium", ok ? "text-live" : "text-offline")}>
          {ok ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4" />}
          {ok ? "Sum check passed" : "Sum check failed"}
        </span>
      </p>
    </div>
  );
}
