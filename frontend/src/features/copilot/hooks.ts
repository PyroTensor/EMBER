"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/errors";
import type { AskRequest } from "@/lib/api/types";
import { askCopilot, getDocument, listDocuments } from "./api";

/**
 * Ask the Co-Pilot. A mutation (not a query): every question is a new request and the thread history lives in
 * the view. Retries once on a connection failure only; a TIMEOUT is not retried (it already waited 35 s).
 */
export function useAskCopilot() {
  return useMutation({
    mutationKey: ["api", "copilot", "ask"],
    mutationFn: (req: AskRequest) => askCopilot(req),
    retry: (failureCount, error) =>
      failureCount < 1 && isApiError(error) && error.code === "NETWORK_ERROR",
  });
}

/** Catalog of all corpus documents (titles, investigations, NASA source URLs, page counts). */
export function useDocuments() {
  return useQuery({
    queryKey: ["api", "documents"],
    queryFn: ({ signal }) => listDocuments(signal),
    staleTime: 5 * 60_000,
  });
}

/** Full multi-page text and metadata for a single document when opened in the reader. */
export function useDocument(docId: string | null) {
  return useQuery({
    queryKey: ["api", "documents", docId],
    queryFn: ({ signal }) => getDocument(docId!, signal),
    enabled: Boolean(docId),
    staleTime: 5 * 60_000,
  });
}
