import type { Metadata } from "next";
import { CabinView } from "@/features/cabin";

export const metadata: Metadata = { title: "Cabin Configurator" };

export default function Page() {
  return <CabinView />;
}
