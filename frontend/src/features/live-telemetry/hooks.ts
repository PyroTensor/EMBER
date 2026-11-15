"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { qk } from "@/lib/api/query-keys";
import type { LiveTelemetryIngestRequest } from "@/lib/api/types";
import {
  getLiveTelemetry,
  ingestLiveTelemetry,
  resetLiveTelemetry,
} from "./api";

export function useLiveTelemetry(refetchIntervalMs: number | false) {
  return useQuery({
    queryKey: qk.liveTelemetry(),
    queryFn: ({ signal }) => getLiveTelemetry(signal),
    refetchInterval: refetchIntervalMs,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
}

export function useIngestLiveTelemetry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LiveTelemetryIngestRequest) =>
      ingestLiveTelemetry(payload),
    onSuccess: (nextState) => {
      queryClient.setQueryData(qk.liveTelemetry(), nextState);
    },
  });
}

export function useResetLiveTelemetry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetLiveTelemetry(),
    onSuccess: (nextState) => {
      queryClient.setQueryData(qk.liveTelemetry(), nextState);
    },
  });
}
