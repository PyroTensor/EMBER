import type { Metadata } from "next";
import { RankingView } from "@/features/experiments";

export const metadata: Metadata = { title: "Ranking & Telemetry" };

export default function Page() {
  return <RankingView />;
}
