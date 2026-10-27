import type { Metadata } from "next";
import { Suspense } from "react";
import EnTete from "@/components/EnTete";
import "./globals.css";

export const metadata: Metadata = {
  title: "Betidea — Analyse historique du football",
  description: "Matchs terminés des saisons passées, données football-data.org et analyses par l'IA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* EnTete lit le cookie de session : avec cacheComponents, il doit être
            dans une limite <Suspense> pour ne pas bloquer le reste de la page. */}
        <Suspense>
          <EnTete />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
