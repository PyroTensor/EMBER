import type { Metadata } from "next";
import { ResourcesView } from "@/features/resources";

export const metadata: Metadata = { title: "Search Resources" };

export default function Page() {
  return <ResourcesView />;
}
