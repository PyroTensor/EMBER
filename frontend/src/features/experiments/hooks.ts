"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { qk } from "@/lib/api/query-keys";
import type { ExperimentFilters, RankRequest } from "@/lib/api/types";
import { getExperiments, getTelemetry, rankExperiments } from "./api";

export const RANK_DEBOUNCE_MS = 150;

export function useExperiments(filters: ExperimentFilters = {}) {
  return useQuery({
    queryKey: qk.experiments(filters),
    queryFn: ({ signal }) => getExperiments(filters, signal),
  });
}

/**
 * Ranks runs for `req` (debounced so weight-slider drags don't flood the API). The previous ranking stays
 * visible while the next loads (`isPlaceholderData`). Keep `req` referentially stable.
 */
export function useRanking(req: RankRequest) {
  const debounced = useDebouncedValue(req, RANK_DEBOUNCE_MS);
  return useQuery({
    queryKey: qk.rank(debounced),
    queryFn: ({ signal }) => rankExperiments(debounced, signal),
    placeholderData: keepPreviousData,
  });
}

/** Telemetry for one run; idle until an id is given. Series are immutable, so they never go stale. */
export function useTelemetry(experimentId: string | null) {
  return useQuery({
    queryKey: qk.telemetry(experimentId ?? ""),
    queryFn: ({ signal }) => getTelemetry(experimentId as string, signal),
    enabled: experimentId !== null && experimentId !== "",
    staleTime: Infinity,
  });
}
