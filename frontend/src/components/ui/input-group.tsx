import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function InputGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border bg-surface-2/90 focus-within:border-accent/70 focus-within:ring-accent/15 overflow-hidden rounded-2xl border shadow-lg shadow-black/10 transition-[border-color,box-shadow] focus-within:ring-2",
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
        "text-fg placeholder:text-muted min-h-24 w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
      className={cn("flex items-center justify-end px-3 pb-3", className)}
      {...props}
    />
  );
}
