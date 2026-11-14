import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function InputGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border bg-surface-2 focus-within:border-accent focus-within:ring-accent/20 overflow-hidden rounded-md border transition-colors focus-within:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupTextarea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "text-fg placeholder:text-muted min-h-24 w-full resize-y bg-transparent px-3 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}
