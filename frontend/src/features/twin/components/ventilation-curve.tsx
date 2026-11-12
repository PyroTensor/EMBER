import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { flowLoiShift } from "../lib/flame-physics";

const W = 560;
const H = 180;
const PAD = { l: 40, r: 12, t: 12, b: 28 };
const U_MAX = 50;

const SAMPLES = Array.from({ length: 101 }, (_, i) => {
  const u = (i / 100) * U_MAX;
  return { u, y: flowLoiShift(u) };
});
const Y_MIN = Math.min(...SAMPLES.map((s) => s.y));
const Y_MAX = Math.max(...SAMPLES.map((s) => s.y));
// Minimum of the U-curve (most flammable point), on a finer 0.01 cm/s grid than the drawn path.
const DANGER = Array.from({ length: 2001 }, (_, i) => {
  const u = i / 100;
  return { u, y: flowLoiShift(u) };
}).reduce((a, b) => (b.y < a.y ? b : a));

const x = (u: number) => PAD.l + (u / U_MAX) * (W - PAD.l - PAD.r);
const y = (v: number) => PAD.t + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b);
const PATH = SAMPLES.map((s, i) => `${i ? "L" : "M"}${x(s.u).toFixed(1)},${y(s.y).toFixed(1)}`).join(" ");

interface VentilationCurveProps {
  uEff: number;
}

/** LOI shift vs effective velocity: the ventilation paradox (most flammable near ~8 cm/s). */
export function VentilationCurve({ uEff }: VentilationCurveProps) {
  const u = Math.min(uEff, U_MAX);
  const shift = flowLoiShift(uEff);
  const summary =
    `LOI shift versus effective velocity, 0 to ${U_MAX} cm/s. Minimum (most dangerous) at ` +
    `${DANGER.u.toFixed(1)} cm/s. Current u_eff ${uEff.toFixed(1)} cm/s, LOI shift ${shift.toFixed(2)} %.`;

  return (
    <Card>
      <CardHeader
        as="h3"
        title="Ventilation paradox"
        subtitle="Lower LOI shift = easier to burn. Some airflow helps a fire before it blows it off."
      />
      <CardBody>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={summary}>
          {[0, 10, 20, 30, 40, 50].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-border)" strokeWidth={1} />
              <text x={x(t)} y={H - 10} textAnchor="middle" className="fill-muted font-mono text-[10px]">
                {t}
              </text>
            </g>
          ))}
          {[Y_MIN, 0, Y_MAX].map((v) => (
            <text key={v} x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-muted font-mono text-[10px]">
              {v.toFixed(1)}
            </text>
          ))}
          <line
            x1={x(DANGER.u)}
            x2={x(DANGER.u)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--color-risk-critical)"
            strokeDasharray="4 4"
          />
          <text x={x(DANGER.u) + 4} y={PAD.t + 10} className="fill-risk-critical font-mono text-[10px]">
            ~{DANGER.u.toFixed(1)} cm/s most dangerous
          </text>
          <path d={PATH} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
          <circle cx={x(u)} cy={y(flowLoiShift(u))} r={5} fill="var(--color-fg)" stroke="var(--color-bg)" strokeWidth={2} />
        </svg>
        <p className="mt-2 font-mono text-[11px] text-muted">
          u_eff {uEff.toFixed(1)} cm/s{uEff > U_MAX ? " (off chart)" : ""} · LOI shift {shift >= 0 ? "+" : ""}
          {shift.toFixed(2)} %
        </p>
      </CardBody>
    </Card>
  );
}
