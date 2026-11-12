import { Badge, type BadgeTone } from "@/components/ui/badge";

export type ConnectionStatus = "live" | "mock" | "offline" | "checking";

const META: Record<ConnectionStatus, { tone: BadgeTone; label: string; title: string }> = {
  live: { tone: "success", label: "Live", title: "Connected to the EMBER backend" },
  mock: { tone: "warning", label: "Mock", title: "Mock API: proxy data served in the browser" },
  offline: { tone: "danger", label: "Offline", title: "The backend is unreachable" },
  checking: { tone: "neutral", label: "Checking", title: "Checking the backend connection" },
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const { tone, label, title } = META[status];
  return (
    <Badge tone={tone} dot title={title} aria-label={`Connection: ${label}`}>
      {label}
    </Badge>
  );
}
