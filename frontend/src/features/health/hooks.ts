"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/api/query-keys";
import { getHealth } from "./api";

export const HEALTH_REFETCH_MS = 30_000;

export function useHealth() {
  return useQuery({
    queryKey: qk.health(),
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: HEALTH_REFETCH_MS,
  });
}
