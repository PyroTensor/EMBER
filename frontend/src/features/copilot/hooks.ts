"use client";

import { useMutation } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/errors";
import type { AskRequest } from "@/lib/api/types";
import { askCopilot } from "./api";

/**
 * Ask the Co-Pilot. A mutation (not a query): every question is a new request and the thread history lives in
 * the view. Retries once on a connection failure only; a TIMEOUT is not retried (it already waited 35 s).
 */
export function useAskCopilot() {
  return useMutation({
    mutationKey: ["api", "copilot", "ask"],
    mutationFn: (req: AskRequest) => askCopilot(req),
    retry: (failureCount, error) => failureCount < 1 && isApiError(error) && error.code === "NETWORK_ERROR",
  });
}
