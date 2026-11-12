import type { DiluentGas, FuelMaterial } from "@/lib/api/types";
import type { FlameParams, FlowDirection, FuelGeometry } from "./flame-physics";

export const CANVAS_W = 640;
export const CANVAS_H = 480;

export type SceneId = "earth" | "moon" | "mars" | "iss" | "transit";

export interface Scenario {
  id: SceneId;
  label: string;
  gLabel: string;
  blurb: string;
  /** Atmosphere applied when the scenario is selected (mirrors contracts/mock_data/presets.json). */
  atmosphere: Pick<FlameParams, "oxygen_pct" | "pressure_kpa" | "flow_velocity_cm_s" | "gravity_g">;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "earth",
    label: "Earth",
    gLabel: "1 g",
    blurb:
      "1.0 g sea-level air. Strong buoyant convection draws a tall, flickering teardrop flame with a blue CH* base and luminous soot mantle.",
    atmosphere: { oxygen_pct: 21, pressure_kpa: 101.3, flow_velocity_cm_s: 0, gravity_g: 1 },
  },
  {
    id: "moon",
    label: "Moon",
    gLabel: "0.16 g",
    blurb:
      "0.16 g lunar gravity, Artemis atmosphere (34 % O₂, 56.5 kPa). Weak buoyancy sits near the peak-flammability oxygen transport regime.",
    atmosphere: { oxygen_pct: 34, pressure_kpa: 56.5, flow_velocity_cm_s: 5, gravity_g: 0.16 },
  },
  {
    id: "mars",
    label: "Mars",
    gLabel: "0.38 g",
    blurb: "0.38 g Martian gravity (26.5 % O₂, 70.3 kPa). Moderate buoyancy forms a broader, laminar flame sheet.",
    atmosphere: { oxygen_pct: 26.5, pressure_kpa: 70.3, flow_velocity_cm_s: 5, gravity_g: 0.38 },
  },
  {
    id: "iss",
    label: "ISS",
    gLabel: "µg",
    blurb:
      "Microgravity (~0 g, 21 % O₂, 101.3 kPa). Without buoyancy, combustion forms a spherical blue diffusion shell fed by radial transport.",
    atmosphere: { oxygen_pct: 21, pressure_kpa: 101.3, flow_velocity_cm_s: 10, gravity_g: 0 },
  },
  {
    id: "transit",
    label: "Transit",
    gLabel: "µg",
    blurb:
      "Deep-space microgravity coast (34 % O₂, 56.5 kPa). Enriched oxygen brightens and expands the microgravity diffusion shell.",
    atmosphere: { oxygen_pct: 34, pressure_kpa: 56.5, flow_velocity_cm_s: 10, gravity_g: 0 },
  },
];

export function getScenario(id: SceneId): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}

export const GRAVITY_PRESETS = [
  { value: "0", label: "0 g — microgravity" },
  { value: "0.16", label: "0.16 g — Moon" },
  { value: "0.38", label: "0.38 g — Mars" },
  { value: "1", label: "1 g — Earth" },
  { value: "2.53", label: "2.53 g — Jupiter" },
] as const;

export const GEOMETRY_OPTIONS = [
  "Droplet",
  "Gaseous",
  "Rod",
  "Flat Sheet",
] as const satisfies readonly FuelGeometry[];

export const FLOW_DIRECTIONS = [
  { value: "right", label: "Crossflow → (left to right)" },
  { value: "left", label: "Crossflow ← (right to left)" },
  { value: "up", label: "Upward (concurrent with buoyancy)" },
  { value: "down", label: "Downward (opposed to buoyancy)" },
] as const satisfies readonly { value: FlowDirection; label: string }[];

export const SPEED_OPTIONS = [
  { value: "0.25", label: "0.25× (slow motion)" },
  { value: "0.5", label: "0.5×" },
  { value: "1", label: "1× (real time)" },
  { value: "2", label: "2×" },
] as const;

export const FUEL_OPTIONS = [
  { value: "PMMA", label: "PMMA (acrylic)" },
  { value: "Cotton-Fiberglass", label: "Cotton-Fiberglass" },
  { value: "Nomex", label: "Nomex" },
  { value: "Heptane", label: "Heptane (liquid fuel)" },
  { value: "Methanol", label: "Methanol (liquid fuel)" },
] as const satisfies readonly { value: FuelMaterial; label: string }[];

export const DILUENT_OPTIONS = [
  { value: "N2", label: "N₂ (nitrogen)" },
  { value: "CO2", label: "CO₂ (carbon dioxide)" },
  { value: "He", label: "He (helium)" },
  { value: "Ar", label: "Ar (argon)" },
] as const satisfies readonly { value: DiluentGas; label: string }[];

/** ISS standard atmosphere at 1 g with a PMMA droplet in crossflow. */
export const DEFAULT_PARAMS: FlameParams = {
  oxygen_pct: 21.0,
  pressure_kpa: 101.3,
  flow_velocity_cm_s: 10.0,
  gravity_g: 1.0,
  fuel_material: "PMMA",
  diluent_gas: "N2",
  geometry: "Droplet",
  flowDirection: "right",
};
