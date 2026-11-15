import type { Metadata } from "next";
import { CopilotView } from "@/features/copilot";

export const metadata: Metadata = { title: "EMBER SI" };

export default function Page() {
  return <CopilotView />;
}
