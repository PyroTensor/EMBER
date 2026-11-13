"use client";

import { useRef, type KeyboardEvent } from "react";
import type { RankedExperiment } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtScore, SCORE_COMPONENTS, scoreWidth } from "../lib/score-format";

interface RankedTableProps {
  results: readonly RankedExperiment[];
  selectedId: string | null;
  onSelect: (experimentId: string) => void;
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
export function RankedTable({ results, selectedId, onSelect }: RankedTableProps) {
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
      <table role="grid" aria-label="Ranked test runs" aria-readonly="true" className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted uppercase">
            <th scope="col" className="py-2 pr-2 pl-4 font-medium">#</th>
            <th scope="col" className="px-2 py-2 font-medium">Run</th>
            <th scope="col" className="px-2 py-2 font-medium">Program</th>
            <th scope="col" className="px-2 py-2 font-medium">Material</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Total</th>
            {SCORE_COMPONENTS.map((c) => (
              <th key={c.key} scope="col" className="px-2 py-2 font-medium last:pr-4" title={c.description}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const id = r.experiment_id ?? `row-${i}`;
            const selected = i === current && selectedId !== null;
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
                {SCORE_COMPONENTS.map((c) => (
                  <td key={c.key} className="px-2 py-2.5 last:pr-4">
                    <MiniBar value={r[c.key]} barClass={c.barClass} label={c.label} />
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
