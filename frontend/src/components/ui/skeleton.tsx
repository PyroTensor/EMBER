import { cn } from "@/lib/cn";

/**
 * Loading placeholder. Decorative: put role="status"/aria-busy on the region that is loading.
 * A block-level <span> (not a <div>) so it is valid inside phrasing content such as <p>.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-surface-2", className)} />;
}
