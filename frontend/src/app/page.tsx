import type { Metadata } from "next";
import { OverviewView } from "@/features/overview";

// The layout's "%s · EMBER" template only applies to child segments, not this root page.
export const metadata: Metadata = { title: { absolute: "Overview · EMBER" } };

export default function Page() {
  return <OverviewView />;
}
