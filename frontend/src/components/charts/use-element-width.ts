"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rendered content width of an element, kept up to date with a ResizeObserver. Charts draw their SVG at real
 * pixels (text never scales); render the SVG with width="100%" so it never forces its container wider.
 */
export function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(0, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
