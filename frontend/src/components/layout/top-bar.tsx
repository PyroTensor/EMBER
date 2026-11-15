"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  onMenuClick: () => void;
  menuOpen: boolean;
  /** id of the drawer the hamburger controls. */
  drawerId: string;
}

export function TopBar({ onMenuClick, menuOpen, drawerId }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        aria-controls={drawerId}
        onClick={onMenuClick}
      >
        <Menu aria-hidden className="size-5" />
      </Button>
      <span className="font-mono text-sm font-semibold tracking-[0.2em]">EMBER</span>
    </header>
  );
}
