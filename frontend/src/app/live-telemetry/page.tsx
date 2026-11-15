import type { Metadata } from "next";
import { LiveTelemetryView } from "@/features/live-telemetry";

export const metadata: Metadata = { title: "Live Telemetry" };

export default function Page() {
  return <LiveTelemetryView />;
}
