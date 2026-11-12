"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { fmtSigned } from "@/lib/format";
import { linearScale, niceDomain, niceTicks } from "./use-linear-scale";

export interface DivergingDatum {
  key: string;
  label: string;
  value: number;
}

interface DivergingBarsProps {
  data: readonly DivergingDatum[];
  /** Accessible name, e.g. "Risk contributions by factor". */
  label: string;
  /** Signed value display (default "+1.23" / "−1.23"). */
  format?: (value: number) => string;
  /** Bar colors (any CSS color). Defaults: positive = critical red, negative = low green. */
  positiveColor?: string;
  negativeColor?: string;
  /** Shown instead of the chart when `data` is empty. */
  emptyText?: string;
  className?: string;
}

const BAR = 14;
const AXIS = 22;
const VALUE_COL = 60;
const GAP = 8;
/** Below this width labels go on their own line above each bar. */
const STACK_BELOW = 480;

/** Track the rendered width of an element (SVG is drawn at real pixels, so text never scales). */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Compact signed axis label: +25, −12.5, 0. */
function tickLabel(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  const text = Number.isInteger(abs) ? String(abs) : String(Number(abs.toPrecision(3)));
  return v > 0 ? `+${text}` : `−${text}`;
}

/** Signed horizontal bars around a zero line, sorted by |value|. Pure SVG, props only. */
export function DivergingBars({
  data,
  label,
  format = (v) => fmtSigned(v, 2),
  positiveColor = "var(--color-risk-critical)",
  negativeColor = "var(--color-risk-low)",
  emptyText = "No data",
  className,
}: DivergingBarsProps) {
  const [ref, width] = useWidth<HTMLDivElement>(480);

  const rows = [...data].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const summary = rows.length
    ? `${label}: ${rows.map((r) => `${r.label} ${format(r.value)}`).join(", ")}`
    : `${label}: no data`;

  const stacked = width < STACK_BELOW;
  const row = stacked ? 42 : 30;
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)), 0);
  const tickCount = stacked ? 2 : 6; // more intervals → tighter nice domain (e.g. ±60 instead of ±100 for 57.3)
  const domain = niceDomain([-maxAbs, maxAbs], tickCount);
  const ticks = niceTicks(domain, tickCount);

  // Stacked: bars use the full width (minus the value column); wide: a label column on the left.
  const labelCol = stacked ? 0 : Math.min(180, Math.round(width * 0.36));
  const x0 = stacked ? 14 : labelCol + GAP; // stacked: room for the centred "−50" tick label
  const x1 = Math.max(x0 + 40, width - VALUE_COL - GAP);
  const x = linearScale(domain, [x0, x1]);
  const zero = x(0);
  const plotH = rows.length * row;
  const height = plotH + AXIS;
  const barY = (i: number) => i * row + (stacked ? row - BAR / 2 - 6 : row / 2);
  // Vertical lines: continuous when labels sit in their own column; per bar when stacked (so they don't cross labels).
  const lineSegments: [number, number][] = stacked
    ? rows.map((_, i) => [barY(i) - BAR / 2 - 3, barY(i) + BAR / 2 + 3])
    : [[0, plotH]];

  return (
    <div ref={ref} className={cn("w-full min-w-0", className)}>
      {rows.length === 0 ? (
        <p role="img" aria-label={summary} className="py-6 text-center text-xs text-muted">
          {emptyText}
        </p>
      ) : (
        // width="100%" (not the measured px) so the SVG never forces its container wider than it is.
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary} className="block">
          <title>{summary}</title>

          {/* Grid lines + axis ticks */}
          {ticks.map((t) => (
            <g key={t}>
              {lineSegments.map(([y1, y2]) => (
                <line
                  key={y1}
                  x1={x(t)}
                  x2={x(t)}
                  y1={y1}
                  y2={y2}
                  stroke="var(--color-border)"
                  strokeDasharray={t === 0 ? undefined : "2 3"}
                />
              ))}
              <text x={x(t)} y={plotH + 14} textAnchor="middle" className="fill-muted font-mono text-[10px]">
                {tickLabel(t)}
              </text>
            </g>
          ))}

          {rows.map((r, i) => {
            const y = barY(i);
            const end = x(r.value);
            const w = Math.abs(end - zero);
            const positive = r.value >= 0;
            const color = r.value === 0 ? "var(--color-muted)" : positive ? positiveColor : negativeColor;
            return (
              <g key={r.key}>
                <title>{`${r.label}: ${format(r.value)}`}</title>
                <text
                  x={stacked ? x0 : labelCol}
                  y={stacked ? i * row + 11 : y}
                  textAnchor={stacked ? "start" : "end"}
                  dominantBaseline="middle"
                  className="fill-fg text-[12px]"
                >
                  {r.label}
                </text>
                <rect
                  x={Math.min(zero, end)}
                  y={y - BAR / 2}
                  width={Math.max(w, r.value === 0 ? 0 : 1)}
                  height={BAR}
                  rx={2}
                  fill={positive ? positiveColor : negativeColor}
                  className="transition-all duration-300"
                />
                <text
                  x={width - 2}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="font-mono text-[12px] tabular-nums"
                  fill={color}
                >
                  {format(r.value)}
                </text>
              </g>
            );
          })}

          {/* Zero line on top */}
          {lineSegments.map(([y1, y2]) => (
            <line key={y1} x1={zero} x2={zero} y1={y1} y2={y2} stroke="var(--color-muted)" strokeWidth={1.5} />
          ))}
        </svg>
      )}
    </div>
  );
}
