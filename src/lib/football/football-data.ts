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

// Compétition analysée (code football-data.org). FL1 = Ligue 1.
export const COMPETITION = { code: "FL1", nom: "Ligue 1" };

// L'offre gratuite donne accès à la saison en cours et aux 3 précédentes (les plus anciennes
// répondent 403) : on ne propose donc que les 3 dernières saisons terminées.
const SAISONS_ACCESSIBLES = 3;

export class ErreurFootball extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Les fonctions « use cache » ne doivent pas lever d'erreur : en production,
// Next.js remplacerait le message. Elles renvoient donc { ok, ... }.
type Resultat = { ok: true; donnees: unknown } | { ok: false; erreur: string; status: number };

async function appelerFootballData(
  chemin: string,
  parametres: Record<string, string>
): Promise<Resultat> {
  const apiKey = process.env.FOOTBALL_DATA_KEY;
  if (!apiKey) {
    console.error("La variable serveur FOOTBALL_DATA_KEY n'est pas configurée.");
    return { ok: false, erreur: "Les données football sont momentanément indisponibles. Réessayez plus tard.", status: 500 };
  }

  const url = new URL(`/v4${chemin}`, "https://api.football-data.org");
  for (const [cle, valeur] of Object.entries(parametres)) {
    url.searchParams.set(cle, valeur);
  }

  try {
    const reponse = await fetch(url, {
      headers: { "X-Auth-Token": apiKey },
      signal: AbortSignal.timeout(15000),
    });
    const donnees: unknown = await reponse.json().catch(() => null);

    if (!reponse.ok) {
      const erreurApi = lireErreurApi(reponse.status);
      const detail = estObjet(donnees) && typeof donnees.message === "string" ? donnees.message : "";
      console.error(`Erreur football-data.org ${chemin} (HTTP ${reponse.status}) : ${detail}`);
      return { ok: false, erreur: erreurApi.message, status: erreurApi.status };
    }

    return { ok: true, donnees };
  } catch {
    return { ok: false, erreur: "football-data.org est injoignable pour le moment.", status: 503 };
  }
}

// Mise en cache : une réponse valide est gardée longtemps (saisons passées),
// une erreur seulement quelques secondes pour pouvoir réessayer.
async function appelerAvecCache(chemin: string, parametres: Record<string, string>) {
  "use cache";

  const resultat = await appelerFootballData(chemin, parametres);
  if (resultat.ok) {
    cacheLife("weeks");
  } else {
    cacheLife("seconds");
  }
  return resultat;
}

async function lireApi(chemin: string, parametres: Record<string, string> = {}): Promise<unknown> {
  const resultat = await appelerAvecCache(chemin, parametres);
  if (!resultat.ok) throw new ErreurFootball(resultat.erreur, resultat.status);
  return resultat.donnees;
}

export async function recupererSaisons(): Promise<Saison[]> {
  const competition = await lireApi(`/competitions/${COMPETITION.code}`);
  return lireSaisonsPassees(competition, new Date().toISOString().slice(0, 10), SAISONS_ACCESSIBLES);
}

// Tous les matchs terminés d'une saison, en une seule requête.
export async function recupererMatchs(saison: number): Promise<Match[]> {
  const reponse = await lireApi(`/competitions/${COMPETITION.code}/matches`, {
    season: String(saison),
  });
  const matchs = estObjet(reponse) && Array.isArray(reponse.matches) ? reponse.matches : [];

  return matchs
    .map(lireMatch)
    .filter((match): match is Match => match !== null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export async function recupererStatistiques(match: Match): Promise<Statistique[]> {
  const detail = await lireApi(`/matches/${match.id}`);
  return lireStatistiques(detail);
}
