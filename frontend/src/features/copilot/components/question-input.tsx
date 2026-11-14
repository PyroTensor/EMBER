"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { LoaderCircle, SendHorizontal, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CabinConfig } from "@/lib/api/types";
import {
  DEFAULT_CABIN_CONFIG,
  formatCabinSummary,
} from "@/lib/cabin-scenario/cabin-scenario-context";

/** ISS Standard cabin (same values as the "iss" preset). */
export const ISS_SCENARIO: Readonly<CabinConfig> = DEFAULT_CABIN_CONFIG;

/** Backend AskRequest.question limit. */
const QUESTION_MAX = 2000;

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  pending: boolean;
  useScenario: boolean;
  onUseScenarioChange: (value: boolean) => void;
  cabinConfig: CabinConfig;
  presetName: string;
}

/** Question box: Enter submits, Shift+Enter adds a newline. Disabled while an answer is pending. */
export function QuestionInput({
  onSubmit,
  pending,
  useScenario,
  onUseScenarioChange,
  cabinConfig,
  presetName,
}: QuestionInputProps) {
  const [value, setValue] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const refocus = useRef(false);
  const canSubmit = !pending && value.trim().length > 0;

  // The textarea loses focus while disabled; give it back once the answer arrives.
  useEffect(() => {
    if (!pending && refocus.current) {
      refocus.current = false;
      formRef.current?.querySelector("textarea")?.focus();
    }
  }, [pending]);

  const submit = () => {
    const q = value.trim();
    if (!q || pending) return;
    refocus.current = true;
    onSubmit(q);
    setValue("");
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const scenarioSummary = formatCabinSummary(cabinConfig, presetName);

  return (
    <form ref={formRef} onSubmit={onFormSubmit} className="space-y-3">
      <Textarea
        label="Your question"
        hint="Enter to send · Shift+Enter for a new line"
        placeholder="Ask about flame spread, oxygen limits, ventilation, gravity or a run such as EXP-0012…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={pending}
        maxLength={QUESTION_MAX}
        rows={3}
        className="min-h-20"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              useScenario
                ? "border-accent/50 bg-accent/10 text-fg"
                : "border-border bg-bg text-muted hover:text-fg"
            }`}
          >
            <input
              type="checkbox"
              checked={useScenario}
              onChange={(e) => onUseScenarioChange(e.target.checked)}
              className="accent-accent size-4"
            />
            <span>
              Use current cabin configuration ({scenarioSummary})
            </span>
          </label>
          <Link
            href="/cabin"
            className="text-muted hover:text-accent inline-flex items-center gap-1 font-mono text-[11px] transition-colors"
            title="Edit cabin atmosphere and fuel in Cabin Configurator"
          >
            <SlidersHorizontal aria-hidden className="size-3" />
            Configure cabin →
          </Link>
        </div>
        <Button type="submit" disabled={!canSubmit}>
          {pending ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <SendHorizontal aria-hidden className="size-4" />
          )}
          {pending ? "Asking…" : "Ask"}
        </Button>
      </div>
    </form>
  );
}
