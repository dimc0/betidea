// Conversion des réponses brutes d'API-Football vers les types de Betidea.
// Fonctions pures : aucun appel réseau, elles sont testées dans tests/football.test.mjs.
import type {
  Affiche,
  Competition,
  EquipeMatch,
  ScorePartiel,
  StatistiqueMatch,
  StatistiquesMatch,
  ValeurStatistique,
} from "@/lib/affiche";

// Statuts API-Football d'un match terminé : temps réglementaire,
// après prolongation, après tirs au but.
export const STATUTS_TERMINES = ["FT", "AET", "PEN"];

const LIBELLES_STATISTIQUES: Record<string, string> = {
  "Shots on Goal": "Tirs cadrés",
  "Shots off Goal": "Tirs non cadrés",
  "Total Shots": "Tirs au total",
  "Blocked Shots": "Tirs contrés",
  "Shots insidebox": "Tirs dans la surface",
  "Shots outsidebox": "Tirs hors de la surface",
  Fouls: "Fautes",
  "Corner Kicks": "Corners",
  Offsides: "Hors-jeu",
  "Ball Possession": "Possession",
  "Yellow Cards": "Cartons jaunes",
  "Red Cards": "Cartons rouges",
  "Goalkeeper Saves": "Arrêts du gardien",
  "Total passes": "Passes",
  "Passes accurate": "Passes réussies",
  "Passes %": "Précision des passes",
  expected_goals: "Buts attendus (xG)",
  goals_prevented: "Buts évités",
};

export function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function nombreOuNull(valeur: unknown): number | null {
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null;
}

function texteOuNull(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.trim() !== "" ? valeur : null;
}

export function lireEntierPositif(valeur: string | null): number | null {
  if (!valeur || !/^\d{1,9}$/.test(valeur)) return null;
  const nombre = Number(valeur);
  return nombre > 0 ? nombre : null;
}

// API-Football répond toujours en HTTP 200, même en cas d'erreur :
// le champ « errors » vaut [] si tout va bien, sinon un objet { cle: message }.
export function lireErreurApi(
  erreurs: unknown
): { message: string; status: number } | null {
  if (!estObjet(erreurs)) return null;

  const premiere = Object.entries(erreurs).find(
    ([, message]) => typeof message === "string"
  );
  if (!premiere) return null;

  const [cle, message] = premiere as [string, string];
  const detail = message.slice(0, 240);

  switch (cle) {
    case "token":
      return {
        status: 502,
        message: "La clé API_FOOTBALL_KEY est absente ou refusée par API-Football.",
      };
    case "requests":
      return {
        status: 429,
        message: "Le quota journalier d'API-Football est atteint. Réessaie après sa remise à zéro.",
      };
    case "rateLimit":
      return {
        status: 429,
        message: "Trop de requêtes envoyées à API-Football en une minute. Réessaie dans un instant.",
      };
    case "plan":
      return {
        status: 403,
        message: `Cette saison n'est pas accessible avec ton offre API-Football. Réponse de l'API : ${detail}`,
      };
    case "access":
      return {
        status: 403,
        message: `Accès à API-Football refusé : ${detail}`,
      };
    default:
      return {
        status: 502,
        message: `API-Football a refusé la requête (${cle}) : ${detail}`,
      };
  }
}

// Réponse de /leagues?id=... : ne garde que les saisons terminées.
export function normaliserCompetition(
  brut: unknown,
  aujourdHui: string
): Competition | null {
  if (
    !estObjet(brut) ||
    !estObjet(brut.league) ||
    !Array.isArray(brut.seasons)
  ) {
    return null;
  }

  const ligue = brut.league;
  if (typeof ligue.id !== "number" || typeof ligue.name !== "string") {
    return null;
  }

  const saisons = brut.seasons
    .flatMap((saison) => {
      if (
        !estObjet(saison) ||
        typeof saison.year !== "number" ||
        typeof saison.start !== "string" ||
        typeof saison.end !== "string"
      ) {
        return [];
      }

      // Une saison est passée si elle n'est pas en cours et que sa date de fin est dépassée.
      if (saison.current === true || saison.end >= aujourdHui) return [];

      const couverture =
        estObjet(saison.coverage) && estObjet(saison.coverage.fixtures)
          ? saison.coverage.fixtures
          : {};

      return [
        {
          annee: saison.year,
          debut: saison.start,
          fin: saison.end,
          statistiques_disponibles: couverture.statistics_fixtures === true,
        },
      ];
    })
    .sort((a, b) => b.annee - a.annee);

  if (saisons.length === 0) return null;

  return {
    id: ligue.id,
    nom: ligue.name,
    pays: estObjet(brut.country) ? texteOuNull(brut.country.name) ?? "" : "",
    logo: texteOuNull(ligue.logo) ?? "",
    saisons,
  };
}

function normaliserEquipe(brut: unknown): EquipeMatch | null {
  if (!estObjet(brut) || typeof brut.id !== "number" || typeof brut.name !== "string") {
    return null;
  }
  return { id: brut.id, nom: brut.name, logo: texteOuNull(brut.logo) ?? "" };
}

function scorePartiel(brut: unknown): ScorePartiel | null {
  if (!estObjet(brut)) return null;
  const dom = nombreOuNull(brut.home);
  const ext = nombreOuNull(brut.away);
  return dom === null || ext === null ? null : { dom, ext };
}

// Un élément de /fixtures. Les buts « home » sont toujours associés
// à l'équipe « home » de la même réponse, jamais à l'ordre d'affichage.
export function normaliserMatch(brut: unknown): Affiche | null {
  if (
    !estObjet(brut) ||
    !estObjet(brut.fixture) ||
    !estObjet(brut.league) ||
    !estObjet(brut.teams) ||
    !estObjet(brut.goals)
  ) {
    return null;
  }

  const { fixture, league, teams, goals } = brut;
  const score = estObjet(brut.score) ? brut.score : {};
  const statut =
    estObjet(fixture.status) && typeof fixture.status.short === "string"
      ? fixture.status.short
      : "";
  const equipeDom = normaliserEquipe(teams.home);
  const equipeExt = normaliserEquipe(teams.away);
  const butsDom = nombreOuNull(goals.home);
  const butsExt = nombreOuNull(goals.away);

  if (
    !STATUTS_TERMINES.includes(statut) ||
    typeof fixture.id !== "number" ||
    typeof fixture.date !== "string" ||
    !Number.isFinite(Date.parse(fixture.date)) ||
    typeof league.id !== "number" ||
    typeof league.season !== "number" ||
    !equipeDom ||
    !equipeExt ||
    butsDom === null ||
    butsExt === null
  ) {
    return null;
  }

  return {
    id: fixture.id,
    competition: texteOuNull(league.name) ?? "",
    competition_id: league.id,
    saison: league.season,
    journee: texteOuNull(league.round) ?? "",
    date_match: fixture.date,
    statut,
    stade: estObjet(fixture.venue) ? texteOuNull(fixture.venue.name) : null,
    arbitre: texteOuNull(fixture.referee),
    equipe_dom: equipeDom,
    equipe_ext: equipeExt,
    score: {
      dom: butsDom,
      ext: butsExt,
      mi_temps: scorePartiel(score.halftime),
      tirs_au_but: scorePartiel(score.penalty),
    },
  };
}

// Réponse de /fixtures/statistics : un bloc par équipe.
// L'association se fait par identifiant d'équipe, pas par position dans le tableau.
export function associerStatistiques(
  brut: unknown[],
  match: Pick<Affiche, "equipe_dom" | "equipe_ext">
): StatistiquesMatch {
  const parEquipe = new Map<number, Map<string, ValeurStatistique>>();

  for (const bloc of brut) {
    if (
      !estObjet(bloc) ||
      !estObjet(bloc.team) ||
      typeof bloc.team.id !== "number" ||
      !Array.isArray(bloc.statistics)
    ) {
      continue;
    }

    const valeurs = new Map<string, ValeurStatistique>();
    for (const statistique of bloc.statistics) {
      if (!estObjet(statistique) || typeof statistique.type !== "string") continue;
      const valeur = statistique.value;
      valeurs.set(
        statistique.type,
        typeof valeur === "string" || nombreOuNull(valeur) !== null
          ? (valeur as string | number)
          : null
      );
    }
    parEquipe.set(bloc.team.id, valeurs);
  }

  const dom = parEquipe.get(match.equipe_dom.id);
  const ext = parEquipe.get(match.equipe_ext.id);
  if (!dom || !ext) return { disponibles: false, lignes: [] };

  const types = [...new Set([...dom.keys(), ...ext.keys()])];
  const lignes: StatistiqueMatch[] = types
    .map((type) => ({
      type,
      libelle: LIBELLES_STATISTIQUES[type] ?? type,
      dom: dom.get(type) ?? null,
      ext: ext.get(type) ?? null,
    }))
    // Une ligne sans aucune valeur n'apporte rien : elle n'est pas affichée.
    .filter((ligne) => ligne.dom !== null || ligne.ext !== null);

  return { disponibles: lignes.length > 0, lignes };
}
