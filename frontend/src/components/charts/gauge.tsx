import { cn } from "@/lib/cn";

export interface GaugeBand {
  /** Inclusive lower bound on the 0–100 scale. */
  from: number;
  /** Exclusive upper bound (the last band includes 100). */
  to: number;
  /** Any CSS color, e.g. "var(--color-risk-low)". */
  color: string;
  label: string;
}

interface GaugeProps {
  /** 0–100; null/undefined shows an empty gauge with "—". Out-of-range values are clamped. */
  value: number | null | undefined;
  bands: readonly GaugeBand[];
  /** Accessible name, e.g. "Fire risk index". */
  label: string;
  /** Value display (default: one decimal). */
  format?: (value: number) => string;
  /** Small caption under the value, e.g. the band name. */
  caption?: string;
  className?: string;
}

// Value text sits below the hub so the needle never crosses it; side padding keeps "0"/"100" inside.
const W = 268;
const H = 178;
const CX = W / 2;
const CY = 122;
const R = 96;
const STROKE = 18;
const TICKS = [0, 25, 50, 75, 100];

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Point on the semicircle for a 0–100 value (0 = left, 100 = right). */
function polar(value: number, radius: number) {
  const angle = Math.PI * (1 - clamp(value) / 100);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arcPath(from: number, to: number, radius: number) {
  const a = polar(from, radius);
  const b = polar(to, radius);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function bandFor(value: number, bands: readonly GaugeBand[]): GaugeBand | undefined {
  const v = clamp(value);
  return bands.find((b, i) => v >= b.from && (v < b.to || (i === bands.length - 1 && v <= b.to)));
}

/** 0–100 semicircle gauge: band arcs, needle and value label. Pure SVG, props only. */
export function Gauge({ value, bands, label, format = (v) => v.toFixed(1), caption, className }: GaugeProps) {
  const has = typeof value === "number" && Number.isFinite(value);
  const v = has ? clamp(value) : 0;
  const active = has ? bandFor(v, bands) : undefined;
  const display = has ? format(value) : "—";
  const summary = has
    ? `${label}: ${display} out of 100${active ? `, ${active.label}` : ""}`
    : `${label}: no value`;
  const needleDeg = (v / 100) * 180; // needle is drawn pointing left (0) and rotated clockwise

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={summary}
      className={cn("h-auto w-full max-w-xs", className)}
    >
      <title>{summary}</title>

      {/* Track + band arcs (the active band is full strength, the others dimmed) */}
      <path d={arcPath(0, 100, R)} fill="none" stroke="var(--color-surface-2)" strokeWidth={STROKE} />
      {bands.map((b) => (
        <path
          key={b.label}
          d={arcPath(b.from, b.to, R)}
          fill="none"
          stroke={b.color}
          strokeWidth={STROKE}
          opacity={!has || b === active ? 1 : 0.3}
          className="transition-opacity duration-300"
        />
      ))}

      {/* Tick labels */}
      {TICKS.map((t) => {
        const p = polar(t, R + STROKE / 2 + 9);
        return (
          <text
            key={t}
            x={p.x}
            y={p.y}
            textAnchor={t === 50 ? "middle" : t < 50 ? "end" : "start"}
            dominantBaseline="middle"
            className="fill-muted font-mono text-[9px]"
          >
            {t}
          </text>
        );
      })}

      {/* Needle */}
      {has ? (
        <g
          style={{
            transform: `rotate(${needleDeg}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: "transform 400ms ease-out",
          }}
        >
          <line x1={CX} y1={CY} x2={CX - (R - STROKE / 2 - 4)} y2={CY} stroke="var(--color-fg)" strokeWidth={3} strokeLinecap="round" />
        </g>
      ) : null}
      <circle cx={CX} cy={CY} r={6} fill="var(--color-fg)" />

      {/* Value + caption under the hub */}
      <text x={CX} y={CY + 36} textAnchor="middle" className="fill-fg font-mono text-[28px] font-semibold tabular-nums">
        {display}
      </text>
      {caption ? (
        <text
          x={CX}
          y={CY + 53}
          textAnchor="middle"
          className="text-[10px] font-medium tracking-wider uppercase"
          fill={active?.color ?? "var(--color-muted)"}
        >
          {caption}
        </text>
      ) : null}
    </svg>
  );
}
