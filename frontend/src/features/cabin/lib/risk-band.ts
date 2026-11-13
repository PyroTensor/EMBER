import type { RiskBand } from "@/lib/api/types";

export interface RiskBandMeta {
  label: string;
  /** CSS color token, for SVG fills/strokes (e.g. the gauge). */
  color: string;
  /** Tailwind classes (full literals so Tailwind can detect them). */
  textClass: string;
  bgClass: string;
  /** Lower bound of the band on the 0–100 risk index (backend risk_band thresholds). */
  from: number;
}

export const RISK_BANDS: Readonly<Record<RiskBand, RiskBandMeta>> = {
  LOW: { label: "Low", color: "var(--color-risk-low)", textClass: "text-risk-low", bgClass: "bg-risk-low", from: 0 },
  ELEVATED: { label: "Elevated", color: "var(--color-risk-elevated)", textClass: "text-risk-elevated", bgClass: "bg-risk-elevated", from: 25 },
  HIGH: { label: "High", color: "var(--color-risk-high)", textClass: "text-risk-high", bgClass: "bg-risk-high", from: 50 },
  CRITICAL: { label: "Critical", color: "var(--color-risk-critical)", textClass: "text-risk-critical", bgClass: "bg-risk-critical", from: 75 },
};

export const RISK_BAND_ORDER: readonly RiskBand[] = ["LOW", "ELEVATED", "HIGH", "CRITICAL"];

export function riskBandMeta(band: RiskBand | undefined): RiskBandMeta | null {
  return band ? RISK_BANDS[band] : null;
}
