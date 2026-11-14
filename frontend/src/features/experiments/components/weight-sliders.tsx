"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { RankWeights } from "@/lib/api/types";
import { DEFAULT_RANK_WEIGHTS, SCORE_COMPONENTS, weightPercents, type ScoreComponent } from "../lib/score-format";

interface WeightSlidersProps {
  weights: RankWeights;
  onChange: (weights: RankWeights) => void;
}

const isDefault = (w: RankWeights) =>
  SCORE_COMPONENTS.every(({ key }) => w[key] === DEFAULT_RANK_WEIGHTS[key]);

const PRESETS: readonly { label: string; weights: RankWeights }[] = [
  { label: "Balanced", weights: { ...DEFAULT_RANK_WEIGHTS } },
  { label: "Closest conditions", weights: { similarity: 0.8, completeness: 0.1, criticality: 0.1 } },
  { label: "Most complete data", weights: { similarity: 0.2, completeness: 0.7, criticality: 0.1 } },
  { label: "Observed severity", weights: { similarity: 0.2, completeness: 0.1, criticality: 0.7 } },
];

function setShare(weights: RankWeights, key: ScoreComponent, percent: number): RankWeights {
  const share = Math.min(1, Math.max(0, percent / 100));
  const remaining = 1 - share;
  const others = SCORE_COMPONENTS.map((component) => component.key).filter((other) => other !== key);
  const otherTotal = others.reduce((sum, other) => sum + weights[other], 0);
  const next = { ...weights, [key]: share };
  for (const other of others) {
    next[other] = remaining * (otherTotal > 0 ? weights[other] / otherTotal : 1 / others.length);
  }
  return next;
}

/** Direct percentage shares; adjusting one redistributes the remainder across the other two. */
export function WeightSliders({ weights, onChange }: WeightSlidersProps) {
  const pct = weightPercents(weights);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted">Starting point</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ranking weight presets">
          {PRESETS.map((preset) => {
            const selected = SCORE_COMPONENTS.every(({ key }) => Math.abs(weights[key] - preset.weights[key]) < 0.0001);
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...preset.weights })}
                className={selected
                  ? "rounded-md border border-accent bg-accent/10 px-2 py-1 text-xs font-medium text-accent"
                  : "rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-fg"}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
      {SCORE_COMPONENTS.map(({ key, label, description }) => (
        <Slider
          key={key}
          label={`${label} share`}
          value={weights[key] * 100}
          min={0}
          max={100}
          step={1}
          format={() => `${pct[key]} %`}
          hint={description}
          onChange={(v) => onChange(setShare(weights, key, v))}
        />
      ))}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted">Changing one share redistributes the other two. Total: 100 %.</p>
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_RANK_WEIGHTS })} disabled={isDefault(weights)}>
          <RotateCcw aria-hidden className="size-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
