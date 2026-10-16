import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Betidea — Combiné du jour",
  description: "Analyses de football et combiné du jour à partir des données de The Odds API.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
