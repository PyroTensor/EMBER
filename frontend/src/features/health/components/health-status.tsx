"use client";

import { RefreshCw } from "lucide-react";
import { ConnectionBadge, type ConnectionStatus } from "@/components/layout/connection-badge";
import { Button } from "@/components/ui/button";
import { useApiMode } from "@/lib/api-mode/api-mode-context";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { useHealth } from "../hooks";

/** Top-bar status: schema version · runs · chunks, connection badge and a refresh button. */
export function HealthStatus() {
  const { mode } = useApiMode();
  const health = useHealth();

  // Any failure counts as offline: NETWORK_ERROR/TIMEOUT mean unreachable, other errors mean unusable.
  const status: ConnectionStatus = health.isError
    ? "offline"
    : health.isPending
      ? "checking"
      : mode === "mock"
        ? "mock"
        : "live";

  // Only show numbers from a successful response, never stale ones after an error.
  const data = health.isSuccess ? health.data : null;

  return (
    <div className="flex items-center gap-3">
      {data ? (
        <p className="hidden items-center gap-2 font-mono text-[11px] text-muted sm:flex">
          <span>schema {data.schema_version ?? "—"}</span>
          <span aria-hidden>·</span>
          <span>{data.test_runs ?? "—"} runs</span>
          <span aria-hidden>·</span>
          <span>{data.chunks ?? "—"} chunks</span>
        </p>
      ) : null}
      <span title={health.isError ? errorMessage(health.error) : undefined}>
        <ConnectionBadge status={status} />
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Refresh connection status"
        onClick={() => void health.refetch()}
        disabled={health.isFetching}
        className="size-8"
      >
        <RefreshCw aria-hidden className={cn("size-3.5", health.isFetching && "animate-spin")} />
      </Button>
    </div>
  );
}
