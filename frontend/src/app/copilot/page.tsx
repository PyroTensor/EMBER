import type { Metadata } from "next";
import { CopilotView } from "@/features/copilot";

export const metadata: Metadata = { title: "SI Co-Pilot" };

export default function Page() {
  return <CopilotView />;
}
