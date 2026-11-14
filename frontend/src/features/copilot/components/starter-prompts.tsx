"use client";

import { MessageSquareText } from "lucide-react";

/** Four domain questions that are in scope for the router (each hits a DOMAIN_KEYWORDS token). */
export const STARTER_PROMPTS = [
  "Does low-speed ventilation make microgravity flames more dangerous?",
  "How does the Artemis 34% O2 / 56.5 kPa atmosphere change flame spread?",
  "Which runs are closest to the ISS cabin, and how did they burn?",
  "What is a cool flame and why does it matter for heptane droplet fires?",
] as const;

interface StarterPromptsProps {
  onPick: (prompt: string) => void;
  disabled?: boolean;
  useScenario?: boolean;
}

/** Clickable starter questions; picking one asks it immediately. */
export function StarterPrompts({
  onPick,
  disabled,
  useScenario = false,
}: StarterPromptsProps) {
  const prompts = useScenario
    ? [
        STARTER_PROMPTS[0],
        STARTER_PROMPTS[1],
        "Is this cabin configuration safe, and which test runs are closest to it?",
        STARTER_PROMPTS[3],
      ]
    : STARTER_PROMPTS;

  return (
    <div className="space-y-2">
      <p id="starter-prompts-label" className="text-muted text-xs font-medium">
        Try a question
      </p>
      <ul
        aria-labelledby="starter-prompts-label"
        className="grid gap-2 sm:grid-cols-2"
      >
        {prompts.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPick(prompt)}
              disabled={disabled}
              className="border-border bg-surface text-muted hover:border-accent/40 hover:text-fg flex h-full w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <MessageSquareText
                aria-hidden
                className="text-accent mt-0.5 size-3.5 shrink-0"
              />
              <span>{prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
