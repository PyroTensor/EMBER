/**
 * Minimal, distraction-free scenario presets and fuel anchor geometry for the Flame Digital Twin.
 *
 * Pure black (#000000) background with zero background room clutter.
 */

export const CANVAS_W = 640;
export const CANVAS_H = 480;

export type SceneId = "earth" | "moon" | "mars" | "iss" | "transit";

export interface Scenario {
  id: SceneId;
  label: string;
  gLabel: string;
  blurb: string;
  /** Atmosphere applied when the scenario is selected (mirrors contracts/mock_data/presets.json). */
  atmosphere: {
    oxygen_pct: number;
    pressure_kpa: number;
    flow_velocity_cm_s: number;
    gravity_g: number;
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "earth",
    label: "Earth",
    gLabel: "1 g",
    blurb: "1.0 g sea-level air. Strong buoyant convection draws a tall, flickering teardrop flame with a blue CH* base and luminous soot mantle.",
    atmosphere: { oxygen_pct: 21, pressure_kpa: 101.3, flow_velocity_cm_s: 0, gravity_g: 1 },
  },
  {
    id: "moon",
    label: "Moon",
    gLabel: "0.16 g",
    blurb: "0.16 g lunar gravity, Artemis atmosphere (34 % O₂, 56.5 kPa). Weak buoyancy sits near the peak-flammability oxygen transport regime.",
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
    blurb: "Microgravity (~0 g, 21 % O₂, 101.3 kPa). Without buoyancy, combustion forms a spherical blue diffusion shell fed by radial transport.",
    atmosphere: { oxygen_pct: 21, pressure_kpa: 101.3, flow_velocity_cm_s: 10, gravity_g: 0 },
  },
  {
    id: "transit",
    label: "Transit cabin",
    gLabel: "µg",
    blurb: "Deep-space microgravity coast (34 % O₂, 56.5 kPa). Enriched oxygen brightens and expands the microgravity diffusion shell.",
    atmosphere: { oxygen_pct: 34, pressure_kpa: 56.5, flow_velocity_cm_s: 10, gravity_g: 0 },
  },
];

export function getScenario(id: SceneId): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
