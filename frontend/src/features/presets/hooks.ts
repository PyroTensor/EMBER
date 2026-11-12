"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/api/query-keys";
import { getPresets } from "./api";

/** Presets are static reference data: fetched once per page load. */
export function usePresets() {
  return useQuery({
    queryKey: qk.presets(),
    queryFn: ({ signal }) => getPresets(signal),
    staleTime: Infinity,
  });
}
