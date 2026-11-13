export interface TooltipRow {
  label: string;
  value: string;
  color: string;
}

interface ChartTooltipProps {
  /** Anchor position in px, relative to the chart container (which must be `relative`). */
  x: number;
  y: number;
  containerWidth: number;
  title: string;
  rows: readonly TooltipRow[];
}

const OFFSET = 12;
const MAX_W = 220;

/** Hover readout box next to a crosshair; flips to the left side near the right edge. Visual only. */
export function ChartTooltip({ x, y, containerWidth, title, rows }: ChartTooltipProps) {
  const flip = x + OFFSET + MAX_W > containerWidth;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 min-w-36 rounded-md border border-border bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
      style={{
        top: Math.max(0, y),
        left: flip ? undefined : x + OFFSET,
        right: flip ? containerWidth - x + OFFSET : undefined,
        maxWidth: MAX_W,
      }}
    >
      <p className="mb-1 font-mono text-[11px] text-muted">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-fg">
              <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} />
              {r.label}
            </span>
            <span className="font-mono text-fg tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
