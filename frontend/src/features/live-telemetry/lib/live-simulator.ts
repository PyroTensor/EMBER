import type { BadgeTone } from "@/components/ui/badge";
import type {
  CabinConfig,
  CombustionRegime,
  DiluentGas,
  FuelMaterial,
  LiveStreamStatus,
  LiveTelemetryIngestRequest,
} from "@/lib/api/types";

export const STREAM_STATUS_META: Readonly<
  Record<LiveStreamStatus, { label: string; tone: BadgeTone }>
> = {
  idle: { label: "Idle", tone: "neutral" },
  streaming: { label: "Streaming", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  completed: { label: "Completed", tone: "info" },
};

export type BrowserSimScenarioId =
  | "eva-prebreathe"
  | "ventilation-paradox"
  | "sofie-ramp"
  | "apollo-incident"
  | "cool-flame-drop"
  | "custom";

export interface BrowserSimScenarioMeta {
  id: BrowserSimScenarioId;
  label: string;
  experimentName: string;
  description: string;
  defaultSteps: number;
}

export const BROWSER_SIM_SCENARIOS = [
  {
    id: "eva-prebreathe",
    label: "Artemis EVA Pre-Breathe Depressurization",
    experimentName: "Artemis EVA Airlock Pre-Breathe Transient",
    description:
      "Transitions from ISS 21% O₂ @ 101.3 kPa to the 34% O₂ @ 56.5 kPa exploration mix, triggers a 37.5% O₂ excursion, and repressurizes with N₂.",
    defaultSteps: 45,
  },
  {
    id: "ventilation-paradox",
    label: "Microgravity HVAC Ventilation Sweep",
    experimentName: "Microgravity HVAC Ventilation Paradox Sweep",
    description:
      "Sweeps HVAC flow velocity from 0 to 50 cm/s at 0 g, passing through the 8 cm/s ventilation-paradox minimum LOI and into convective blow-off.",
    defaultSteps: 45,
  },
  {
    id: "sofie-ramp",
    label: "SoFIE PMMA Oxygen & Pressure Ramp",
    experimentName: "SoFIE PMMA Oxygen Ramp (ISS MSG)",
    description:
      "Simulates PMMA ignition and sustained microgravity burning across an O₂ enrichment and pressure ramp followed by N₂ purge.",
    defaultSteps: 45,
  },
  {
    id: "apollo-incident",
    label: "Enriched O₂ Excursion & CO₂ Suppression",
    experimentName: "High-O2 Overpressure & CO2 Suppression Test",
    description:
      "Ramps Nomex chamber oxygen to a critical 38% excursion, then deploys a CO₂ inerting flood (+3% LOI shift) and purge.",
    defaultSteps: 45,
  },
  {
    id: "cool-flame-drop",
    label: "FLEX Heptane Droplet & Cool-Flame Regime",
    experimentName: "FLEX Heptane Droplet & Cool-Flame Regime",
    description:
      "Drops a burning Heptane droplet from 1 g to 0 g into a low-flow two-stage radiative cool flame before oxygen-depletion extinction.",
    defaultSteps: 45,
  },
  {
    id: "custom",
    label: "Interactive Cabin Rig (Live Manual Tuning)",
    experimentName: "Interactive Cabin Rig Stream",
    description:
      "Streams your live hand-tuned Cabin Configuration (presets & sliders) directly into the telemetry pipeline with transducer jitter.",
    defaultSteps: 45,
  },
] as const satisfies readonly BrowserSimScenarioMeta[];

export function getScenarioMeta(
  id: BrowserSimScenarioId,
): BrowserSimScenarioMeta {
  return (
    BROWSER_SIM_SCENARIOS.find((s) => s.id === id) ?? BROWSER_SIM_SCENARIOS[0]
  );
}

export const SCENARIO_OPTIONS = BROWSER_SIM_SCENARIOS.map((s) => ({
  value: s.id,
  label: s.label,
}));

// Keep local LOI/regime calculation consistent with backend/app/domain/physics/combustion.py
const P0_KPA = 101.3;
const DEFAULT_BASE_LOI = 18.0;
const MATERIAL_BASE_LOI: Readonly<Record<string, number>> = {
  PMMA: 17.5,
  "Cotton-Fiberglass": 18.5,
  Nomex: 27.0,
  Heptane: 13.5,
  Methanol: 15.5,
};
const DILUENT_SHIFT: Readonly<Record<string, number>> = {
  N2: 0.0,
  CO2: 3.0,
  He: 2.0,
  Ar: -1.0,
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function estimateLoi(cfg: CabinConfig): number {
  const uBuoyant =
    30.0 * Math.sqrt((Math.max(cfg.gravity_g, 0) * Math.max(cfg.pressure_kpa, 0)) / P0_KPA);
  const uEff = Math.sqrt(cfg.flow_velocity_cm_s ** 2 + uBuoyant ** 2);
  const flowShift =
    3.0 * Math.exp(-uEff / 3.0) -
    1.5 * Math.exp(-(((uEff - 8.0) / 6.0) ** 2)) +
    0.05 * Math.max(0, uEff - 30.0);
  const pressureShift = 4.0 * (1.0 - cfg.pressure_kpa / P0_KPA);
  const base = MATERIAL_BASE_LOI[cfg.fuel_material] ?? DEFAULT_BASE_LOI;
  return base + flowShift + pressureShift + (DILUENT_SHIFT[cfg.diluent_gas] ?? 0);
}

function predictRegime(material: string, gravityG: number, margin: number): CombustionRegime {
  if (margin < -2.0) return "No Ignition";
  if (margin < 0.0) return "Self-Extinguished";
  if (material === "Heptane" && gravityG < 0.05 && margin < 9.0) return "Cool Flame";
  return "Sustained Burn";
}

/** Deterministic pseudo-noise in [-1, 1] so simulated frames stay reproducible and React-pure. */
function jitter(step: number, salt: number): number {
  const x = Math.sin((step + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

interface TrajectoryPoint {
  phase: string;
  event: string | null;
  config: CabinConfig;
}

function generatePoint(
  scenarioId: BrowserSimScenarioId,
  stepIndex: number,
  totalSteps: number,
  customConfig: CabinConfig,
): TrajectoryPoint {
  const u = stepIndex / Math.max(1, totalSteps - 1);

  if (scenarioId === "custom") {
    return {
      phase: `Custom Cabin (${customConfig.fuel_material} · ${customConfig.diluent_gas})`,
      event:
        stepIndex === 0
          ? `Interactive stream started (${customConfig.oxygen_pct.toFixed(1)}% O₂, ${customConfig.pressure_kpa.toFixed(1)} kPa)`
          : null,
      config: { ...customConfig },
    };
  }

  if (scenarioId === "eva-prebreathe") {
    const fuel_material: FuelMaterial = "Cotton-Fiberglass";
    const diluent_gas: DiluentGas = "N2";
    if (u < 0.2) {
      const p = u / 0.2;
      return {
        phase: "ISS Standard Baseline",
        event: stepIndex === 0 ? "Baseline ECLSS telemetry lock" : null,
        config: {
          oxygen_pct: lerp(21.0, 22.0, p),
          pressure_kpa: lerp(101.3, 96.0, p),
          flow_velocity_cm_s: lerp(10.0, 11.0, p),
          gravity_g: 0.0,
          fuel_material,
          diluent_gas,
        },
      };
    }
    if (u < 0.55) {
      const p = (u - 0.2) / 0.35;
      return {
        phase: "Airlock Depressurization",
        event:
          Math.abs(u - 0.2) < 1 / Math.max(1, totalSteps)
            ? "Cabin depressurization toward 56.5 kPa exploration mix"
            : null,
        config: {
          oxygen_pct: lerp(22.0, 34.0, p),
          pressure_kpa: lerp(96.0, 56.5, p),
          flow_velocity_cm_s: lerp(11.0, 15.0, p),
          gravity_g: 0.0,
          fuel_material,
          diluent_gas,
        },
      };
    }
    if (u < 0.8) {
      const p = (u - 0.55) / 0.25;
      return {
        phase: "Artemis 34% O₂ Peak Hold",
        event:
          stepIndex === Math.floor(0.62 * totalSteps)
            ? "O₂ spike to 37.5% — oxygen margin alert threshold"
            : null,
        config: {
          oxygen_pct: 34.0 + 3.5 * Math.sin(p * Math.PI),
          pressure_kpa: 56.5,
          flow_velocity_cm_s: lerp(15.0, 9.0, p),
          gravity_g: 0.0,
          fuel_material,
          diluent_gas,
        },
      };
    }
    const p = (u - 0.8) / 0.2;
    return {
      phase: "N₂ Repressurization",
      event:
        stepIndex === Math.floor(0.8 * totalSteps)
          ? "N₂ makeup valves opened — returning to nominal"
          : null,
      config: {
        oxygen_pct: lerp(34.0, 21.0, p),
        pressure_kpa: lerp(56.5, 101.3, p),
        flow_velocity_cm_s: lerp(9.0, 10.0, p),
        gravity_g: 0.0,
        fuel_material,
        diluent_gas,
      },
    };
  }

  if (scenarioId === "ventilation-paradox") {
    const flow = 50.0 * u;
    let phase = "High-Flow Blow-Off Cooling";
    let event: string | null =
      stepIndex === Math.floor(0.72 * totalSteps)
        ? "Convective blow-off raises effective LOI"
        : null;
    if (flow < 4.0) {
      phase = "Quiescent Microgravity (O₂ Starved)";
      event = stepIndex === 0 ? "Zero-flow radiative heat-loss regime" : null;
    } else if (flow < 15.0) {
      phase = "Ventilation Paradox Zone (Peak Spread)";
      event =
        stepIndex === Math.floor(0.12 * totalSteps)
          ? "HVAC flow enters 8 cm/s ventilation paradox minimum LOI"
          : null;
    } else if (flow < 32.0) {
      phase = "Moderate Forced Convection";
      event =
        stepIndex === Math.floor(0.4 * totalSteps)
          ? "Flow passing peak flame intensity band"
          : null;
    }
    return {
      phase,
      event,
      config: {
        oxygen_pct: 24.0,
        pressure_kpa: 101.3,
        flow_velocity_cm_s: flow,
        gravity_g: 0.0,
        fuel_material: "Cotton-Fiberglass",
        diluent_gas: "N2",
      },
    };
  }

  if (scenarioId === "apollo-incident") {
    const diluent_gas: DiluentGas = u < 0.65 ? "N2" : "CO2";
    if (u < 0.35) {
      const p = u / 0.35;
      return {
        phase: "O₂ Enrichment Build",
        event:
          stepIndex === Math.floor(0.2 * totalSteps)
            ? "Chamber oxygen enriching past 30%"
            : null,
        config: {
          oxygen_pct: lerp(24.0, 38.0, p),
          pressure_kpa: lerp(80.0, 101.3, p),
          flow_velocity_cm_s: 12.0,
          gravity_g: 0.0,
          fuel_material: "Nomex",
          diluent_gas,
        },
      };
    }
    if (u < 0.65) {
      return {
        phase: "Critical Over-Oxygenated Hold",
        event:
          stepIndex === Math.floor(0.4 * totalSteps)
            ? "Ignitor pulse — sustained burn risk critical"
            : null,
        config: {
          oxygen_pct: 38.0,
          pressure_kpa: 101.3,
          flow_velocity_cm_s: 14.0,
          gravity_g: 0.0,
          fuel_material: "Nomex",
          diluent_gas,
        },
      };
    }
    const p = (u - 0.65) / 0.35;
    return {
      phase: "CO₂ Inerting Suppression",
      event:
        stepIndex === Math.floor(0.65 * totalSteps)
          ? "CO₂ suppression flood active (+3% LOI shift)"
          : null,
      config: {
        oxygen_pct: lerp(38.0, 19.0, p),
        pressure_kpa: 101.3,
        flow_velocity_cm_s: lerp(14.0, 28.0, p),
        gravity_g: 0.0,
        fuel_material: "Nomex",
        diluent_gas,
      },
    };
  }

  if (scenarioId === "cool-flame-drop") {
    if (u < 0.25) {
      const p = u / 0.25;
      return {
        phase: "Droplet Ignition & 1g → 0g Transition",
        event:
          stepIndex === 0
            ? "Heptane droplet ignited — transitioning to microgravity"
            : null,
        config: {
          oxygen_pct: lerp(24.5, 21.5, p),
          pressure_kpa: 101.3,
          flow_velocity_cm_s: lerp(6.0, 2.0, p),
          gravity_g: lerp(1.0, 0.0, p),
          fuel_material: "Heptane",
          diluent_gas: "N2",
        },
      };
    }
    if (u < 0.68) {
      const p = (u - 0.25) / 0.43;
      return {
        phase: "Two-Stage Radiative Cool Flame",
        event:
          stepIndex === Math.floor(0.28 * totalSteps)
            ? "Hot flame extinguished radiatively — low-T cool flame sustained"
            : null,
        config: {
          oxygen_pct: lerp(21.5, 17.0, p),
          pressure_kpa: lerp(101.3, 82.0, p),
          flow_velocity_cm_s: lerp(2.0, 1.0, p),
          gravity_g: 0.0,
          fuel_material: "Heptane",
          diluent_gas: "N2",
        },
      };
    }
    const p = (u - 0.68) / 0.32;
    return {
      phase: "Cool-Flame Extinction",
      event:
        stepIndex === Math.floor(0.7 * totalSteps)
          ? "Oxygen depleted below cool-flame limit — droplet extinguished"
          : null,
      config: {
        oxygen_pct: lerp(17.0, 10.5, p),
        pressure_kpa: lerp(82.0, 101.3, p),
        flow_velocity_cm_s: lerp(1.0, 5.0, p),
        gravity_g: 0.0,
        fuel_material: "Heptane",
        diluent_gas: "N2",
      },
    };
  }

  // sofie-ramp
  if (u < 0.18) {
    const p = u / 0.18;
    return {
      phase: "Pre-Ignition Conditioning",
      event: stepIndex === 0 ? "SoFIE flow tunnel stabilized at 0 g" : null,
      config: {
        oxygen_pct: lerp(21.0, 23.0, p),
        pressure_kpa: lerp(101.3, 85.0, p),
        flow_velocity_cm_s: lerp(10.0, 9.0, p),
        gravity_g: 0.0,
        fuel_material: "PMMA",
        diluent_gas: "N2",
      },
    };
  }
  if (u < 0.48) {
    const p = (u - 0.18) / 0.3;
    return {
      phase: "O₂ Enrichment & Ignition",
      event:
        stepIndex === Math.floor(0.32 * totalSteps)
          ? "Hot-wire ignitor energized — flame spread onset"
          : null,
      config: {
        oxygen_pct: lerp(23.0, 35.0, p),
        pressure_kpa: lerp(85.0, 70.3, p),
        flow_velocity_cm_s: lerp(9.0, 12.0, p),
        gravity_g: 0.0,
        fuel_material: "PMMA",
        diluent_gas: "N2",
      },
    };
  }
  if (u < 0.75) {
    const p = (u - 0.48) / 0.27;
    return {
      phase: "Sustained Microgravity Burn",
      event:
        stepIndex === Math.floor(0.62 * totalSteps)
          ? "Peak radiative heat flux recorded"
          : null,
      config: {
        oxygen_pct: 35.0 + 1.5 * Math.sin(p * Math.PI),
        pressure_kpa: 70.3,
        flow_velocity_cm_s: lerp(12.0, 8.5, p),
        gravity_g: 0.0,
        fuel_material: "PMMA",
        diluent_gas: "N2",
      },
    };
  }
  const p = (u - 0.75) / 0.25;
  return {
    phase: "N₂ Purge & Extinction",
    event:
      stepIndex === Math.floor(0.76 * totalSteps)
        ? "N₂ purge initiated — quenching flame front"
        : null,
    config: {
      oxygen_pct: lerp(35.0, 16.5, p),
      pressure_kpa: lerp(70.3, 101.3, p),
      flow_velocity_cm_s: lerp(8.5, 22.0, p),
      gravity_g: 0.0,
      fuel_material: "PMMA",
      diluent_gas: "N2",
    },
  };
}

export interface BrowserFrameOptions {
  intervalMs?: number;
  loop?: boolean;
  reset?: boolean;
  elapsedTimeS?: number;
}

export function buildBrowserSimulationFrame(
  scenarioId: BrowserSimScenarioId,
  stepIndex: number,
  totalSteps: number,
  customConfig: CabinConfig,
  options: BrowserFrameOptions = {},
): LiveTelemetryIngestRequest {
  const {
    intervalMs = 1000,
    loop = false,
    reset = stepIndex === 0,
    elapsedTimeS,
  } = options;
  const meta = getScenarioMeta(scenarioId);
  const point = generatePoint(scenarioId, stepIndex, totalSteps, customConfig);
  const cfg: CabinConfig = {
    oxygen_pct: Number(clamp(point.config.oxygen_pct, 10, 60).toFixed(2)),
    pressure_kpa: Number(clamp(point.config.pressure_kpa, 20, 150).toFixed(2)),
    flow_velocity_cm_s: Number(clamp(point.config.flow_velocity_cm_s, 0, 50).toFixed(2)),
    gravity_g: Number(clamp(point.config.gravity_g, 0, 1).toFixed(3)),
    fuel_material: point.config.fuel_material,
    diluent_gas: point.config.diluent_gas,
  };

  const loi = estimateLoi(cfg);
  const margin = cfg.oxygen_pct - loi;
  const regime = predictRegime(cfg.fuel_material, cfg.gravity_g, margin);
  const burning = margin >= 0;

  let flameTempK: number;
  let radFlux: number;
  let flameRadius: number;

  if (regime === "Cool Flame") {
    flameTempK = Number(
      Math.max(295, 680 + 22 * margin + jitter(stepIndex, 5) * 12).toFixed(1),
    );
    radFlux = Number(
      Math.max(0.05, 0.45 + 0.12 * margin + jitter(stepIndex, 6) * 0.06).toFixed(2),
    );
    flameRadius = Number(
      Math.max(
        1,
        4.2 + 0.5 * margin + 0.8 * Math.sin(stepIndex * 0.25) + jitter(stepIndex, 7) * 0.2,
      ).toFixed(2),
    );
  } else if (burning) {
    flameTempK = Number(
      Math.max(295, 1250 + 58 * margin + jitter(stepIndex, 5) * 16).toFixed(1),
    );
    radFlux = Number(
      Math.max(0, 1.6 + 0.65 * margin + jitter(stepIndex, 6) * 0.18).toFixed(2),
    );
    flameRadius = Number(
      Math.max(
        0,
        8.0 + 1.4 * margin + 2.5 * Math.sin(stepIndex * 0.25) + jitter(stepIndex, 7) * 0.35,
      ).toFixed(2),
    );
  } else {
    flameTempK = Number(
      (296 + Math.max(0, margin + 2.0) * 85 + Math.abs(jitter(stepIndex, 5)) * 2.5).toFixed(1),
    );
    radFlux = Number(Math.max(0, 0.08 + jitter(stepIndex, 6) * 0.03).toFixed(2));
    flameRadius = 0;
  }

  const isLast =
    scenarioId !== "custom" && stepIndex >= totalSteps - 1 && !loop;
  const timestampS =
    elapsedTimeS !== undefined
      ? Number(Math.max(0, elapsedTimeS).toFixed(2))
      : Number(((stepIndex * intervalMs) / 1000).toFixed(2));

  return {
    session_id: `browser-sim-${scenarioId}`,
    experiment_name: meta.experimentName,
    phase: point.phase,
    event: point.event ?? (isLast ? "Simulation run completed" : null),
    status: isLast ? "completed" : "streaming",
    timestamp_s: timestampS,
    reset,
    config: cfg,
    raw_sensors: {
      oxygen_pct_raw: Number(
        clamp(cfg.oxygen_pct + jitter(stepIndex, 1) * 0.18, 10, 60).toFixed(3),
      ),
      pressure_kpa_raw: Number(
        clamp(cfg.pressure_kpa + jitter(stepIndex, 2) * 0.25, 20, 150).toFixed(3),
      ),
      flow_velocity_cm_s_raw: Number(
        clamp(cfg.flow_velocity_cm_s + jitter(stepIndex, 3) * 0.35, 0, 50).toFixed(3),
      ),
      gravity_g_raw: Number(
        clamp(cfg.gravity_g + Math.abs(jitter(stepIndex, 4)) * 0.002, 0, 1).toFixed(4),
      ),
      flame_temp_k: flameTempK,
      radiative_heat_flux_kw_m2: radFlux,
      flame_radius_mm: flameRadius,
    },
  };
}
