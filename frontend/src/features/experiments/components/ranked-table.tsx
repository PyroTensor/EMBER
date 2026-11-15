"use client";

import { useRef, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import type { RankedExperiment } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtScore, SCORE_COMPONENTS, scoreWidth } from "../lib/score-format";
import {
  missingOutcomes,
  ORIGIN_LABEL,
  type DataOrigin,
} from "../lib/run-quality";

interface RankedTableProps {
  results: readonly RankedExperiment[];
  selectedId: string | null;
  onSelect: (experimentId: string, reveal?: boolean) => void;
  origins: ReadonlyMap<string, DataOrigin>;
  telemetryAvailable?: ReadonlyMap<string, boolean>;
}

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

/**
 * Ranked runs as a selectable grid. Tab focuses the selected row; ↑/↓, Home/End move the selection,
 * Enter/Space select the focused row. Scrolls horizontally inside its card on narrow screens.
 */
export function RankedTable({
  results,
  selectedId,
  onSelect,
  origins,
  telemetryAvailable,
}: RankedTableProps) {
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const current = Math.max(
    0,
    results.findIndex((r) => r.experiment_id === selectedId),
  );

  const move = (index: number, reveal = false) => {
    const i = Math.min(results.length - 1, Math.max(0, index));
    const id = results[i]?.experiment_id;
    if (!id) return;
    onSelect(id, reveal);
    rowRefs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    if (e.target !== e.currentTarget) return;
    const keys: Record<string, number> = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: results.length - 1,
    };
    if (e.key in keys) {
      e.preventDefault();
      move(keys[e.key] as number);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      move(index, true);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table
        role="grid"
        aria-label="Ranked test runs"
        className="w-full min-w-[840px] text-sm"
      >
        <thead>
          <tr className="border-border text-muted border-b text-left text-[11px] tracking-wide uppercase">
            <th scope="col" className="py-2 pr-2 pl-4 font-medium">
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
          {results.map((r, i) => {
            const id = r.experiment_id ?? `row-${i}`;
            const selected = i === current && selectedId !== null;
            const origin = origins.get(id) ?? "unverified";
            const hasTelemetry = telemetryAvailable?.get(id) === true;
            return (
              <tr
                key={id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                aria-selected={selected}
                tabIndex={i === current ? 0 : -1}
                onClick={() => r.experiment_id && onSelect(r.experiment_id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "border-border/60 cursor-pointer border-b transition-colors outline-none last:border-0",
                  "focus-visible:bg-surface-2/80 focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent)]",
                  selected
                    ? "bg-surface-2 shadow-[inset_3px_0_0_0_var(--color-accent)]"
                    : "hover:bg-surface-2/50",
                )}
              >
                <td className="text-muted py-2.5 pr-2 pl-4 font-mono text-xs tabular-nums">
                  {r.rank}
                </td>
                <td
                  className={cn(
                    "px-2 py-2.5 font-mono text-xs",
                    selected ? "text-accent" : "text-fg",
                  )}
                >
                  {r.experiment_id}
                </td>
                <td className="text-fg px-2 py-2.5 text-xs">
                  {r.record?.program ?? "—"}
                </td>
                <td className="text-fg px-2 py-2.5 text-xs">
                  {r.record?.fuel_material ?? "—"}
                </td>
                <td className="text-fg px-2 py-2.5 text-right font-mono text-sm font-semibold tabular-nums">
                  {fmtScore(r.total_score)}
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
                    {r.record ? (
                      <span className="text-muted text-[11px] whitespace-nowrap">
                        {4 - missingOutcomes(r.record).length}/4 outcomes
                      </span>
                    ) : null}
                  </div>
                </td>
                {SCORE_COMPONENTS.map((c) => (
                  <td key={c.key} className="px-2 py-2.5 pr-4">
                    <MiniBar
                      value={r[c.key]}
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
    </div>
  );
}
