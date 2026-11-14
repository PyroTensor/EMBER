"use client";

import { useRef, type KeyboardEvent } from "react";
import { Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RankedExperiment } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtScore, SCORE_COMPONENTS, scoreWidth } from "../lib/score-format";
import { missingOutcomes, ORIGIN_LABEL, type DataOrigin } from "../lib/run-quality";

interface RankedTableProps {
  results: readonly RankedExperiment[];
  selectedId: string | null;
  onSelect: (experimentId: string) => void;
  pinnedIds: readonly string[];
  onTogglePin: (experimentId: string) => void;
  pinDisabled?: boolean;
  origins: ReadonlyMap<string, DataOrigin>;
}

function MiniBar({ value, barClass, label }: { value: number | undefined; barClass: string; label: string }) {
  return (
    <div className="flex items-center gap-2" title={`${label}: ${fmtScore(value)}`}>
      <div aria-hidden className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-[width] duration-300", barClass)} style={{ width: scoreWidth(value) }} />
      </div>
      <span className="w-9 text-right font-mono text-xs text-muted tabular-nums">{fmtScore(value)}</span>
    </div>
  );
}

/**
 * Ranked runs as a selectable grid. Tab focuses the selected row; ↑/↓, Home/End move the selection,
 * Enter/Space select the focused row. Scrolls horizontally inside its card on narrow screens.
 */
export function RankedTable({ results, selectedId, onSelect, pinnedIds, onTogglePin, pinDisabled, origins }: RankedTableProps) {
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const current = Math.max(
    0,
    results.findIndex((r) => r.experiment_id === selectedId),
  );

  const move = (index: number) => {
    const i = Math.min(results.length - 1, Math.max(0, index));
    const id = results[i]?.experiment_id;
    if (!id) return;
    onSelect(id);
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
      move(index);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table role="grid" aria-label="Ranked test runs" className="w-full min-w-[940px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted uppercase">
            <th scope="col" className="py-2 pr-2 pl-4 font-medium">#</th>
            <th scope="col" className="px-2 py-2 font-medium">Run</th>
            <th scope="col" className="px-2 py-2 font-medium">Program</th>
            <th scope="col" className="px-2 py-2 font-medium">Material</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Total</th>
            <th scope="col" className="px-2 py-2 font-medium">Data</th>
            {SCORE_COMPONENTS.map((c) => (
              <th key={c.key} scope="col" className="px-2 py-2 font-medium" title={c.description}>
                {c.label}
              </th>
            ))}
            <th scope="col" className="px-2 py-2 pr-4 text-right font-medium">Compare</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const id = r.experiment_id ?? `row-${i}`;
            const selected = i === current && selectedId !== null;
            const pinned = pinnedIds.includes(id);
            const origin = origins.get(id) ?? "unverified";
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
                  "cursor-pointer border-b border-border/60 outline-none transition-colors last:border-0",
                  "focus-visible:bg-surface-2/80 focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent)]",
                  selected
                    ? "bg-surface-2 shadow-[inset_3px_0_0_0_var(--color-accent)]"
                    : "hover:bg-surface-2/50",
                )}
              >
                <td className="py-2.5 pr-2 pl-4 font-mono text-xs text-muted tabular-nums">{r.rank}</td>
                <td className={cn("px-2 py-2.5 font-mono text-xs", selected ? "text-accent" : "text-fg")}>{r.experiment_id}</td>
                <td className="px-2 py-2.5 text-xs text-fg">{r.record?.program ?? "—"}</td>
                <td className="px-2 py-2.5 text-xs text-fg">{r.record?.fuel_material ?? "—"}</td>
                <td className="px-2 py-2.5 text-right font-mono text-sm font-semibold text-fg tabular-nums">
                  {fmtScore(r.total_score)}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={origin === "proxy" ? "warning" : origin === "sourced" ? "success" : "neutral"}>{ORIGIN_LABEL[origin]}</Badge>
                    {r.record ? <span className="whitespace-nowrap text-[11px] text-muted">{4 - missingOutcomes(r.record).length}/4 outcomes</span> : null}
                  </div>
                </td>
                {SCORE_COMPONENTS.map((c) => (
                  <td key={c.key} className="px-2 py-2.5">
                    <MiniBar value={r[c.key]} barClass={c.barClass} label={c.label} />
                  </td>
                ))}
                <td className="px-2 py-2.5 pr-4 text-right">
                  <button
                    type="button"
                    aria-label={`${pinned ? "Unpin" : "Pin"} ${id} for comparison`}
                    aria-pressed={pinned}
                    disabled={pinDisabled || (!pinned && pinnedIds.length >= 3)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(id);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      pinned ? "border-accent text-accent" : "border-border text-muted hover:text-fg",
                    )}
                  >
                    <Pin aria-hidden className="size-3" />
                    {pinned ? "Pinned" : "Pin"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
