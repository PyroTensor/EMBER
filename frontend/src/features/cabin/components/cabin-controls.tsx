"use client";

import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { CabinConfig, DiluentGas, FuelMaterial } from "@/lib/api/types";
import {
  DILUENT_GAS_OPTIONS,
  FIELD_META,
  FUEL_MATERIAL_OPTIONS,
  NUMERIC_FIELDS,
  type NumericField,
} from "../lib/field-meta";

interface CabinControlsProps {
  cfg: CabinConfig;
  onChange: <K extends keyof CabinConfig>(field: K, value: CabinConfig[K]) => void;
}

/** Sliders for the 4 numeric fields and selects for material / diluent, all driven by field-meta. */
export function CabinControls({ cfg, onChange }: CabinControlsProps) {
  return (
    <div className="space-y-5">
      {NUMERIC_FIELDS.map((field: NumericField) => {
        const meta = FIELD_META[field];
        return (
          <Slider
            key={field}
            label={meta.label}
            value={cfg[field]}
            min={meta.min}
            max={meta.max}
            step={meta.step}
            unit={meta.unit}
            hint={meta.hint}
            format={(v) => v.toFixed(meta.digits)}
            onChange={(v) => onChange(field, v)}
          />
        );
      })}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Select<FuelMaterial>
          label="Fuel material"
          value={cfg.fuel_material as FuelMaterial}
          options={FUEL_MATERIAL_OPTIONS}
          onChange={(v) => onChange("fuel_material", v)}
        />
        <Select<DiluentGas>
          label="Diluent gas"
          value={cfg.diluent_gas as DiluentGas}
          options={DILUENT_GAS_OPTIONS}
          onChange={(v) => onChange("diluent_gas", v)}
        />
      </div>
    </div>
  );
}
