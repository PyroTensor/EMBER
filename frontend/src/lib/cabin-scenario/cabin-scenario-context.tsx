"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CabinConfig, Preset } from "@/lib/api/types";
import { fmtCmS, fmtG, fmtKpa, fmtPct } from "@/lib/format";

const STORAGE_KEY = "ember:cabin-scenario:v1";

/** Default ISS Standard cabin configuration (matches the "iss" preset). */
export const DEFAULT_CABIN_CONFIG: Readonly<CabinConfig> = Object.freeze({
  oxygen_pct: 21,
  pressure_kpa: 101.3,
  flow_velocity_cm_s: 10,
  gravity_g: 0,
  fuel_material: "Cotton-Fiberglass",
  diluent_gas: "N2",
});

export const DEFAULT_PRESET_ID = "iss";
export const DEFAULT_PRESET_NAME = "ISS Standard";

export function presetToConfig(p: Preset): CabinConfig {
  return {
    oxygen_pct: p.oxygen_pct,
    pressure_kpa: p.pressure_kpa,
    flow_velocity_cm_s: p.flow_velocity_cm_s,
    gravity_g: p.gravity_g,
    fuel_material: p.fuel_material,
    diluent_gas: p.diluent_gas,
  };
}

export function formatCabinSummary(
  cfg: CabinConfig,
  label?: string | null,
): string {
  const prefix = label ? `${label}: ` : "";
  return (
    `${prefix}${fmtPct(cfg.oxygen_pct)} O₂, ${fmtKpa(cfg.pressure_kpa)}, ` +
    `${fmtCmS(cfg.flow_velocity_cm_s)}, ${fmtG(cfg.gravity_g)}, ` +
    `${cfg.fuel_material}, ${cfg.diluent_gas}`
  );
}

interface StoredScenario {
  config: CabinConfig;
  presetId: string | null;
  presetName: string;
}

interface CabinScenarioContextValue {
  config: CabinConfig;
  presetId: string | null;
  presetName: string;
  selectPreset: (preset: Preset, id: string) => void;
  updateField: <K extends keyof CabinConfig>(
    field: K,
    value: CabinConfig[K],
  ) => void;
  updateConfig: (
    patch: Partial<CabinConfig>,
    presetId?: string | null,
    presetName?: string,
  ) => void;
  resetToDefault: () => void;
}

const CabinScenarioContext = createContext<CabinScenarioContextValue | null>(
  null,
);

function readStored(): StoredScenario {
  if (typeof window === "undefined") {
    return {
      config: { ...DEFAULT_CABIN_CONFIG },
      presetId: DEFAULT_PRESET_ID,
      presetName: DEFAULT_PRESET_NAME,
    };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        config: { ...DEFAULT_CABIN_CONFIG },
        presetId: DEFAULT_PRESET_ID,
        presetName: DEFAULT_PRESET_NAME,
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredScenario>;
    if (parsed && parsed.config && typeof parsed.config.oxygen_pct === "number") {
      return {
        config: parsed.config,
        presetId:
          parsed.presetId === undefined ? DEFAULT_PRESET_ID : parsed.presetId,
        presetName: parsed.presetName || "Custom configuration",
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    config: { ...DEFAULT_CABIN_CONFIG },
    presetId: DEFAULT_PRESET_ID,
    presetName: DEFAULT_PRESET_NAME,
  };
}

export function CabinScenarioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<StoredScenario>(readStored);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage write errors
    }
  }, [state]);

  const selectPreset = useCallback((preset: Preset, id: string) => {
    setState({
      config: presetToConfig(preset),
      presetId: id,
      presetName: preset.name,
    });
  }, []);

  const updateField = useCallback(
    <K extends keyof CabinConfig>(field: K, value: CabinConfig[K]) => {
      setState((prev) => ({
        config: { ...prev.config, [field]: value },
        presetId: null,
        presetName: "Custom configuration",
      }));
    },
    [],
  );

  const updateConfig = useCallback(
    (
      patch: Partial<CabinConfig>,
      presetId: string | null = null,
      presetName = "Custom configuration",
    ) => {
      setState((prev) => ({
        config: { ...prev.config, ...patch },
        presetId,
        presetName,
      }));
    },
    [],
  );

  const resetToDefault = useCallback(() => {
    setState({
      config: { ...DEFAULT_CABIN_CONFIG },
      presetId: DEFAULT_PRESET_ID,
      presetName: DEFAULT_PRESET_NAME,
    });
  }, []);

  const value = useMemo<CabinScenarioContextValue>(
    () => ({
      config: state.config,
      presetId: state.presetId,
      presetName: state.presetName,
      selectPreset,
      updateField,
      updateConfig,
      resetToDefault,
    }),
    [state, selectPreset, updateField, updateConfig, resetToDefault],
  );

  return (
    <CabinScenarioContext.Provider value={value}>
      {children}
    </CabinScenarioContext.Provider>
  );
}

export function useCabinScenario(): CabinScenarioContextValue {
  const ctx = useContext(CabinScenarioContext);
  if (!ctx) {
    throw new Error(
      "useCabinScenario must be used within a CabinScenarioProvider",
    );
  }
  return ctx;
}
