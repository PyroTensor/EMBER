"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type RankingSection = "scenario" | "rankings" | "sources";

const SECTIONS: readonly { id: RankingSection; label: string }[] = [
  { id: "scenario", label: "Scenario" },
  { id: "rankings", label: "Rankings" },
  { id: "sources", label: "Data & Sources" },
];

export function RankingSectionNav({
  active,
  onSelect,
  scenarioName,
  scenarioSummary,
  selectedRunId,
  topOffset,
}: {
  active: RankingSection;
  onSelect: (section: RankingSection) => void;
  scenarioName: string;
  scenarioSummary: string;
  selectedRunId: string | null;
  topOffset: number;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const sections = SECTIONS;

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % sections.length
        : event.key === "ArrowLeft"
          ? (index - 1 + sections.length) % sections.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? sections.length - 1
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = sections[nextIndex];
    if (next) onSelect(next.id);
    tabs.current[nextIndex]?.focus();
  };

  return (
    <div
      id="ranking-section-nav"
      className="border-border bg-surface sticky z-20 overflow-hidden rounded-md border shadow-lg shadow-black/20"
      style={{ top: topOffset }}
    >
      <nav aria-label="Ranking page sections" className="overflow-x-auto">
        <div
          role="tablist"
          aria-label="Ranking page sections"
          className="border-border flex min-w-max border-b px-2"
        >
          {sections.map((section, index) => {
            const selected = active === section.id;
            return (
              <button
                key={section.id}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                id={`ranking-tab-${section.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`ranking-panel-${section.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(section.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "focus-visible:outline-accent shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
                  selected
                    ? "border-accent text-fg"
                    : "text-muted hover:text-fg border-transparent",
                )}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="text-muted flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-xs">
        <p className="min-w-0 truncate" title={scenarioSummary}>
          <span className="sr-only">Scenario: </span>
          <strong className="text-fg">{scenarioName}</strong>{" "}
          <span className="hidden sm:inline">· {scenarioSummary}</span>
        </p>
        <p className="shrink-0">
          <span className="sr-only">Selected run: </span>
          <strong className="text-fg font-mono">
            {selectedRunId ?? "None"}
          </strong>
        </p>
      </div>
    </div>
  );
}
