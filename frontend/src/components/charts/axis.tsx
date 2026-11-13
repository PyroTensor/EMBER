import type { LinearScale } from "./use-linear-scale";

interface AxisProps {
  scale: LinearScale;
  ticks: readonly number[];
  orientation: "bottom" | "left" | "right";
  /** Bottom: the y of the axis line. Left/right: the x of the axis line. */
  position: number;
  /** Extent of grid lines across the plot (bottom: [y0, y1]; left/right: [x0, x1]). Omit for no grid. */
  grid?: readonly [number, number];
  label?: string;
  format?: (value: number) => string;
  /** Tick label color (e.g. the series color for a dual-axis chart). */
  color?: string;
}

const TICK = 4;

/** One chart axis: ticks, labels, optional grid lines and an axis title. Pure SVG. */
export function Axis({ scale, ticks, orientation, position, grid, label, format = String, color }: AxisProps) {
  const fill = color ?? "var(--color-muted)";
  const [r0, r1] = scale.range;

  if (orientation === "bottom") {
    return (
      <g aria-hidden>
        <line x1={Math.min(r0, r1)} x2={Math.max(r0, r1)} y1={position} y2={position} stroke="var(--color-border)" />
        {ticks.map((t) => {
          const x = scale(t);
          return (
            <g key={t}>
              {grid ? <line x1={x} x2={x} y1={grid[0]} y2={grid[1]} stroke="var(--color-border)" strokeDasharray="2 3" /> : null}
              <line x1={x} x2={x} y1={position} y2={position + TICK} stroke="var(--color-border)" />
              <text x={x} y={position + TICK + 11} textAnchor="middle" className="font-mono text-[10px]" fill={fill}>
                {format(t)}
              </text>
            </g>
          );
        })}
        {label ? (
          <text x={(r0 + r1) / 2} y={position + TICK + 27} textAnchor="middle" className="text-[11px]" fill="var(--color-muted)">
            {label}
          </text>
        ) : null}
      </g>
    );
  }

  const left = orientation === "left";
  const dir = left ? -1 : 1;
  const mid = (r0 + r1) / 2;
  const titleX = position + dir * 40;
  return (
    <g aria-hidden>
      <line x1={position} x2={position} y1={Math.min(r0, r1)} y2={Math.max(r0, r1)} stroke="var(--color-border)" />
      {ticks.map((t) => {
        const y = scale(t);
        return (
          <g key={t}>
            {grid ? <line x1={grid[0]} x2={grid[1]} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="2 3" /> : null}
            <line x1={position} x2={position + dir * TICK} y1={y} y2={y} stroke="var(--color-border)" />
            <text
              x={position + dir * (TICK + 3)}
              y={y}
              textAnchor={left ? "end" : "start"}
              dominantBaseline="middle"
              className="font-mono text-[10px]"
              fill={fill}
            >
              {format(t)}
            </text>
          </g>
        );
      })}
      {label ? (
        <text
          x={titleX}
          y={mid}
          textAnchor="middle"
          transform={`rotate(${left ? -90 : 90} ${titleX} ${mid})`}
          className="text-[11px]"
          fill={fill}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
