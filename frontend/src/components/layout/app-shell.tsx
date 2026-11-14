"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockBanner } from "./mock-banner";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

interface AppShellProps {
  children: ReactNode;
  /** Optional top-bar status slot (health stats, connection badge). */
  status?: ReactNode;
}

/** 240 px sidebar on md+; below md the sidebar becomes a modal drawer opened from the top bar. */
export function AppShell({ children, status }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  const close = () => setDrawerOpen(false);

  // While the drawer is open: Escape closes it, focus moves into it, page scroll is locked.
  useEffect(() => {
    if (!drawerOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen md:pl-60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-black"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border md:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div aria-hidden className="absolute inset-0 bg-black/70" onClick={close} />
          <div
            id={drawerId}
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border shadow-2xl"
          >
            <Sidebar onNavigate={close} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
              onClick={close}
              className="absolute top-3 right-3"
            >
              <X aria-hidden className="size-5" />
            </Button>
          </div>
        </div>
      ) : null}

      <div data-app-header className="sticky top-0 z-30">
        <MockBanner />
        <TopBar
          status={status}
          menuOpen={drawerOpen}
          drawerId={drawerId}
          onMenuClick={() => setDrawerOpen(true)}
        />
      </div>

      <main id="main" tabIndex={-1} className="min-w-0 outline-none">
        {children}
      </main>
    </div>
  );
}
