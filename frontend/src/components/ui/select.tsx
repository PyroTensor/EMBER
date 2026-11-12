"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly (SelectOption<T> | T)[];
  onChange: (value: T) => void;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

const toOption = <T extends string>(o: SelectOption<T> | T): SelectOption<T> =>
  typeof o === "string" ? { value: o, label: o } : o;

/** Native select (keyboard + screen-reader support for free), typed by its option values. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
  disabled,
  className,
}: SelectProps<T>) {
  const id = useId();
  const opts = options.map(toOption);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className={cn("block text-xs font-medium text-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const next = opts.find((o) => o.value === e.currentTarget.value);
            if (next) onChange(next.value);
          }}
          className="h-10 w-full cursor-pointer appearance-none rounded-md border border-border bg-surface-2 pr-9 pl-3 text-sm text-fg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
