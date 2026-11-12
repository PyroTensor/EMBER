"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { Axis } from "./axis";
import { ChartTooltip } from "./chart-tooltip";
import { useElementWidth } from "./use-element-width";
import { linearScale, niceDomain, niceTicks, type Domain } from "./use-linear-scale";

export interface LineSeries {
  key: string;
  label: string;
  /** One value per x; null points leave a gap. A null/empty/all-null series is skipped entirely. */
  values: readonly (number | null)[] | null | undefined;
  /** Any CSS color. */
  color: string;
  /** Which y-axis the series uses (default "left"). */
  axis?: "left" | "right";
  unit?: string;
  format?: (value: number) => string;
}

interface LineChartProps {
  x: readonly number[];
  series: readonly LineSeries[];
  /** Accessible name, e.g. "Telemetry for EXP-0001". */
  label: string;
  xLabel?: string;
  xFormat?: (value: number) => string;
  leftLabel?: string;
  rightLabel?: string;
  height?: number;
  className?: string;
}

const M = { top: 12, bottom: 44, left: 56, rightAxis: 56, rightNone: 16 };

const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const hasData = (s: LineSeries) => !!s.values && s.values.some(isNum);
const defaultFormat = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
const shortTick = (v: number) => String(Number(v.toPrecision(4)));

/** Sensor noise slightly below zero (< 2 % of the span) would stretch a nice domain to a whole extra step. */
const NEAR_ZERO = 0.02;

function extent(series: readonly LineSeries[]): Domain | null {
  const vals = series.flatMap((s) => (s.values ?? []).filter(isNum));
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return [min < 0 && max > 0 && -min < NEAR_ZERO * (max - min) ? 0 : min, max];
}

/** SVG path for one series; null points split it into separate segments. */
function linePath(xs: readonly number[], ys: readonly (number | null)[]): string {
  let d = "";
  let pen = false;
  ys.forEach((y, i) => {
    const x = xs[i];
    if (!isNum(y) || x === undefined) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

/**
 * Multi-series line chart with an optional right y-axis and a hover / keyboard crosshair readout.
 * Pure SVG + props; series without data are not drawn (never drawn as zero).
 */
export function LineChart({
  x,
  series,
  label,
  xLabel,
  xFormat = shortTick,
  leftLabel,
  rightLabel,
  height = 280,
  className,
}: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);

  const drawn = series.filter(hasData);
  const left = drawn.filter((s) => (s.axis ?? "left") === "left");
  const right = drawn.filter((s) => s.axis === "right");
  const hasRight = right.length > 0;

  const plotL = M.left;
  const plotR = Math.max(plotL + 40, width - (hasRight ? M.rightAxis : M.rightNone));
  const plotT = M.top;
  const plotB = height - M.bottom;

  const xExtent: Domain = x.length ? [Math.min(...x), Math.max(...x)] : [0, 1];
  const xScale = linearScale(xExtent, [plotL, plotR]);
  const xTicks = niceTicks(xExtent, Math.max(2, Math.floor((plotR - plotL) / 80)));

  const yCount = Math.max(2, Math.floor((plotB - plotT) / 50));
  const leftDomain = niceDomain(extent(left) ?? [0, 1], yCount);
  const rightDomain = niceDomain(extent(right) ?? [0, 1], yCount);
  const yLeft = linearScale(leftDomain, [plotB, plotT]);
  const yRight = linearScale(rightDomain, [plotB, plotT]);
  const yOf = (s: LineSeries) => (s.axis === "right" ? yRight : yLeft);
  const px = x.map((v) => xScale(v));

  const fmt = (s: LineSeries, v: number | null | undefined) =>
    isNum(v) ? `${(s.format ?? defaultFormat)(v)}${s.unit ? ` ${s.unit}` : ""}` : "—";

  const nearestIndex = (pxX: number) => {
    if (!x.length) return null;
    const target = xScale.invert(pxX);
    let best = 0;
    x.forEach((v, i) => {
      if (Math.abs(v - target) < Math.abs((x[best] as number) - target)) best = i;
    });
    return best;
  };

  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = width / rect.width; // SVG is width="100%"; viewBox is in measured px
    setKeyboard(false);
    setHover(nearestIndex((e.clientX - rect.left) * scaleX));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!x.length) return;
    const last = x.length - 1;
    // With no active point, the first arrow press lands on the first (→) or last (←) point instead of skipping one.
    const next: Record<string, number> = {
      ArrowRight: hover === null ? 0 : Math.min(last, hover + 1),
      ArrowLeft: hover === null ? last : Math.max(0, hover - 1),
      Home: 0,
      End: last,
    };
    if (e.key in next) {
      e.preventDefault();
      setKeyboard(true);
      setHover(next[e.key] as number);
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  const hx = hover !== null ? px[hover] : undefined;
  const readout =
    hover !== null && x[hover] !== undefined
      ? `${xLabel ?? "x"} ${xFormat(x[hover] as number)}: ${drawn.map((s) => `${s.label} ${fmt(s, s.values?.[hover])}`).join(", ")}`
      : "";
  const summary = drawn.length
    ? `${label}. ${drawn.map((s) => s.label).join(" and ")} over ${xLabel ?? "x"}. Focus and use the arrow keys to read values.`
    : `${label}: no data`;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Legend */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {drawn.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-fg">{s.label}</span>
            {hasRight ? <span className="text-[10px]">({s.axis === "right" ? "right" : "left"} axis)</span> : null}
          </li>
        ))}
      </ul>

      <div
        ref={ref}
        tabIndex={drawn.length ? 0 : -1}
        role="group"
        aria-label={summary}
        onKeyDown={onKeyDown}
        onBlur={() => keyboard && setHover(null)}
        className="relative w-full min-w-0 rounded-md outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent)]"
      >
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="block">
          <Axis scale={xScale} ticks={xTicks} orientation="bottom" position={plotB} grid={[plotT, plotB]} label={xLabel} format={xFormat} />
          <Axis
            scale={yLeft}
            ticks={niceTicks(leftDomain, yCount)}
            orientation="left"
            position={plotL}
            grid={[plotL, plotR]}
            label={leftLabel}
            format={shortTick}
            color={left.length === 1 && hasRight ? left[0]?.color : undefined}
          />
          {hasRight ? (
            <Axis
              scale={yRight}
              ticks={niceTicks(rightDomain, yCount)}
              orientation="right"
              position={plotR}
              label={rightLabel}
              format={shortTick}
              color={right.length === 1 ? right[0]?.color : undefined}
            />
          ) : null}

          {drawn.map((s) => {
            const y = yOf(s);
            return (
              <path
                key={s.key}
                d={linePath(px, (s.values ?? []).map((v) => (isNum(v) ? y(v) : null)))}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Crosshair */}
          {hx !== undefined && hover !== null ? (
            <g aria-hidden>
              <line x1={hx} x2={hx} y1={plotT} y2={plotB} stroke="var(--color-muted)" strokeDasharray="3 3" />
              {drawn.map((s) => {
                const v = s.values?.[hover];
                return isNum(v) ? (
                  <circle key={s.key} cx={hx} cy={yOf(s)(v)} r={4} fill={s.color} stroke="var(--color-bg)" strokeWidth={2} />
                ) : null;
              })}
            </g>
          ) : null}

          <rect
            x={plotL}
            y={plotT}
            width={Math.max(0, plotR - plotL)}
            height={Math.max(0, plotB - plotT)}
            fill="transparent"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => !keyboard && setHover(null)}
          />
        </svg>

        {hx !== undefined && hover !== null ? (
          <ChartTooltip
            x={hx}
            y={plotT}
            containerWidth={width}
            title={`${xLabel ?? "x"} ${xFormat(x[hover] as number)}`}
            rows={drawn.map((s) => ({ label: s.label, value: fmt(s, s.values?.[hover]), color: s.color }))}
          />
        ) : null}

        {/* Screen-reader readout for keyboard exploration */}
        <p className="sr-only" aria-live="polite">
          {keyboard ? readout : ""}
        </p>
      </div>
    </div>
  );
}
