import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";

const VALUE: Record<string, string> = {
  "/cabin": "Dial in a habitat atmosphere and see its fire-risk index, explained factor by factor.",
  "/twin": "Watch a buoyant 1g flame turn into a spherical 0g flame, and why HVAC flow matters.",
  "/ranking": "Find the test runs closest to your scenario and inspect their telemetry.",
  "/copilot": "Ask questions about the experiments and get answers with citations.",
  "/resources": "Search NASA combustion papers, ISS investigations, fire incident reports, and spinoff resources by keyword.",
};

const MODULES = NAV_ITEMS.filter((item) => item.module);

/** One card per module, linking to it with a one-line value proposition. */
export function ModuleCards() {
  return (
    <section aria-labelledby="modules-heading" className="space-y-3">
      <h2 id="modules-heading" className="text-sm font-semibold text-fg">
        Modules
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {MODULES.map(({ href, label, icon: Icon, module }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full flex-col gap-3 rounded-card border border-border bg-surface p-5 transition-colors hover:border-accent/50 hover:bg-surface-2"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-surface-2 text-accent group-hover:bg-bg">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="flex-1 font-medium text-fg">{label}</span>
                <span className="font-mono text-[11px] text-muted">{module}</span>
              </span>
              <span className="text-sm text-muted">{VALUE[href]}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-accent">
                Open module
                <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
