"use client";

import { ChevronRight } from "lucide-react";
import { CabinControls, PresetPicker } from "@/features/cabin";
import type { CabinConfig, Preset } from "@/lib/api/types";
import { fmtCmS, fmtG, fmtKpa, fmtPct } from "@/lib/format";

interface ScenarioPickerProps {
  presets: readonly Preset[];
  cfg: CabinConfig;
  /** Selected preset id, or null for a custom scenario. */
  presetId: string | null;
  onPreset: (preset: Preset) => void;
  onChange: <K extends keyof CabinConfig>(field: K, value: CabinConfig[K]) => void;
}

/** The habitat scenario to rank against: a preset, optionally fine-tuned by hand. */
export function ScenarioPicker({ presets, cfg, presetId, onPreset, onChange }: ScenarioPickerProps) {
  return (
    <div className="space-y-4">
      <PresetPicker presets={presets} value={presetId} onSelect={onPreset} />
      <p className="font-mono text-[11px] text-muted">
        {fmtPct(cfg.oxygen_pct)} O₂ · {fmtKpa(cfg.pressure_kpa)} · {fmtCmS(cfg.flow_velocity_cm_s)} ·{" "}
        {fmtG(cfg.gravity_g)} · {cfg.fuel_material} · {cfg.diluent_gas}
      </p>
      <details className="group rounded-md border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
          Customise scenario
        </summary>
        <div className="border-t border-border p-3">
          <CabinControls cfg={cfg} onChange={onChange} />
        </div>
      </details>
    </div>
  );
}
