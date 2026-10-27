// Conversion des réponses de football-data.org (API v4) vers les types de Betidea.
// Fonctions pures (sans réseau).
import type { Match, Saison, Statistique } from "@/lib/affiche";

export function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

// football-data.org utilise les codes HTTP : 400 clé invalide, 403 ressource hors de l'offre,
// 429 trop de requêtes. Le corps contient { message, errorCode }.
export function lireErreurApi(status: number, corps: unknown): { message: string; status: number } {
  const message = estObjet(corps) && typeof corps.message === "string" ? corps.message : "";

  if (status === 400 || status === 401) {
    return { status: 502, message: "La clé FOOTBALL_DATA_KEY est absente ou refusée par football-data.org." };
  }
  if (status === 403) {
    return {
      status: 403,
      message: "Saison non incluse dans l'offre gratuite de football-data.org (seules les dernières saisons sont accessibles).",
    };
  }
  if (status === 429) {
    return { status: 429, message: "Trop de requêtes vers football-data.org (10 par minute). Réessaie dans une minute." };
  }
  return { status: 502, message: `football-data.org a refusé la requête (HTTP ${status}) ${message}`.trim() };
}

// Réponse de /competitions/{code} : les `nombreMax` saisons terminées les plus récentes,
// de la plus récente à la plus ancienne.
export function lireSaisonsPassees(brut: unknown, aujourdHui: string, nombreMax: number): Saison[] {
  if (!estObjet(brut) || !Array.isArray(brut.seasons)) return [];

  const saisons: Saison[] = [];
  for (const saison of brut.seasons) {
    if (
      estObjet(saison) &&
      typeof saison.startDate === "string" &&
      typeof saison.endDate === "string" &&
      saison.endDate < aujourdHui
    ) {
      saisons.push({
        annee: Number(saison.startDate.slice(0, 4)),
        libelle: `${saison.startDate.slice(0, 4)}/${saison.endDate.slice(0, 4)}`,
      });
    }
  }
  return saisons.sort((a, b) => b.annee - a.annee).slice(0, nombreMax);
}

// Une équipe : le nom court (« Nice ») plutôt que le nom complet (« OGC Nice »).
function lireEquipe(brut: unknown): { id: number; nom: string } | null {
  if (!estObjet(brut) || typeof brut.id !== "number") return null;
  const nom = typeof brut.shortName === "string" ? brut.shortName : brut.name;
  return typeof nom === "string" ? { id: brut.id, nom } : null;
}

// Un élément de /competitions/{code}/matches. Seuls les matchs terminés sont gardés.
export function lireMatch(brut: unknown): Match | null {
  if (!estObjet(brut) || brut.status !== "FINISHED" || !estObjet(brut.score)) return null;

  const domicile = lireEquipe(brut.homeTeam);
  const exterieur = lireEquipe(brut.awayTeam);
  const final = brut.score.fullTime;

  if (
    typeof brut.id !== "number" ||
    typeof brut.utcDate !== "string" ||
    !domicile ||
    !exterieur ||
    !estObjet(final) ||
    typeof final.home !== "number" ||
    typeof final.away !== "number"
  ) {
    return null;
  }

  return {
    id: brut.id,
    date: brut.utcDate,
    journee: typeof brut.matchday === "number" ? `Journée ${brut.matchday}` : "",
    domicile,
    exterieur,
    butsDomicile: final.home,
    butsExterieur: final.away,
  };
}

// Réponse de /matches/{id}. L'offre gratuite ne fournit pas de statistiques (tirs, possession) :
// la seule donnée de match en plus du score final est le score à la mi-temps.
export function lireStatistiques(brut: unknown): Statistique[] {
  if (!estObjet(brut) || !estObjet(brut.score) || !estObjet(brut.score.halfTime)) return [];

  const { home, away } = brut.score.halfTime;
  if (typeof home !== "number" || typeof away !== "number") return [];

  return [{ nom: "Buts à la mi-temps", domicile: home, exterieur: away }];
}
