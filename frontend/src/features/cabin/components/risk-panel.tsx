"use client";

import { Gauge, type GaugeBand } from "@/components/charts/gauge";
import { Badge } from "@/components/ui/badge";
import type { CabinEvaluation } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { RISK_BAND_ORDER, RISK_BANDS, riskBandMeta } from "../lib/risk-band";

const GAUGE_BANDS: GaugeBand[] = RISK_BAND_ORDER.map((band, i) => {
  const next = RISK_BAND_ORDER[i + 1];
  return {
    from: RISK_BANDS[band].from,
    to: next ? RISK_BANDS[next].from : 100,
    color: RISK_BANDS[band].color,
    label: RISK_BANDS[band].label,
  };
});

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/50 px-3 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={cn("mt-0.5 font-mono text-sm text-fg tabular-nums", className)}>{value}</dd>
    </div>
  );
}

/** Gauge + band badge + LOI, O₂ margin, predicted regime and baseline. */
export function RiskPanel({ evaluation }: { evaluation: CabinEvaluation }) {
  const band = riskBandMeta(evaluation.risk_band);
  const margin = evaluation.oxygen_margin_pct;

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,260px)_1fr]">
      <div className="flex flex-col items-center gap-2">
        <Gauge value={evaluation.risk_index} bands={GAUGE_BANDS} label="Fire risk index" caption={band?.label} />
        {band ? (
          <Badge className={cn(band.textClass, "border-current/40")} aria-label={`Risk band: ${band.label}`}>
            {band.label} risk
          </Badge>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Risk index" value={`${fmtNum(evaluation.risk_index, 1)} / 100`} className={band?.textClass} />
        <Stat label="Baseline (ISS)" value={`${fmtNum(evaluation.baseline_risk, 1)} / 100`} />
        <Stat label="Limiting O₂ index" value={fmtPct(evaluation.estimated_loi_pct, 2)} />
        <Stat
          label="O₂ margin over LOI"
          value={margin == null ? "—" : `${fmtSigned(margin, 2)} pts`}
          className={margin == null ? undefined : margin > 0 ? "text-risk-high" : "text-risk-low"}
        />
        <div className="col-span-2 rounded-md border border-border bg-surface-2/50 px-3 py-2">
          <dt className="text-[11px] text-muted">Predicted regime</dt>
          <dd className="mt-0.5 text-sm font-medium text-fg">{evaluation.predicted_regime ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
