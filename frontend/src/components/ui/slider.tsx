"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Display formatter for the value output (default: value as-is). */
  format?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

/** Labelled range input with a live value + unit readout. */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  format = String,
  hint,
  disabled,
  className,
}: SliderProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const display = unit ? `${format(value)} ${unit}` : format(value);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-sm text-fg tabular-nums">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={display}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
        className="h-2 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
      {hint ? (
        <p id={hintId} className="text-[11px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
