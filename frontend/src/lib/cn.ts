type ClassValue = string | number | false | null | undefined;

/** Join class names, skipping falsy values: cn("a", cond && "b") */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
