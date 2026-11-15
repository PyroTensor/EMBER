"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ArrowUpRight, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { riskBandMeta } from "@/features/cabin/lib/risk-band";
import { useDocuments } from "@/features/copilot/hooks";
import { getTelemetry } from "@/features/experiments/api";
import { ScoreBreakdown } from "@/features/experiments/components/score-breakdown";
import {
  hasRecordedTelemetry,
  isTelemetryMissing,
} from "@/features/experiments/components/telemetry-chart";
import {
  dataOrigin,
  missingOutcomes,
  ORIGIN_LABEL,
} from "@/features/experiments/lib/run-quality";
import {
  DEFAULT_RANK_WEIGHTS,
  fmtScore,
  SCORE_COMPONENTS,
  scoreWidth,
} from "@/features/experiments/lib/score-format";
import { useApiMode } from "@/lib/api-mode/api-mode-context";
import { qk } from "@/lib/api/query-keys";
import type {
  DocumentSummary,
  LiveTelemetrySample,
  RankedExperiment,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtNum } from "@/lib/format";

function MiniBar({
  value,
  barClass,
  label,
}: {
  value: number | undefined;
  barClass: string;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-2"
      title={`${label}: ${fmtScore(value)}`}
    >
      <div
        aria-hidden
        className="bg-surface-2 h-1.5 w-14 overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            barClass,
          )}
          style={{ width: scoreWidth(value) }}
        />
      </div>
      <span className="text-muted w-9 text-right font-mono text-xs tabular-nums">
        {fmtScore(value)}
      </span>
    </div>
  );
}

export function LiveEventsAndMatches({
  history,
  topMatches,
  onSyncConfig,
}: {
  history: readonly LiveTelemetrySample[];
  topMatches: readonly RankedExperiment[];
  onSyncConfig: () => void;
}) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const { mode } = useApiMode();
  const documents = useDocuments();

  const documentsById = useMemo(() => {
    const map = new Map<string, DocumentSummary>();
    for (const doc of documents.data ?? []) {
      map.set(doc.doc_id.toUpperCase(), doc);
    }
    return map;
  }, [documents.data]);

  const availabilityChecks = useQueries({
    queries: topMatches.map((run) => ({
      queryKey: qk.telemetry(run.experiment_id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getTelemetry(run.experiment_id, signal),
      staleTime: Infinity,
    })),
  });

  const telemetryAvailableMap = new Map<string, boolean>();
  for (let i = 0; i < topMatches.length; i++) {
    const id = topMatches[i]?.experiment_id;
    const check = availabilityChecks[i];
    if (!id || !check) continue;
    if (check.isSuccess) {
      telemetryAvailableMap.set(id, hasRecordedTelemetry(check.data));
    } else if (check.isError && isTelemetryMissing(check.error)) {
      telemetryAvailableMap.set(id, false);
    }
  }

  const effectiveMatchId =
    selectedMatchId &&
    topMatches.some((m) => m.experiment_id === selectedMatchId)
      ? selectedMatchId
      : (topMatches[0]?.experiment_id ?? null);
  const selectedRun =
    topMatches.find((m) => m.experiment_id === effectiveMatchId) ?? null;

  const recentEvents = useMemo(() => {
    const items: LiveTelemetrySample[] = [];
    for (let i = 0; i < history.length; i++) {
      const sample = history[i];
      if (!sample) continue;
      const prev = i > 0 ? history[i - 1] : null;
      const phaseChanged = Boolean(sample.phase && sample.phase !== prev?.phase);
      if (sample.event || i === 0 || phaseChanged) {
        items.push(sample);
      }
    }
    return items.reverse().slice(0, 12);
  }, [history]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Closest Historical NASA Test Runs"
          subtitle="Top NASA test runs matched against the live cabin atmosphere — select a run to inspect its score breakdown"
          action={
            <Link
              href="/ranking"
              onClick={onSyncConfig}
              className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Open in Ranking &amp; Telemetry
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          }
        />
        <CardBody className="overflow-x-auto p-0">
          {topMatches.length === 0 ? (
            <div className="text-muted flex items-center gap-2 px-5 py-6 text-xs">
              <Sparkles aria-hidden className="size-4" />
              <span>
                No historical runs match the available dataset. Ingest
                historical experiment data to enable matching.
              </span>
            </div>
          ) : (
            <table
              role="grid"
              aria-label="Closest historical NASA test runs"
              className="w-full min-w-[780px] text-left text-xs"
            >
              <thead>
                <tr className="border-border text-muted border-b text-[11px] tracking-wide uppercase">
                  <th scope="col" className="py-2 pr-2 pl-5 font-medium">
                    #
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Run
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Program
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Material
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Regime
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Total
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Data
                  </th>
                  {SCORE_COMPONENTS.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className="px-2 py-2 pr-4 font-medium"
                      title={c.description}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topMatches.map((m) => {
                  const selected = m.experiment_id === effectiveMatchId;
                  const origin = m.record
                    ? dataOrigin(m.record, documentsById, mode)
                    : "unverified";
                  const hasTelemetry =
                    telemetryAvailableMap.get(m.experiment_id) === true;
                  return (
                    <tr
                      key={m.experiment_id}
                      aria-selected={selected}
                      tabIndex={0}
                      onClick={() => setSelectedMatchId(m.experiment_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedMatchId(m.experiment_id);
                        }
                      }}
                      className={cn(
                        "border-border/60 cursor-pointer border-b transition-colors outline-none last:border-0",
                        "focus-visible:bg-surface-2/80 focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent)]",
                        selected
                          ? "bg-surface-2 shadow-[inset_3px_0_0_0_var(--color-accent)]"
                          : "hover:bg-surface-2/50",
                      )}
                    >
                      <td className="text-muted py-2.5 pr-2 pl-5 font-mono tabular-nums">
                        {m.rank}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2.5 font-mono font-medium",
                          selected ? "text-accent" : "text-fg",
                        )}
                      >
                        {m.experiment_id}
                      </td>
                      <td className="text-fg px-2 py-2.5">
                        {m.record?.program ?? "—"}
                      </td>
                      <td className="text-fg px-2 py-2.5">
                        {m.record?.fuel_material ?? "—"}
                      </td>
                      <td className="text-muted px-2 py-2.5">
                        {m.record?.combustion_regime ?? "—"}
                      </td>
                      <td className="text-fg px-2 py-2.5 text-right font-mono text-sm font-semibold tabular-nums">
                        {fmtScore(m.total_score)}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge
                              tone={
                                origin === "proxy"
                                  ? "warning"
                                  : origin === "sourced"
                                    ? "success"
                                    : "neutral"
                              }
                            >
                              {ORIGIN_LABEL[origin]}
                            </Badge>
                            {hasTelemetry ? (
                              <Badge tone="info">Time series</Badge>
                            ) : null}
                          </div>
                          {m.record ? (
                            <span className="text-muted text-[11px] whitespace-nowrap">
                              {4 - missingOutcomes(m.record).length}/4 outcomes
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {SCORE_COMPONENTS.map((c) => (
                        <td key={c.key} className="px-2 py-2.5 pr-4">
                          <MiniBar
                            value={m[c.key]}
                            barClass={c.barClass}
                            label={c.label}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {selectedRun ? (
          <Card>
            <CardHeader
              title="Matched Run Score Breakdown"
              subtitle={`${selectedRun.experiment_id} · Σ default weight share × component score`}
            />
            <CardBody>
              <ScoreBreakdown
                run={selectedRun}
                weights={DEFAULT_RANK_WEIGHTS}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card className={!selectedRun ? "lg:col-span-2" : undefined}>
          <CardHeader
            title="Live Phase & Event Log"
            subtitle="Recent phase transitions and milestone events"
            action={<Clock aria-hidden className="text-muted size-4" />}
          />
          <CardBody className="max-h-[26rem] overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-muted text-xs">
                No phase transitions or milestone events recorded in the current
                buffer.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {recentEvents.map((item) => {
                  const band = riskBandMeta(item.evaluation.risk_band);
                  return (
                    <li
                      key={item.seq}
                      className="border-border bg-surface-2/40 rounded-md border px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted font-mono tabular-nums">
                          #{item.seq} · T+{item.timestamp_s.toFixed(1)}s
                        </span>
                        {band ? (
                          <Badge
                            className={cn(band.textClass, "border-current/40")}
                          >
                            {band.label} ({fmtNum(item.evaluation.risk_index, 1)})
                          </Badge>
                        ) : null}
                      </div>
                      {item.phase ? (
                        <p className="text-fg mt-1 font-medium">{item.phase}</p>
                      ) : null}
                      {item.event ? (
                        <p className="text-muted mt-0.5">{item.event}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
