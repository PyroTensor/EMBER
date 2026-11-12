import { cn } from "@/lib/cn";

const SIZES = { sm: "size-4 border-2", md: "size-6 border-2", lg: "size-10 border-[3px]" } as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  /** Visible text next to the spinner; also used as the accessible label. */
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-3 text-sm text-muted", className)}>
      <span aria-hidden className={cn("animate-spin rounded-full border-border border-t-accent", SIZES[size])} />
      {label ? <span>{label}</span> : <span className="sr-only">Loading…</span>}
    </span>
  );
}
