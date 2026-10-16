import { cacheLife } from "next/cache";

export type SelectionCote = {
  id: string;
  bookmakerKey: string;
  bookmaker: string;
  marketKey: string;
  market: string;
  selection: string;
  cote: number;
  miseAJourLe: string;
};

export type MatchCotes = {
  id: string;
  match: string;
  equipe_domicile: string;
  equipe_exterieure: string;
  competition: string;
  competitionKey: string;
  coupEnvoi: string;
  selections: SelectionCote[];
};

export type SnapshotCotes = {
  source: "The Odds API";
  recupereLe: string;
  date: string;
  nombreMatchs: number;
  avertissements: string[];
  matchs: MatchCotes[];
};

type Competition = { key: string; title: string };

type EvenementApi = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update?: string;
    markets: Array<{
      key: string;
      last_update?: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
};

const COMPETITIONS: Competition[] = [
  { key: "soccer_france_ligue_one", title: "Ligue 1 · France" },
  { key: "soccer_epl", title: "Premier League · Angleterre" },
  { key: "soccer_germany_bundesliga", title: "Bundesliga · Allemagne" },
  { key: "soccer_italy_serie_a", title: "Serie A · Italie" },
  { key: "soccer_spain_la_liga", title: "La Liga · Espagne" },
  { key: "soccer_uefa_champs_league", title: "Ligue des champions" },
];

const AGE_MAX_COTES_MS = 30 * 60 * 1000;
const AGE_MAX_CATALOGUE_MS = 10 * 60 * 1000;

export class ErreurCotes extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "ErreurCotes";
    this.status = status;
  }
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null;
}

function estEvenementApi(valeur: unknown): valeur is EvenementApi {
  return (
    estObjet(valeur) &&
    typeof valeur.id === "string" &&
    typeof valeur.sport_key === "string" &&
    typeof valeur.commence_time === "string" &&
    typeof valeur.home_team === "string" &&
    typeof valeur.away_team === "string" &&
    Array.isArray(valeur.bookmakers)
  );
}

async function recupererEvenementsCaches(
  sportKey: string,
  apiKey: string
): Promise<{ evenements: unknown[]; recupereLe: string }> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 900 });

  const url = new URL(
    `/v4/sports/${encodeURIComponent(sportKey)}/odds/`,
    "https://api.the-odds-api.com"
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu");
  // L'endpoint /odds n'accepte que les marchés principaux. Les marchés
  // secondaires comme btts nécessitent l'endpoint par événement.
  url.searchParams.set("markets", "h2h,totals,spreads");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  let reponse: Response;
  try {
    reponse = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (erreur) {
    if (erreur instanceof Error && erreur.name === "TimeoutError") {
      throw new ErreurCotes("The Odds API n'a pas répondu dans le délai autorisé.", 504);
    }
    throw new ErreurCotes("The Odds API est momentanément injoignable.", 503);
  }

  if (!reponse.ok) {
    const corpsErreur: unknown = await reponse.json().catch(() => null);
    const messageApi =
      estObjet(corpsErreur) && typeof corpsErreur.message === "string"
        ? corpsErreur.message.replaceAll(apiKey, "[clé masquée]").slice(0, 240)
        : null;
    if (reponse.status === 401 || reponse.status === 403) {
      throw new ErreurCotes(
        messageApi
          ? `Accès The Odds API refusé : ${messageApi}`
          : "La clé The Odds API est invalide ou ne permet pas cet accès.",
        502
      );
    }
    if (reponse.status === 429) {
      throw new ErreurCotes(
        "Le quota The Odds API est atteint. Réessaie après son renouvellement.",
        429
      );
    }
    throw new ErreurCotes(
      messageApi
        ? `The Odds API a renvoyé une erreur (HTTP ${reponse.status}) : ${messageApi}`
        : `The Odds API a renvoyé une erreur (HTTP ${reponse.status}).`,
      502
    );
  }

  const donnees: unknown = await reponse.json().catch(() => null);
  if (!Array.isArray(donnees) || !donnees.every(estEvenementApi)) {
    throw new ErreurCotes("The Odds API a renvoyé un JSON invalide.", 502);
  }

  return { evenements: donnees, recupereLe: new Date().toISOString() };
}

function dateEnFrance(date: Date): string {
  const morceaux = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valeur = (type: string) =>
    morceaux.find((morceau) => morceau.type === type)?.value ?? "";
  return `${valeur("year")}-${valeur("month")}-${valeur("day")}`;
}

function dateValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && Number.isFinite(Date.parse(valeur));
}

function normaliserEvenement(
  evenement: unknown,
  competition: Competition,
  dateDuJour: string,
  maintenant: number
): MatchCotes | null {
  if (!estObjet(evenement)) return null;

  const event = evenement as unknown as EvenementApi;
  if (
    typeof event.id !== "string" ||
    typeof event.home_team !== "string" ||
    typeof event.away_team !== "string" ||
    !dateValide(event.commence_time) ||
    dateEnFrance(new Date(event.commence_time)) !== dateDuJour ||
    !Array.isArray(event.bookmakers)
  ) {
    return null;
  }

  const selections = event.bookmakers.flatMap((bookmaker) => {
    if (!estObjet(bookmaker) || typeof bookmaker.key !== "string" || typeof bookmaker.title !== "string" || !Array.isArray(bookmaker.markets)) return [];
    return bookmaker.markets.flatMap((market) => {
      if (!estObjet(market) || typeof market.key !== "string" || !Array.isArray(market.outcomes)) return [];
      const miseAJour = market.last_update ?? bookmaker.last_update;
      if (!dateValide(miseAJour)) return [];
      const miseAJourLe = miseAJour;
      const dateMiseAJour = Date.parse(miseAJourLe);
      if (maintenant - dateMiseAJour > AGE_MAX_COTES_MS || dateMiseAJour > maintenant + 60_000) return [];
      const nomMarche: Record<string, string> = {
        h2h: "Résultat du match (1N2)",
        totals: "Total de buts",
        btts: "Les deux équipes marquent",
        spreads: "Handicap",
      };
      return market.outcomes.flatMap((valeur) => {
        if (!estObjet(valeur) || typeof valeur.name !== "string" || typeof valeur.price !== "number" || !Number.isFinite(valeur.price) || valeur.price <= 1) return [];
        const details = typeof valeur.point === "number" ? ` ${valeur.point > 0 ? "+" : ""}${valeur.point}` : "";
        return [{
          id: `${event.id}:${bookmaker.key}:${market.key}:${valeur.name}:${details}`,
          bookmakerKey: bookmaker.key,
          bookmaker: bookmaker.title,
          marketKey: market.key,
          market: `${nomMarche[market.key] ?? market.key}${details}`,
          selection: valeur.name === "Draw" || valeur.name === "The Draw" ? "Nul" : valeur.name,
          cote: valeur.price,
          miseAJourLe,
        }];
      });
    });
  });

  if (selections.length < 2) return null;

  return {
    id: event.id,
    match: `${event.home_team} - ${event.away_team}`,
    equipe_domicile: event.home_team,
    equipe_exterieure: event.away_team,
    competition: competition.title,
    competitionKey: competition.key,
    coupEnvoi: event.commence_time,
    selections,
  };
}

export async function recupererMatchsAvecCotes(): Promise<SnapshotCotes> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) {
    throw new ErreurCotes(
      "La variable serveur THE_ODDS_API_KEY n'est pas configurée.",
      500
    );
  }

  const date = dateEnFrance(new Date());
  const resultats = await Promise.allSettled(
    COMPETITIONS.map(async (competition) => ({
      competition,
      donnees: await recupererEvenementsCaches(competition.key, apiKey),
    }))
  );

  const reussitesSansControleAge = resultats.flatMap((resultat) =>
    resultat.status === "fulfilled" ? [resultat.value] : []
  );
  const echecs = resultats.flatMap((resultat) =>
    resultat.status === "rejected" ? [resultat.reason] : []
  );

  const maintenant = Date.now();
  const reussites = reussitesSansControleAge.filter(
    ({ donnees }) => maintenant - Date.parse(donnees.recupereLe) <= AGE_MAX_CATALOGUE_MS
  );
  const cataloguesPerimes = reussitesSansControleAge.length - reussites.length;

  if (reussites.length === 0 && echecs.length > 0) {
    const erreur = echecs[0];
    if (erreur instanceof ErreurCotes) throw erreur;
    throw new ErreurCotes(
      erreur instanceof Error
        ? `Échec inattendu pendant l'appel à The Odds API (${erreur.name}).`
        : "The Odds API a échoué sans fournir de détail exploitable.",
      502
    );
  }
  if (reussites.length === 0 && cataloguesPerimes > 0) {
    throw new ErreurCotes(
      "Les dernières données de cotes ont plus de 10 minutes et n'ont pas été réutilisées. Réessaie dans un instant.",
      503
    );
  }

  const matchs = reussites.flatMap(({ competition, donnees }) =>
    donnees.evenements
      .map((evenement) =>
        normaliserEvenement(evenement, competition, date, maintenant)
      )
      .filter((match): match is MatchCotes => match !== null)
  );
  const uniques = Array.from(new Map(matchs.map((match) => [match.id, match])).values());

  if (uniques.length === 0) {
    if (echecs.length > 0) {
      const premiereErreur = echecs[0];
      if (premiereErreur instanceof ErreurCotes) throw premiereErreur;
    }
    throw new ErreurCotes(
      `Aucun match du ${date} avec des cotes récentes n'est disponible dans les compétitions suivies.`,
      404
    );
  }

  const avertissements = echecs.map((erreur) =>
    erreur instanceof Error
      ? `Certaines compétitions n'ont pas pu être chargées : ${erreur.message}`
      : "Certaines compétitions n'ont pas pu être chargées."
  );
  if (cataloguesPerimes > 0) {
    avertissements.push(
      "Les données de certaines compétitions dépassaient 10 minutes et ont été écartées. Actualise les cotes."
    );
  }

  const recupereLe = reussites.reduce((plusRecent, { donnees }) =>
    Date.parse(donnees.recupereLe) > Date.parse(plusRecent)
      ? donnees.recupereLe
      : plusRecent,
  reussites[0].donnees.recupereLe);

  return {
    source: "The Odds API",
    recupereLe,
    date,
    nombreMatchs: uniques.length,
    avertissements,
    matchs: uniques,
  };
}
