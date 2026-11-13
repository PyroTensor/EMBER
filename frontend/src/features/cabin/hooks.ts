"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { qk } from "@/lib/api/query-keys";
import type { CabinConfig } from "@/lib/api/types";
import { evaluateCabin } from "./api";

export const CABIN_DEBOUNCE_MS = 150;

/**
 * Evaluates `cfg` (debounced 150 ms, so slider drags don't flood the API). The previous result stays
 * visible while the next one loads (`isPlaceholderData` is true meanwhile). Keep `cfg` referentially stable.
 */
export function useCabinEvaluation(cfg: CabinConfig) {
  const debounced = useDebouncedValue(cfg, CABIN_DEBOUNCE_MS);
  return useQuery({
    queryKey: qk.cabin(debounced),
    queryFn: ({ signal }) => evaluateCabin(debounced, signal),
    placeholderData: keepPreviousData,
  });
}
