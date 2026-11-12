"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface ParamControlProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  /** Slider range (what the slider can reach). */
  sliderMin: number;
  sliderMax: number;
  step: number;
  /** Absolute limits accepted by the text box (may exceed the slider range). */
  hardMin: number;
  hardMax: number;
  decimals?: number;
  onChange: (v: number) => void;
}

/** Slider + text box. The text box accepts values the slider cannot reach. */
export function ParamControl({
  id,
  label,
  unit,
  value,
  sliderMin,
  sliderMax,
  step,
  hardMin,
  hardMax,
  decimals = 1,
  onChange,
}: ParamControlProps) {
  const [draft, setDraft] = useState<string | null>(null); // non-null while typing
  const editing = draft !== null;

  const parsed = draft === null || draft.trim() === "" ? NaN : Number(draft);
  const invalid = editing && !(Number.isFinite(parsed) && parsed >= hardMin && parsed <= hardMax);
  const outOfSlider = value < sliderMin || value > sliderMax;
  const formatted = String(Number(value.toFixed(decimals + 2)));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <label htmlFor={`${id}-slider`} className="font-medium text-fg">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={`${id}-input`}
            type="text"
            inputMode="decimal"
            aria-label={`${label} value`}
            aria-invalid={invalid}
            value={editing ? draft : formatted}
            onFocus={(e) => {
              setDraft(formatted);
              e.currentTarget.select();
            }}
            onChange={(e) => {
              const text = e.target.value;
              setDraft(text);
              const n = text.trim() === "" ? NaN : Number(text);
              if (Number.isFinite(n) && n >= hardMin && n <= hardMax) onChange(n);
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            className={cn(
              "w-20 rounded-md border bg-bg px-2 py-1 text-right font-mono text-xs text-fg tabular-nums",
              invalid ? "border-risk-critical" : "border-border focus:border-accent",
            )}
          />
          <span className="w-9 font-mono text-muted">{unit}</span>
        </div>
      </div>

      <input
        id={`${id}-slider`}
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={step}
        value={Math.min(sliderMax, Math.max(sliderMin, value))}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
      />

      <div className="flex justify-between font-mono text-[10px] text-muted">
        <span>{sliderMin}</span>
        {invalid ? (
          <span className="text-risk-critical">
            allowed: {hardMin} – {hardMax} {unit}
          </span>
        ) : outOfSlider ? (
          <span className="text-risk-elevated">beyond slider range</span>
        ) : null}
        <span>{sliderMax}</span>
      </div>
    </div>
  );
}
