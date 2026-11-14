import {
  BotMessageSquare,
  ChartLine,
  Flame,
  LayoutDashboard,
  Search,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Module number shown next to the label ("01"…); the overview has none. */
  module?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/cabin", label: "Cabin Configurator", icon: SlidersHorizontal, module: "01" },
  { href: "/twin", label: "Flame Twin", icon: Flame, module: "02" },
  { href: "/ranking", label: "Ranking & Telemetry", icon: ChartLine, module: "03" },
  { href: "/resources", label: "Search Resources", icon: Search, module: "04" },
  { href: "/copilot", label: "SI Co-Pilot", icon: BotMessageSquare, module: "05" },
];

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
