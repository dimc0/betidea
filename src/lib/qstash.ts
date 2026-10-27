import "server-only";
import { Client } from "@upstash/qstash";

export const NOMBRE_REESSAIS = 3;

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN ?? "",
  // Une valeur vide est ignorée : la bibliothèque utilise alors l'adresse de QStash dans le cloud
  baseUrl: process.env.QSTASH_URL || undefined,
});

export async function publierGeneration(analyseId: string) {
  const appUrl = process.env.APP_URL;

  if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
    throw new Error("Les variables QSTASH_URL et QSTASH_TOKEN doivent être définies.");
  }

  if (!appUrl) {
    throw new Error("La variable APP_URL n'est pas définie.");
  }

  return qstash.publishJSON({
    url: `${appUrl}/api/jobs/generer-analyse`,
    body: { analyseId },
    retries: NOMBRE_REESSAIS,
  });
}
