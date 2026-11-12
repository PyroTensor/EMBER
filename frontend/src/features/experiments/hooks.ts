"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/api/query-keys";
import type { ExperimentFilters } from "@/lib/api/types";
import { getExperiments } from "./api";

export function useExperiments(filters: ExperimentFilters = {}) {
  return useQuery({
    queryKey: qk.experiments(filters),
    queryFn: ({ signal }) => getExperiments(filters, signal),
  });
}
