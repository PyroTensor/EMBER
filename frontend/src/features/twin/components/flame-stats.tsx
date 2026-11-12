import { cn } from "@/lib/cn";
import type { RiskBand } from "@/lib/api/types";
import type { FlamePhysics } from "../lib/flame-physics";

const RISK_TEXT: Readonly<Record<RiskBand, string>> = {
  LOW: "text-risk-low",
  ELEVATED: "text-risk-elevated",
  HIGH: "text-risk-high",
  CRITICAL: "text-risk-critical",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] tracking-wide text-muted">{label}</dt>
      <dd className={cn("mt-1 font-mono text-sm font-semibold tabular-nums", tone ?? "text-fg")}>{value}</dd>
    </div>
  );
}

export function flameState(vitality: number): string {
  return vitality > 0.85 ? "Burning" : vitality > 0.04 ? "Dying out" : "Extinguished";
}

interface FlameStatsProps {
  physics: FlamePhysics;
  vitality: number;
}

export function FlameStats({ physics, vitality }: FlameStatsProps) {
  const signed = `${physics.margin >= 0 ? "+" : ""}${physics.margin.toFixed(1)} %`;
  return (
    <dl className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-5 sm:grid-cols-4">
      <Stat label="REGIME" value={physics.regime} />
      <Stat label="FLAME STATE" value={flameState(vitality)} />
      <Stat
        label="FIRE RISK"
        value={`${physics.riskIndex.toFixed(1)} ${physics.riskBand}`}
        tone={RISK_TEXT[physics.riskBand]}
      />
      <Stat label="PEAK TEMP (≈)" value={`${Math.round(physics.tempK)} K`} />
      <Stat label="LOI" value={`${physics.loi.toFixed(1)} %`} />
      <Stat label="O₂ MARGIN" value={signed} tone={physics.margin >= 0 ? undefined : "text-risk-critical"} />
      <Stat label="u BUOYANT" value={`${physics.uBuoyant.toFixed(1)} cm/s`} />
      <Stat label="u EFFECTIVE" value={`${physics.uEff.toFixed(1)} cm/s`} />
    </dl>
  );
}
