"use client";

import React, { useState } from "react";

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
  const shown = editing ? draft : String(Number(value.toFixed(decimals + 2)));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <label htmlFor={`${id}-slider`} className="text-zinc-300">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={`${id}-input`}
            type="text"
            inputMode="decimal"
            aria-label={`${label} value`}
            aria-invalid={invalid}
            value={shown}
            onFocus={(e) => {
              setDraft(String(Number(value.toFixed(decimals + 2))));
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
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") e.currentTarget.blur();
            }}
            className={`w-20 rounded border bg-black px-2 py-1 text-right font-mono text-xs text-white focus:outline-none ${
              invalid ? "border-rose-500" : "border-zinc-800 focus:border-zinc-500"
            }`}
          />
          <span className="w-9 font-mono text-zinc-500">{unit}</span>
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

      <div className="flex justify-between font-mono text-[10px] text-zinc-600">
        <span>{sliderMin}</span>
        {invalid ? (
          <span className="text-rose-400">
            allowed: {hardMin} – {hardMax} {unit}
          </span>
        ) : outOfSlider ? (
          <span className="text-amber-500">beyond slider range</span>
        ) : null}
        <span>{sliderMax}</span>
      </div>
    </div>
  );
}
