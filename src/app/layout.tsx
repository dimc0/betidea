import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Betidea — Analyse historique du football",
  description: "Matchs terminés des saisons passées, statistiques API-Football et analyses par l'IA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
