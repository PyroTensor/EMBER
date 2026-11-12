"use client";

import { Select } from "@/components/ui/select";
import type { Preset } from "@/lib/api/types";

export const CUSTOM_PRESET = "custom";

interface PresetPickerProps {
  presets: readonly Preset[];
  /** Selected preset id, or null once the user has edited a field. */
  value: string | null;
  onSelect: (preset: Preset) => void;
}

const presetId = (p: Preset, i: number) => p.id ?? `preset-${i}`;

export function PresetPicker({ presets, value, onSelect }: PresetPickerProps) {
  const options = presets.map((p, i) => ({ value: presetId(p, i), label: p.name ?? presetId(p, i) }));
  const selected = value === null ? null : presets.find((p, i) => presetId(p, i) === value);

  return (
    <div className="space-y-2">
      <Select
        label="Scenario preset"
        value={value ?? CUSTOM_PRESET}
        options={value === null ? [{ value: CUSTOM_PRESET, label: "Custom configuration" }, ...options] : options}
        onChange={(id) => {
          const index = presets.findIndex((p, i) => presetId(p, i) === id);
          const preset = presets[index];
          if (preset) onSelect(preset);
        }}
      />
      <p className="min-h-8 text-xs text-muted">
        {selected?.description ?? "Edited by hand. Pick a preset to reset all fields."}
      </p>
    </div>
  );
}

export { presetId };
