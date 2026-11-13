"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { env, type ApiMode } from "@/lib/config/env";

export const API_MODE_STORAGE_KEY = "ember_api_mode";

interface ApiModeValue {
  mode: ApiMode;
  /** False during SSR and hydration; true once the stored per-viewer choice has been read. */
  resolved: boolean;
  /** Persists the choice and reloads, which starts/stops the MSW worker and clears the query cache. */
  setMode: (mode: ApiMode) => void;
}

const ApiModeContext = createContext<ApiModeValue | null>(null);

function readStoredMode(): ApiMode | null {
  if (!env.allowModeToggle) return null;
  try {
    const v = window.localStorage.getItem(API_MODE_STORAGE_KEY);
    return v === "mock" || v === "live" ? v : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// Client snapshot: stored choice or env default. Server snapshot: null ("not resolved yet"), so the
// first client render matches the server and the stored mode is applied right after hydration.
const getSnapshot = (): ApiMode => readStoredMode() ?? env.defaultApiMode;
const getServerSnapshot = (): ApiMode | null => null;

export function ApiModeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore<ApiMode | null>(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback((next: ApiMode) => {
    try {
      window.localStorage.setItem(API_MODE_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private window etc.): the reload falls back to the env default.
    }
    window.location.reload();
  }, []);

  const value = useMemo<ApiModeValue>(
    () => ({ mode: snapshot ?? env.defaultApiMode, resolved: snapshot !== null, setMode }),
    [snapshot, setMode],
  );

  return <ApiModeContext.Provider value={value}>{children}</ApiModeContext.Provider>;
}

export function useApiMode(): ApiModeValue {
  const ctx = useContext(ApiModeContext);
  if (!ctx) throw new Error("useApiMode must be used inside <ApiModeProvider>");
  return ctx;
}
