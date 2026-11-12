"use client";

import { cn } from "@/lib/cn";
import { SCENARIOS, type SceneId } from "../lib/flame-scenes";

interface ScenarioTabsProps {
  value: SceneId | null;
  onSelect: (id: SceneId) => void;
}

export function ScenarioTabs({ value, onSelect }: ScenarioTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Gravity scenarios">
      {SCENARIOS.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(s.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              active
                ? "border-accent bg-surface-2 text-fg"
                : "border-border bg-bg text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {s.label} <span className="text-muted">({s.gLabel})</span>
          </button>
        );
      })}
    </div>
  );
}
