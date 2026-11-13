"use client";

import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiModeToggle } from "./api-mode-toggle";

interface TopBarProps {
  onMenuClick: () => void;
  menuOpen: boolean;
  /** id of the drawer the hamburger controls. */
  drawerId: string;
  /** Status slot, e.g. health stats + connection badge (provided by a feature). */
  status?: ReactNode;
}

export function TopBar({ onMenuClick, menuOpen, drawerId, status }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        aria-controls={drawerId}
        onClick={onMenuClick}
      >
        <Menu aria-hidden className="size-5" />
      </Button>
      <span className="font-mono text-sm font-semibold tracking-[0.2em] md:hidden">EMBER</span>

      <div className="ml-auto flex min-w-0 items-center gap-3">
        {status ? <div className="flex min-w-0 items-center gap-3 overflow-hidden">{status}</div> : null}
        <ApiModeToggle />
      </div>
    </header>
  );
}
