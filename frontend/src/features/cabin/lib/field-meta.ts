import type { CabinConfig, DiluentGas, FuelMaterial } from "@/lib/api/types";

export type NumericField = "oxygen_pct" | "pressure_kpa" | "flow_velocity_cm_s" | "gravity_g";

export interface FieldMeta {
  label: string;
  unit: string;
  /** Bounds from contracts/schema_v1.json (the backend validates the same range). */
  min: number;
  max: number;
  step: number;
  /** Decimals for display. */
  digits: number;
  hint?: string;
}

export const FIELD_META: Readonly<Record<NumericField, FieldMeta>> = {
  oxygen_pct: { label: "Oxygen concentration", unit: "%", min: 15, max: 40, step: 0.5, digits: 1, hint: "ISS: 21 % · Artemis: 34 %" },
  pressure_kpa: { label: "Cabin pressure", unit: "kPa", min: 40, max: 101.3, step: 0.1, digits: 1, hint: "Sea level: 101.3 kPa · Artemis: 56.5 kPa" },
  flow_velocity_cm_s: { label: "HVAC flow velocity", unit: "cm/s", min: 0, max: 50, step: 0.5, digits: 1, hint: "Forced ventilation past the fuel" },
  gravity_g: { label: "Gravity", unit: "g", min: 0, max: 1, step: 0.01, digits: 2, hint: "0 orbit · 0.16 Moon · 0.38 Mars · 1 Earth" },
};

/** Display order of the sliders. */
export const NUMERIC_FIELDS: readonly NumericField[] = ["oxygen_pct", "pressure_kpa", "flow_velocity_cm_s", "gravity_g"];

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const FUEL_MATERIAL_OPTIONS = [
  { value: "PMMA", label: "PMMA (acrylic)" },
  { value: "Cotton-Fiberglass", label: "Cotton-Fiberglass" },
  { value: "Nomex", label: "Nomex" },
  { value: "Heptane", label: "Heptane (liquid fuel)" },
  { value: "Methanol", label: "Methanol (liquid fuel)" },
] as const satisfies readonly Option<FuelMaterial>[];

export const DILUENT_GAS_OPTIONS = [
  { value: "N2", label: "N₂ (nitrogen)" },
  { value: "CO2", label: "CO₂ (carbon dioxide)" },
  { value: "He", label: "He (helium)" },
  { value: "Ar", label: "Ar (argon)" },
] as const satisfies readonly Option<DiluentGas>[];

// Compile-time guard: fails if the contract adds a material or diluent missing from the lists above.
type Missing<All, Listed> = Exclude<All, Listed> extends never ? true : Exclude<All, Listed>;
const allMaterialsListed: Missing<FuelMaterial, (typeof FUEL_MATERIAL_OPTIONS)[number]["value"]> = true;
const allDiluentsListed: Missing<DiluentGas, (typeof DILUENT_GAS_OPTIONS)[number]["value"]> = true;
void allMaterialsListed;
void allDiluentsListed;

/** Clamp a numeric field into its schema range (e.g. when applying a preset or typed input). */
export function clampField(field: NumericField, value: number): number {
  const { min, max } = FIELD_META[field];
  return Math.min(max, Math.max(min, value));
}

/** True when every numeric field of `cfg` is inside its schema range. */
export function isWithinBounds(cfg: CabinConfig): boolean {
  return NUMERIC_FIELDS.every((f) => cfg[f] >= FIELD_META[f].min && cfg[f] <= FIELD_META[f].max);
}
