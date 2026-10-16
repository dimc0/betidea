import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Betidea — Combiné du jour",
  description: "Combiné de football avec les cotes Betclic et Groq.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
