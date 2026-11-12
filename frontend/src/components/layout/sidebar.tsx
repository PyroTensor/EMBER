"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "./nav-items";

interface SidebarProps {
  /** Called after a link is clicked (closes the mobile drawer). */
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn("flex h-full flex-col bg-surface", className)}>
      <Link href="/" onClick={onNavigate} className="flex items-baseline gap-2 px-5 py-5">
        <span className="font-mono text-lg font-semibold tracking-[0.2em] text-fg">EMBER</span>
        <span className="text-[10px] tracking-wide text-muted uppercase">Mission control</span>
      </Link>

      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, module }) => {
            const active = isActive(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
                  )}
                >
                  <Icon aria-hidden className={cn("size-4 shrink-0", active && "text-accent")} />
                  <span className="flex-1 truncate">{label}</span>
                  {module ? <span className="font-mono text-[10px] text-muted">{module}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="px-5 py-4 text-[10px] leading-relaxed text-muted">
        Exploration of Microgravity Burning through Experimental Research
      </p>
    </div>
  );
}
