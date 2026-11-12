import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMBER",
  description: "Exploration of Microgravity Burning through Experimental Research",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-black text-zinc-100">{children}</body>
    </html>
  );
}
