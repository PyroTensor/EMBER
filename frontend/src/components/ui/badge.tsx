import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const TONES = {
  neutral: "border-border bg-surface-2 text-muted",
  success: "border-live/40 bg-live/10 text-live",
  warning: "border-mock/40 bg-mock/10 text-mock",
  danger: "border-offline/40 bg-offline/10 text-offline",
  info: "border-sky-400/40 bg-sky-400/10 text-sky-400",
} as const;

export type BadgeTone = keyof typeof TONES;

export interface BadgeProps extends ComponentProps<"span"> {
  tone?: BadgeTone;
  /** Leading status dot. */
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
