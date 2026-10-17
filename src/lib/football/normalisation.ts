// Conversion des réponses d'API-Football vers les types de Betidea.
// Fonctions pures (sans réseau), testées dans tests/football.test.mjs.
import type { Match, Saison, Statistique } from "@/lib/affiche";

export function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

// API-Football répond en HTTP 200 même en cas d'erreur :
// le champ « errors » vaut [] si tout va bien, sinon un objet { cle: message }.
export function lireErreurApi(erreurs: unknown): { message: string; status: number } | null {
  if (!estObjet(erreurs)) return null;

  const premiere = Object.entries(erreurs).find(([, message]) => typeof message === "string");
  if (!premiere) return null;

  const [cle, message] = premiere as [string, string];

  if (cle === "token") {
    return { status: 502, message: "La clé API_FOOTBALL_KEY est absente ou refusée par API-Football." };
  }
  if (cle === "requests") {
    return { status: 429, message: "Le quota journalier d'API-Football est atteint. Réessaie demain." };
  }
  if (cle === "rateLimit") {
    return { status: 429, message: "Trop de requêtes vers API-Football. Réessaie dans une minute." };
  }
  if (cle === "plan") {
    return { status: 403, message: `Saison non accessible avec ton offre API-Football : ${message}` };
  }
  return { status: 502, message: `API-Football a refusé la requête : ${message}` };
}

// Réponse de /leagues : saisons terminées, de la plus récente à la plus ancienne.
export function lireSaisonsPassees(brut: unknown, aujourdHui: string): Saison[] {
  if (!estObjet(brut) || !Array.isArray(brut.seasons)) return [];

  const saisons: Saison[] = [];
  for (const saison of brut.seasons) {
    if (
      estObjet(saison) &&
      typeof saison.year === "number" &&
      typeof saison.start === "string" &&
      typeof saison.end === "string" &&
      saison.end < aujourdHui
    ) {
      saisons.push({
        annee: saison.year,
        libelle: `${saison.start.slice(0, 4)}/${saison.end.slice(0, 4)}`,
      });
    }
  }
  return saisons.sort((a, b) => b.annee - a.annee);
}

// Un élément de /fixtures. Les buts « home » vont à l'équipe « home » de la même réponse.
export function lireMatch(brut: unknown): Match | null {
  if (
    !estObjet(brut) ||
    !estObjet(brut.fixture) ||
    !estObjet(brut.league) ||
    !estObjet(brut.teams) ||
    !estObjet(brut.goals) ||
    !estObjet(brut.teams.home) ||
    !estObjet(brut.teams.away)
  ) {
    return null;
  }

  const { fixture, league, teams, goals } = brut;
  const domicile = teams.home as Record<string, unknown>;
  const exterieur = teams.away as Record<string, unknown>;

  if (
    typeof fixture.id !== "number" ||
    typeof fixture.date !== "string" ||
    typeof domicile.id !== "number" ||
    typeof domicile.name !== "string" ||
    typeof exterieur.id !== "number" ||
    typeof exterieur.name !== "string" ||
    typeof goals.home !== "number" ||
    typeof goals.away !== "number"
  ) {
    return null;
  }

  return {
    id: fixture.id,
    date: fixture.date,
    journee: typeof league.round === "string" ? league.round : "",
    domicile: { id: domicile.id, nom: domicile.name },
    exterieur: { id: exterieur.id, nom: exterieur.name },
    butsDomicile: goals.home,
    butsExterieur: goals.away,
  };
}

// Réponse de /fixtures/statistics : un bloc par équipe.
// On associe chaque bloc à son équipe par identifiant, pas par position.
export function lireStatistiques(brut: unknown[], match: Match): Statistique[] {
  const blocDomicile = brut.find(
    (bloc) => estObjet(bloc) && estObjet(bloc.team) && bloc.team.id === match.domicile.id
  );
  const blocExterieur = brut.find(
    (bloc) => estObjet(bloc) && estObjet(bloc.team) && bloc.team.id === match.exterieur.id
  );

  const valeurs = (bloc: unknown): Map<string, string | number | null> => {
    const resultat = new Map<string, string | number | null>();
    if (!estObjet(bloc) || !Array.isArray(bloc.statistics)) return resultat;
    for (const statistique of bloc.statistics) {
      if (estObjet(statistique) && typeof statistique.type === "string") {
        const valeur = statistique.value;
        resultat.set(
          statistique.type,
          typeof valeur === "string" || typeof valeur === "number" ? valeur : null
        );
      }
    }
    return resultat;
  };

  const domicile = valeurs(blocDomicile);
  const exterieur = valeurs(blocExterieur);
  if (domicile.size === 0 || exterieur.size === 0) return [];

  return [...domicile.keys()].map((nom) => ({
    nom,
    domicile: domicile.get(nom) ?? null,
    exterieur: exterieur.get(nom) ?? null,
  }));
}
