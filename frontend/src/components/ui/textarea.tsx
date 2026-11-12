"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends Omit<ComponentProps<"textarea">, "id"> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
}

export function Textarea({ label, hideLabel, hint, className, ...props }: TextareaProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={cn("block text-xs font-medium text-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint ? hintId : undefined}
        className={cn(
          "min-h-24 w-full resize-y rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-muted/70",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-[11px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
