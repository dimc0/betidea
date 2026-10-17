import "server-only";
import { cacheLife } from "next/cache";
import type { Match, Saison, Statistique } from "@/lib/affiche";
import {
  estObjet,
  lireErreurApi,
  lireMatch,
  lireSaisonsPassees,
  lireStatistiques,
} from "@/lib/football/normalisation";

// Compétition analysée (identifiant API-Football). 61 = Ligue 1.
export const COMPETITION = { id: 61, nom: "Ligue 1" };

export class ErreurFootball extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Les fonctions « use cache » ne doivent pas lever d'erreur : en production,
// Next.js remplacerait le message. Elles renvoient donc { ok, ... }.
type Resultat = { ok: true; donnees: unknown[] } | { ok: false; erreur: string; status: number };

async function appelerApiFootball(
  chemin: string,
  parametres: Record<string, string>
): Promise<Resultat> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return { ok: false, erreur: "La variable serveur API_FOOTBALL_KEY n'est pas configurée.", status: 500 };
  }

  const url = new URL(chemin, "https://v3.football.api-sports.io");
  for (const [cle, valeur] of Object.entries(parametres)) {
    url.searchParams.set(cle, valeur);
  }

  try {
    const reponse = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      signal: AbortSignal.timeout(15000),
    });
    const donnees: unknown = await reponse.json();

    if (!reponse.ok || !estObjet(donnees)) {
      return { ok: false, erreur: `API-Football a renvoyé une erreur (HTTP ${reponse.status}).`, status: 502 };
    }

    const erreurApi = lireErreurApi(donnees.errors);
    if (erreurApi) {
      console.error(`Erreur API-Football ${chemin} : ${erreurApi.message}`);
      return { ok: false, erreur: erreurApi.message, status: erreurApi.status };
    }

    return { ok: true, donnees: Array.isArray(donnees.response) ? donnees.response : [] };
  } catch {
    return { ok: false, erreur: "API-Football est injoignable pour le moment.", status: 503 };
  }
}

// Mise en cache : une réponse valide est gardée longtemps (saisons passées),
// une erreur seulement quelques secondes pour pouvoir réessayer.
async function appelerAvecCache(chemin: string, parametres: Record<string, string>) {
  "use cache";

  const resultat = await appelerApiFootball(chemin, parametres);
  if (resultat.ok) {
    cacheLife("weeks");
  } else {
    cacheLife("seconds");
  }
  return resultat;
}

async function lireApi(chemin: string, parametres: Record<string, string>): Promise<unknown[]> {
  const resultat = await appelerAvecCache(chemin, parametres);
  if (!resultat.ok) throw new ErreurFootball(resultat.erreur, resultat.status);
  return resultat.donnees;
}

export async function recupererSaisons(): Promise<Saison[]> {
  const reponse = await lireApi("/leagues", { id: String(COMPETITION.id) });
  return lireSaisonsPassees(reponse[0], new Date().toISOString().slice(0, 10));
}

// Tous les matchs terminés d'une saison, en une seule requête.
export async function recupererMatchs(saison: number): Promise<Match[]> {
  const reponse = await lireApi("/fixtures", {
    league: String(COMPETITION.id),
    season: String(saison),
    status: "FT-AET-PEN",
  });

  return reponse
    .map(lireMatch)
    .filter((match): match is Match => match !== null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export async function recupererStatistiques(match: Match): Promise<Statistique[]> {
  const reponse = await lireApi("/fixtures/statistics", { fixture: String(match.id) });
  return lireStatistiques(reponse, match);
}
