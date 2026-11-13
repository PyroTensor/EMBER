import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./skeleton";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  /** Shows a skeleton instead of the value. */
  loading?: boolean;
  className?: string;
}

export function KpiTile({ label, value, unit, hint, loading, className }: KpiTileProps) {
  return (
    <div
      className={cn("rounded-card border border-border bg-surface px-4 py-3", className)}
      aria-busy={loading || undefined}
    >
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <>
            <span className="font-mono text-2xl font-semibold text-fg tabular-nums">{value}</span>
            {unit ? <span className="text-xs text-muted">{unit}</span> : null}
          </>
        )}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
