"use client";

import { TriangleAlert, RotateCw } from "lucide-react";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { Button } from "./button";

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  /** Disable the retry button while a refetch is in flight. */
  retrying?: boolean;
  className?: string;
}

/** Shows a friendly message plus the ApiError code and HTTP status. Never falls back to data. */
export function ErrorState({ error, title = "Couldn't load data", onRetry, retrying, className }: ErrorStateProps) {
  const api = isApiError(error) ? error : null;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-offline/30 bg-offline/5 px-6 py-8 text-center",
        className,
      )}
    >
      <TriangleAlert aria-hidden className="size-7 text-offline" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="max-w-md text-xs text-muted">{errorMessage(error)}</p>
        {api ? (
          <p className="font-mono text-[11px] text-muted">
            {api.code} · {api.status === 0 ? "no response" : `HTTP ${api.status}`}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RotateCw aria-hidden className={cn("size-3.5", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      ) : null}
    </div>
  );
}
