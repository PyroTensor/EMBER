// Display formatters. Every one returns "—" for null, undefined or non-finite input.

const DASH = "—";
type Num = number | null | undefined;

const isNum = (v: Num): v is number => typeof v === "number" && Number.isFinite(v);

export function fmtNum(v: Num, digits = 1): string {
  return isNum(v) ? v.toFixed(digits) : DASH;
}

/** Value already in percent: 21 → "21.0%". */
export function fmtPct(v: Num, digits = 1): string {
  return isNum(v) ? `${v.toFixed(digits)}%` : DASH;
}

export function fmtKpa(v: Num, digits = 1): string {
  return isNum(v) ? `${v.toFixed(digits)} kPa` : DASH;
}

export function fmtCmS(v: Num, digits = 1): string {
  return isNum(v) ? `${v.toFixed(digits)} cm/s` : DASH;
}

export function fmtG(v: Num, digits = 2): string {
  return isNum(v) ? `${v.toFixed(digits)} g` : DASH;
}

/** Always shows the sign: 1.2 → "+1.2", -0.5 → "−0.5", 0 → "0.0". */
export function fmtSigned(v: Num, digits = 1): string {
  if (!isNum(v)) return DASH;
  const abs = Math.abs(v).toFixed(digits);
  if (Number(abs) === 0) return abs;
  return v > 0 ? `+${abs}` : `−${abs}`;
}
