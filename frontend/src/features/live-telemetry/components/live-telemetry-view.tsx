"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Check,
  MessagesSquare,
  Play,
  Radio,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCabinScenario } from "@/lib/cabin-scenario/cabin-scenario-context";
import { useLiveTelemetry, useResetLiveTelemetry } from "../hooks";
import { STREAM_STATUS_META } from "../lib/live-simulator";
import { LiveBrowserSimulator } from "./live-browser-simulator";
import { LiveEventsAndMatches } from "./live-events-matches";
import { LiveRiskAndShapley } from "./live-risk-shapley";
import { LiveSensorGrid } from "./live-sensor-grid";
import { LiveStripCharts } from "./live-strip-charts";

type PollIntervalOption = "500" | "1000" | "2000" | "paused";

const POLL_OPTIONS: readonly { value: PollIntervalOption; label: string }[] = [
  { value: "500", label: "Poll 500 ms" },
  { value: "1000", label: "Poll 1 s" },
  { value: "2000", label: "Poll 2 s" },
  { value: "paused", label: "Polling paused" },
];

export function LiveTelemetryView() {
  const [pollMode, setPollMode] = useState<PollIntervalOption>("1000");
  const [syncedToCabin, setSyncedToCabin] = useState(false);
  const startSimulatorRef = useRef<(() => void) | null>(null);

  const pollMs = pollMode === "paused" ? false : Number(pollMode);
  const live = useLiveTelemetry(pollMs);
  const reset = useResetLiveTelemetry();
  const { updateConfig } = useCabinScenario();

  const state = live.isError ? undefined : live.data;
  const latest = state?.latest ?? null;
  const statusMeta =
    state?.status === "streaming" && !state.active
      ? { label: "Stream stale", tone: "warning" as const }
      : STREAM_STATUS_META[state?.status ?? "idle"];

  const handleSyncToCabin = () => {
    if (!latest) return;
    updateConfig(
      latest.config,
      null,
      state?.experiment_name
        ? `Live: ${state.experiment_name}`
        : "Live Telemetry",
    );
    setSyncedToCabin(true);
    setTimeout(() => setSyncedToCabin(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Live Telemetry</h1>
          <p className="text-muted max-w-2xl text-sm">
            Monitor live cabin room atmosphere and combustion rig telemetry
            streams with real-time fire-risk indexing, Shapley drivers, closest
            NASA historical runs, and an interactive browser simulator.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {latest ? (
            <Button variant="outline" size="sm" onClick={handleSyncToCabin}>
              {syncedToCabin ? (
                <Check aria-hidden className="text-live size-3.5" />
              ) : (
                <SlidersHorizontal aria-hidden className="size-3.5" />
              )}
              {syncedToCabin
                ? "Loaded into Cabin Configurator"
                : "Load into Cabin Configurator"}
            </Button>
          ) : null}
          <Link
            href="/cabin"
            onClick={handleSyncToCabin}
            className="border-border bg-surface text-fg hover:bg-surface-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <SlidersHorizontal aria-hidden className="size-3.5" />
            Cabin Configurator →
          </Link>
          <Link
            href="/copilot"
            onClick={handleSyncToCabin}
            className="border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <MessagesSquare aria-hidden className="size-3.5" />
            Ask EMBER SI about this cabin →
          </Link>
        </div>
      </header>

      {/* Stream Status & Polling Control Bar */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone={statusMeta.tone} dot>
              {statusMeta.label}
            </Badge>
            {state?.experiment_name ? (
              <span className="text-fg text-sm font-medium">
                {state.experiment_name}
              </span>
            ) : (
              <span className="text-muted text-sm">
                No active experiment stream
              </span>
            )}
            {latest?.phase ? <Badge tone="neutral">{latest.phase}</Badge> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-muted flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums">
              <span>Frames: {state?.sample_count ?? 0}</span>
              <span>T+{latest ? latest.timestamp_s.toFixed(1) : "0.0"}s</span>
              {state?.session_id ? (
                <span className="hidden sm:inline">
                  Session: {state.session_id}
                </span>
              ) : null}
            </div>
            <Select<PollIntervalOption>
              label="Polling interval"
              hideLabel
              value={pollMode}
              options={POLL_OPTIONS}
              onChange={setPollMode}
              className="w-36"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reset.mutate()}
              disabled={reset.isPending || !latest}
            >
              <RotateCcw aria-hidden className="size-3.5" />
              Clear Buffer
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Interactive Browser Simulator */}
      <LiveBrowserSimulator
        externalStreamActive={Boolean(
          state?.active && !state.session_id?.startsWith("browser-sim-"),
        )}
        onRegisterStartHandler={(handler) => {
          startSimulatorRef.current = handler;
        }}
      />

      {live.isPending ? (
        <div className="space-y-4" role="status" aria-busy="true">
          <span className="sr-only">
            Connecting to live telemetry endpoint…
          </span>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-48" />
        </div>
      ) : live.isError ? (
        <ErrorState
          title="Couldn't read live telemetry stream"
          error={live.error}
          onRetry={() => void live.refetch()}
          retrying={live.isFetching}
        />
      ) : !latest || !state ? (
        <Card>
          <CardHeader
            title="Awaiting Live Telemetry Stream"
            subtitle="Play the Browser Simulator above or feed live frames from the standalone Python script"
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => startSimulatorRef.current?.()}
              >
                <Play aria-hidden className="size-3.5" />
                Start Browser Simulation
              </Button>
            }
          />
          <CardBody className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="border-border bg-surface-2/40 rounded-md border p-4">
                <p className="text-fg flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <Activity aria-hidden className="text-accent size-3.5" />
                  External Python Telemetry Feeder
                </p>
                <p className="text-muted mt-1.5 text-xs">
                  Run <code className="text-fg font-mono">simulate_live_telemetry.py</code> from
                  the repository root (excluded from Docker images) to push
                  frames into <code className="text-fg font-mono">POST /api/live-telemetry</code>:
                </p>
                <pre className="text-muted mt-2 overflow-x-auto font-mono text-xs leading-relaxed">
                  {`python3 simulate_live_telemetry.py --scenario sofie-ramp
python3 simulate_live_telemetry.py --scenario eva-prebreathe --loop
python3 simulate_live_telemetry.py --scenario cool-flame-drop`}
                </pre>
              </div>
              <div className="border-border bg-surface-2/40 rounded-md border p-4">
                <p className="text-fg flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <Radio aria-hidden className="text-accent size-3.5" />
                  Dashboard Output per Incoming Frame
                </p>
                <ul className="text-muted mt-2 space-y-1.5 text-xs leading-relaxed">
                  <li>
                    <span className="text-fg font-medium">
                      Cabin Configuration &amp; Sensors:
                    </span>{" "}
                    O₂ %, pressure (kPa), HVAC flow (cm/s), gravity (g), fuel
                    material, diluent gas, and raw transducer readouts.
                  </li>
                  <li>
                    <span className="text-fg font-medium">
                      Fire Risk &amp; Shapley Attribution:
                    </span>{" "}
                    280 px risk gauge, LOI &amp; O₂ margin, predicted regime,
                    and 5-group Shapley drivers vs ISS baseline.
                  </li>
                  <li>
                    <span className="text-fg font-medium">
                      Closest NASA Test Runs:
                    </span>{" "}
                    Live top-5 similarity ranking with score breakdowns and
                    recorded telemetry plots.
                  </li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          <LiveRiskAndShapley
            config={latest.config}
            evaluation={latest.evaluation}
            updating={live.isFetching}
          />
          <LiveSensorGrid sample={latest} />
          <LiveStripCharts history={state.history} />
          <LiveEventsAndMatches
            history={state.history}
            topMatches={state.top_matches}
            onSyncConfig={handleSyncToCabin}
          />
        </div>
      )}
    </div>
  );
}
