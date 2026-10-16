import "server-only";
import { cacheLife } from "next/cache";
import type { Affiche, Competition, StatistiquesMatch } from "@/lib/affiche";
import {
  associerStatistiques,
  estObjet,
  lireErreurApi,
  normaliserCompetition,
  normaliserMatch,
  STATUTS_TERMINES,
} from "@/lib/football/normalisation";

const URL_API = "https://v3.football.api-sports.io";

// Compétitions proposées (identifiants API-Football). Leurs saisons ne sont pas
// écrites dans le code : elles sont lues à l'exécution via l'endpoint /leagues.
const COMPETITIONS_SUIVIES = [
  61, // Ligue 1
  39, // Premier League
  78, // Bundesliga
  135, // Serie A
  140, // La Liga
  2, // Ligue des champions
];

export class ErreurFootball extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ErreurFootball";
    this.status = status;
  }
}

// Résultat d'un appel : les fonctions « use cache » ne lèvent pas d'erreur,
// car Next.js remplace en production le message d'une erreur levée dans le cache.
type ResultatApi<T> =
  | { ok: true; donnees: T }
  | { ok: false; erreur: string; status: number };

function lireCle(): string {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new ErreurFootball("La variable serveur API_FOOTBALL_KEY n'est pas configurée.", 500);
  }
  return apiKey;
}

function verifierResultat<T>(resultat: ResultatApi<T>): T {
  if (!resultat.ok) throw new ErreurFootball(resultat.erreur, resultat.status);
  return resultat.donnees;
}

// Un seul point d'entrée vers API-Football : la clé ne quitte jamais ce fichier.
async function appelerApiFootball(
  chemin: string,
  parametres: Record<string, string>
): Promise<ResultatApi<unknown[]>> {
  const apiKey = lireCle();
  const url = new URL(chemin, URL_API);
  for (const [cle, valeur] of Object.entries(parametres)) {
    url.searchParams.set(cle, valeur);
  }

  let reponse: Response;
  try {
    reponse = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      signal: AbortSignal.timeout(15000),
    });
  } catch (erreur) {
    if (erreur instanceof Error && erreur.name === "TimeoutError") {
      return { ok: false, erreur: "API-Football n'a pas répondu dans le délai autorisé.", status: 504 };
    }
    return { ok: false, erreur: "API-Football est momentanément injoignable.", status: 503 };
  }

  if (reponse.status === 429) {
    return {
      ok: false,
      erreur: "Trop de requêtes envoyées à API-Football. Réessaie dans un instant.",
      status: 429,
    };
  }
  if (!reponse.ok) {
    console.error(`Erreur API-Football ${chemin} (HTTP ${reponse.status})`);
    return {
      ok: false,
      erreur: `API-Football a renvoyé une erreur (HTTP ${reponse.status}).`,
      status: 502,
    };
  }

  const donnees: unknown = await reponse.json().catch(() => null);
  if (!estObjet(donnees)) {
    return { ok: false, erreur: "API-Football a renvoyé une réponse illisible.", status: 502 };
  }

  // API-Football répond en HTTP 200 même en cas d'erreur : il faut lire « errors ».
  const erreurApi = lireErreurApi(donnees.errors);
  if (erreurApi) {
    const message = erreurApi.message.replaceAll(apiKey, "[clé masquée]");
    console.error(`Erreur API-Football ${chemin} : ${message}`);
    return { ok: false, erreur: message, status: erreurApi.status };
  }

  if (!Array.isArray(donnees.response)) {
    return { ok: false, erreur: "API-Football a renvoyé une réponse illisible.", status: 502 };
  }
  return { ok: true, donnees: donnees.response };
}

// Mise en cache : une réponse valide est conservée longtemps, une erreur
// (quota, saison refusée…) seulement quelques secondes pour pouvoir réessayer.
async function recupererCompetitionCachee(id: number): Promise<ResultatApi<Competition | null>> {
  "use cache";

  const resultat = await appelerApiFootball("/leagues", { id: String(id) });
  if (!resultat.ok) {
    cacheLife("seconds");
    return resultat;
  }

  cacheLife("days");
  return {
    ok: true,
    donnees: normaliserCompetition(resultat.donnees[0], new Date().toISOString().slice(0, 10)),
  };
}

async function recupererMatchsCaches(
  competitionId: number,
  saison: number
): Promise<ResultatApi<Affiche[]>> {
  "use cache";

  const resultat = await appelerApiFootball("/fixtures", {
    league: String(competitionId),
    season: String(saison),
    status: STATUTS_TERMINES.join("-"),
  });
  if (!resultat.ok) {
    cacheLife("seconds");
    return resultat;
  }

  // Une saison passée ne change plus : une requête par compétition et par saison.
  cacheLife("weeks");
  return {
    ok: true,
    donnees: resultat.donnees
      .map(normaliserMatch)
      .filter((match): match is Affiche => match !== null)
      .sort((a, b) => Date.parse(a.date_match) - Date.parse(b.date_match)),
  };
}

async function recupererStatistiquesCachees(matchId: number): Promise<ResultatApi<unknown[]>> {
  "use cache";

  const resultat = await appelerApiFootball("/fixtures/statistics", { fixture: String(matchId) });
  if (!resultat.ok) {
    cacheLife("seconds");
    return resultat;
  }

  cacheLife("weeks");
  return resultat;
}

export async function recupererCompetitions(): Promise<{
  competitions: Competition[];
  avertissements: string[];
}> {
  lireCle();
  const resultats = await Promise.all(
    COMPETITIONS_SUIVIES.map((id) => recupererCompetitionCachee(id))
  );

  const competitions = resultats.flatMap((resultat) =>
    resultat.ok && resultat.donnees ? [resultat.donnees] : []
  );
  const echecs = resultats.flatMap((resultat) => (resultat.ok ? [] : [resultat]));

  if (competitions.length === 0) {
    if (echecs[0]) verifierResultat(echecs[0]);
    throw new ErreurFootball(
      "Aucune compétition avec une saison terminée n'a été renvoyée par API-Football.",
      404
    );
  }

  return {
    competitions,
    avertissements: echecs.length > 0
      ? [`Certaines compétitions n'ont pas pu être chargées : ${echecs[0].erreur}`]
      : [],
  };
}

export async function recupererMatchsTermines(
  competitionId: number,
  saison: number
): Promise<Affiche[]> {
  lireCle();
  return verifierResultat(await recupererMatchsCaches(competitionId, saison));
}

export async function recupererStatistiquesMatch(match: Affiche): Promise<StatistiquesMatch> {
  lireCle();
  const brut = verifierResultat(await recupererStatistiquesCachees(match.id));
  return associerStatistiques(brut, match);
}

// Retrouve un match dans la saison déjà en cache : aucune requête supplémentaire.
export async function trouverMatch(
  competitionId: number,
  saison: number,
  matchId: number
): Promise<{ match: Affiche; matchsSaison: Affiche[] }> {
  const matchsSaison = await recupererMatchsTermines(competitionId, saison);
  const match = matchsSaison.find((element) => element.id === matchId);

  if (!match) {
    throw new ErreurFootball(
      "Ce match terminé est introuvable dans la compétition et la saison choisies.",
      404
    );
  }
  return { match, matchsSaison };
}

// Réponse d'erreur commune aux routes /api/competitions, /api/matchs et /api/statistiques.
export function reponseErreurFootball(erreur: unknown) {
  if (erreur instanceof ErreurFootball) {
    return Response.json({ erreur: erreur.message }, { status: erreur.status });
  }

  console.error(erreur);
  return Response.json(
    { erreur: "La récupération des données de football a échoué. Réessaie plus tard." },
    { status: 502 }
  );
}
