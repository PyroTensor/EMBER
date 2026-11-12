// Parse NEXT_PUBLIC_* once. Each variable must be read literally so Next.js can inline it at build time.

export type ApiMode = "mock" | "live";

const mode = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
if (mode !== "mock" && mode !== "live") {
  throw new Error(`Invalid NEXT_PUBLIC_API_MODE: "${mode}" (expected "mock" or "live")`);
}

export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, ""),
  defaultApiMode: mode as ApiMode,
  allowModeToggle: process.env.NEXT_PUBLIC_ALLOW_MODE_TOGGLE === "true",
} as const;
