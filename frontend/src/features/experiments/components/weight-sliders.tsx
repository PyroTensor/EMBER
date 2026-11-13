"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { RankWeights } from "@/lib/api/types";
import { DEFAULT_RANK_WEIGHTS, SCORE_COMPONENTS, weightPercents } from "../lib/score-format";

interface WeightSlidersProps {
  weights: RankWeights;
  onChange: (weights: RankWeights) => void;
}

const isDefault = (w: RankWeights) =>
  SCORE_COMPONENTS.every(({ key }) => w[key] === DEFAULT_RANK_WEIGHTS[key]);

/** Raw 0–1 weights; each readout shows its normalised share (the ranker divides by the sum). */
export function WeightSliders({ weights, onChange }: WeightSlidersProps) {
  const pct = weightPercents(weights);

  return (
    <div className="space-y-5">
      {SCORE_COMPONENTS.map(({ key, label, description }) => (
        <Slider
          key={key}
          label={`${label} weight`}
          value={weights[key]}
          min={0}
          max={1}
          step={0.05}
          format={() => `${pct[key]} %`}
          hint={description}
          onChange={(v) => onChange({ ...weights, [key]: v })}
        />
      ))}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted">Shares always add up to 100 %.</p>
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_RANK_WEIGHTS })} disabled={isDefault(weights)}>
          <RotateCcw aria-hidden className="size-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
