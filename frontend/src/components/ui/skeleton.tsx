import { cn } from "@/lib/cn";

/** Loading placeholder. Decorative: put role="status"/aria-busy on the region that is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}
