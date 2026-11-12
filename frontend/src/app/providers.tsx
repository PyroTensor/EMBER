"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiModeProvider } from "@/lib/api-mode/api-mode-context";
import { makeQueryClient } from "@/lib/query-client";
import { MockGate } from "@/mocks/mock-gate";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ApiModeProvider>
      <MockGate>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MockGate>
    </ApiModeProvider>
  );
}
