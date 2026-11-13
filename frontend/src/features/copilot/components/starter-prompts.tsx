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
}

/** Clickable starter questions; picking one asks it immediately. */
export function StarterPrompts({ onPick, disabled }: StarterPromptsProps) {
  return (
    <div className="space-y-2">
      <p id="starter-prompts-label" className="text-xs font-medium text-muted">
        Try a question
      </p>
      <ul aria-labelledby="starter-prompts-label" className="grid gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPick(prompt)}
              disabled={disabled}
              className="flex h-full w-full items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-xs text-muted transition-colors hover:border-accent/40 hover:text-fg disabled:pointer-events-none disabled:opacity-50"
            >
              <MessageSquareText aria-hidden className="mt-0.5 size-3.5 shrink-0 text-accent" />
              <span>{prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
