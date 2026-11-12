"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import presetsJson from "../mock/presets.json";
import experimentsJson from "../mock/experiments_proxy.json";
import telemetryJson from "../mock/telemetry_proxy.json";
import {
  DEFAULT_WEIGHTS,
  evaluateCabin as mockEvaluateCabin,
  mockAsk,
  rankRuns,
} from "./mock-engine";
import type {
  AskRequest,
  AskResponse,
  CabinConfig,
  CabinEvaluation,
  Health,
  Preset,
  RankRequest,
  RankResponse,
  RankWeights,
  Telemetry,
  TestRun,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const MOCK_STORAGE_KEY = "ember_use_mock_data";
export const ENV_DEFAULT_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

const mockPresets = presetsJson as Preset[];
const mockExperiments = experimentsJson as TestRun[];
const mockTelemetryList = telemetryJson as Telemetry[];
const mockTelemetryMap = new Map<string, Telemetry>(
  mockTelemetryList.map((t) => [t.experiment_id, t]),
);

function computeMockHealth(): Health {
  const keySet = new Set<string>();
  for (const run of mockExperiments) {
    for (const k of Object.keys(run.extra_telemetry ?? {})) {
      keySet.add(k);
    }
  }
  return {
    status: "ok",
    db: true,
    test_runs: mockExperiments.length,
    chunks: 10,
    llm_provider: "mock-offline",
    schema_version: "v1",
    extra_telemetry_keys: Array.from(keySet).sort(),
  };
}

/** Read current mock mode preference (localStorage overrides build-time env var). */
export function isMockModeEnabled(): boolean {
  if (typeof window === "undefined") {
    return ENV_DEFAULT_MOCK;
  }
  try {
    const stored = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // ignore storage access errors
  }
  return ENV_DEFAULT_MOCK;
}

type OfflineListener = (err: string | null) => void;
const offlineListeners = new Set<OfflineListener>();

function notifyOfflineStatus(err: string | null) {
  offlineListeners.forEach((fn) => fn(err));
}

async function apiFetch<T>(
  path: string,
  init: RequestInit | undefined,
  mockFallback: () => T,
): Promise<T> {
  if (isMockModeEnabled()) {
    return mockFallback();
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as T;
    notifyOfflineStatus(null);
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backend unreachable";
    notifyOfflineStatus(msg);
    // Return mock fallback so the UI stays interactive while surfacing OFFLINE status
    return mockFallback();
  }
}

// ---------- Typed OpenAPI v1 Client Functions ----------

export async function getHealth(): Promise<Health> {
  return apiFetch<Health>("/api/health", { method: "GET" }, computeMockHealth);
}

export async function getPresets(): Promise<Preset[]> {
  return apiFetch<Preset[]>("/api/presets", { method: "GET" }, () => mockPresets);
}

export async function evaluateCabin(config: CabinConfig): Promise<CabinEvaluation> {
  return apiFetch<CabinEvaluation>(
    "/api/evaluate-cabin",
    {
      method: "POST",
      body: JSON.stringify(config),
    },
    () => mockEvaluateCabin(config),
  );
}

export async function getExperiments(): Promise<TestRun[]> {
  return apiFetch<TestRun[]>("/api/experiments", { method: "GET" }, () => mockExperiments);
}

export async function rankExperiments(req: RankRequest): Promise<RankResponse> {
  return apiFetch<RankResponse>(
    "/api/experiments/rank",
    {
      method: "POST",
      body: JSON.stringify(req),
    },
    () => {
      const weights: RankWeights = { ...DEFAULT_WEIGHTS, ...(req.weights ?? {}) };
      const results = rankRuns(mockExperiments, req.config, weights, req.limit ?? 10);
      return { weights, results };
    },
  );
}

export async function getTelemetry(experimentId: string): Promise<Telemetry> {
  return apiFetch<Telemetry>(
    `/api/telemetry/${encodeURIComponent(experimentId)}`,
    { method: "GET" },
    () => {
      const found = mockTelemetryMap.get(experimentId);
      if (found) return found;
      return {
        experiment_id: experimentId,
        time_s: [0, 1, 2, 3, 4, 5],
        flame_radius_mm: [0, 0, 0, 0, 0, 0],
        d_squared_mm2: null,
        radiative_heat_flux_kw_m2: [0, 0, 0, 0, 0, 0],
        flame_temp_k: [300, 300, 300, 300, 300, 300],
      };
    },
  );
}

export async function askCopilot(req: AskRequest): Promise<AskResponse> {
  return apiFetch<AskResponse>(
    "/api/copilot/ask",
    {
      method: "POST",
      body: JSON.stringify(req),
    },
    () => mockAsk(req, mockExperiments),
  );
}

// ---------- React Context & Hook: useDataMode ----------

export type BackendConnectionState = "LIVE" | "MOCK" | "OFFLINE";

export interface DataModeContextValue {
  useMock: boolean;
  setUseMock: (mock: boolean) => void;
  toggleDataMode: () => void;
  connectionState: BackendConnectionState;
  health: Health | null;
  offlineError: string | null;
  refreshHealth: () => Promise<void>;
  apiBaseUrl: string;
}

const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [useMock, setUseMockState] = useState<boolean>(ENV_DEFAULT_MOCK);
  const [health, setHealth] = useState<Health | null>(() => computeMockHealth());
  const [offlineError, setOfflineError] = useState<string | null>(null);

  useEffect(() => {
    const listener: OfflineListener = (err) => {
      setOfflineError(err);
    };
    offlineListeners.add(listener);
    return () => {
      offlineListeners.delete(listener);
    };
  }, []);

  const refreshHealth = useCallback(async () => {
    await Promise.resolve();
    const currentMock = isMockModeEnabled();
    setUseMockState(currentMock);
    if (currentMock) {
      setOfflineError(null);
      setHealth(computeMockHealth());
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, { method: "GET" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Health;
      setHealth(data);
      setOfflineError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect to backend";
      setOfflineError(msg);
      setHealth(computeMockHealth());
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void refreshHealth();
      }
    });
    return () => {
      active = false;
    };
  }, [useMock, refreshHealth]);

  const setUseMock = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(MOCK_STORAGE_KEY, String(next));
    } catch {
      // ignore storage errors
    }
    setUseMockState(next);
    if (next) {
      setOfflineError(null);
      setHealth(computeMockHealth());
    }
  }, []);

  const toggleDataMode = useCallback(() => {
    setUseMock(!isMockModeEnabled());
  }, [setUseMock]);

  const connectionState: BackendConnectionState = useMemo(() => {
    if (useMock) return "MOCK";
    if (offlineError) return "OFFLINE";
    return "LIVE";
  }, [useMock, offlineError]);

  const value = useMemo<DataModeContextValue>(
    () => ({
      useMock,
      setUseMock,
      toggleDataMode,
      connectionState,
      health,
      offlineError,
      refreshHealth,
      apiBaseUrl: API_BASE_URL,
    }),
    [useMock, setUseMock, toggleDataMode, connectionState, health, offlineError, refreshHealth],
  );

  return React.createElement(DataModeContext.Provider, { value }, children);
}

export function useDataMode(): DataModeContextValue {
  const ctx = useContext(DataModeContext);
  if (!ctx) {
    throw new Error("useDataMode must be used within a DataModeProvider");
  }
  return ctx;
}
