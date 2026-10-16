// Logique métier de l'analyse historique : bilans d'équipe et séparation
// stricte entre ce qui était connu avant le match et ce qui s'est passé ensuite.
// Fonctions pures, utilisables côté serveur comme côté navigateur, testées sans réseau.
import type {
  Affiche,
  BilanEquipe,
  DonneesAnalyse,
  EquipeMatch,
  Perspective,
  ResultatEquipe,
  SaisonDisponible,
  StatistiqueMatch,
  StatistiquesMatch,
} from "@/lib/affiche";

function estAvant(match: Affiche, date: string): boolean {
  return Date.parse(match.date_match) < Date.parse(date);
}

function estApres(match: Affiche, date: string): boolean {
  return Date.parse(match.date_match) > Date.parse(date);
}

function joue(match: Affiche, equipeId: number): boolean {
  return match.equipe_dom.id === equipeId || match.equipe_ext.id === equipeId;
}

export function formaterDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function libelleSaison(saison: Pick<SaisonDisponible, "debut" | "fin">): string {
  const debut = saison.debut.slice(0, 4);
  const fin = saison.fin.slice(0, 4);
  return debut === fin ? debut : `${debut}/${fin}`;
}

export function resultatPour(match: Affiche, equipeId: number): ResultatEquipe {
  const domicile = match.equipe_dom.id === equipeId;
  const marques = domicile ? match.score.dom : match.score.ext;
  const encaisses = domicile ? match.score.ext : match.score.dom;
  if (marques > encaisses) return "V";
  if (marques < encaisses) return "D";
  return "N";
}

export function equipesDeLaSaison(matchs: Affiche[]): EquipeMatch[] {
  const equipes = new Map<number, EquipeMatch>();
  for (const match of matchs) {
    equipes.set(match.equipe_dom.id, match.equipe_dom);
    equipes.set(match.equipe_ext.id, match.equipe_ext);
  }
  return [...equipes.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

// Bilan d'une équipe sur les matchs fournis. Avec « avantLe », seuls les matchs
// joués strictement avant cette date sont comptés.
export function calculerBilan(
  matchs: Affiche[],
  equipeId: number,
  avantLe?: string
): BilanEquipe {
  const matchsEquipe = matchs
    .filter((match) => joue(match, equipeId))
    .filter((match) => !avantLe || estAvant(match, avantLe))
    .sort((a, b) => Date.parse(a.date_match) - Date.parse(b.date_match));

  const bilan: BilanEquipe = {
    equipe: "",
    joues: 0,
    victoires: 0,
    nuls: 0,
    defaites: 0,
    buts_marques: 0,
    buts_encaisses: 0,
    points: 0,
    forme: [],
  };

  for (const match of matchsEquipe) {
    const domicile = match.equipe_dom.id === equipeId;
    const resultat = resultatPour(match, equipeId);

    bilan.equipe = domicile ? match.equipe_dom.nom : match.equipe_ext.nom;
    bilan.joues += 1;
    bilan.buts_marques += domicile ? match.score.dom : match.score.ext;
    bilan.buts_encaisses += domicile ? match.score.ext : match.score.dom;
    if (resultat === "V") bilan.victoires += 1;
    if (resultat === "N") bilan.nuls += 1;
    if (resultat === "D") bilan.defaites += 1;
  }

  bilan.points = bilan.victoires * 3 + bilan.nuls;
  bilan.forme = matchsEquipe.slice(-5).map((match) => resultatPour(match, equipeId));
  return bilan;
}

// Une ligne courte et lisible par l'IA, du point de vue de l'équipe.
export function decrireMatchPourEquipe(match: Affiche, equipeId: number): string {
  const domicile = match.equipe_dom.id === equipeId;
  const adversaire = domicile ? match.equipe_ext.nom : match.equipe_dom.nom;
  const score = domicile
    ? `${match.score.dom}-${match.score.ext}`
    : `${match.score.ext}-${match.score.dom}`;

  return [
    match.date_match.slice(0, 10),
    match.journee,
    `${domicile ? "à domicile contre" : "à l'extérieur contre"} ${adversaire}`,
    score,
    resultatPour(match, equipeId),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function scoreFinal(match: Affiche): string {
  return `${match.equipe_dom.nom} ${match.score.dom}-${match.score.ext} ${match.equipe_ext.nom}`;
}

export function issueDuMatch(match: Affiche): string {
  const { score } = match;

  if (match.statut === "PEN" && score.tirs_au_but) {
    const vainqueur =
      score.tirs_au_but.dom > score.tirs_au_but.ext ? match.equipe_dom.nom : match.equipe_ext.nom;
    return `Égalité après prolongation, ${vainqueur} l'emporte aux tirs au but (${score.tirs_au_but.dom}-${score.tirs_au_but.ext}).`;
  }

  const prolongation = match.statut === "AET" ? " après prolongation" : "";
  if (score.dom === score.ext) return `Match nul${prolongation}.`;

  const vainqueur = score.dom > score.ext ? match.equipe_dom.nom : match.equipe_ext.nom;
  return `Victoire de ${vainqueur}${prolongation}.`;
}

// Construit l'objet typé envoyé à l'IA. En perspective « avant_match »,
// le score, les statistiques et tout match postérieur sont retirés ici,
// dans le code : l'IA ne peut pas les utiliser puisqu'elle ne les reçoit pas.
export function construireDonneesAnalyse(
  match: Affiche,
  matchsSaison: Affiche[],
  statistiques: StatistiquesMatch | null,
  perspective: Perspective
): DonneesAnalyse {
  const idDom = match.equipe_dom.id;
  const idExt = match.equipe_ext.id;
  const avant = matchsSaison.filter((element) => estAvant(element, match.date_match));
  const apres = matchsSaison.filter((element) => estApres(element, match.date_match));

  const derniersMatchs = (equipeId: number) =>
    avant
      .filter((element) => joue(element, equipeId))
      .slice(-10)
      .map((element) => decrireMatchPourEquipe(element, equipeId));

  const matchsSuivants = (equipeId: number) =>
    apres
      .filter((element) => joue(element, equipeId))
      .slice(0, 10)
      .map((element) => decrireMatchPourEquipe(element, equipeId));

  const donneesManquantes = [
    "Les bilans ne portent que sur cette compétition et cette saison : les autres compétitions, les blessures, les compositions et les transferts ne sont pas fournis.",
  ];

  if (perspective === "avant_match") {
    donneesManquantes.push(
      "Perspective avant le match : le score, les statistiques du match et les matchs postérieurs sont volontairement exclus."
    );
  } else if (!statistiques || !statistiques.disponibles) {
    donneesManquantes.push(
      "Les statistiques détaillées de ce match ne sont pas fournies par API-Football."
    );
  }

  if (perspective === "retrospective" && !match.score.mi_temps) {
    donneesManquantes.push("Le score à la mi-temps n'est pas fourni par API-Football.");
  }

  return {
    perspective,
    match: {
      competition: match.competition,
      saison: match.saison,
      journee: match.journee,
      date: match.date_match,
      stade: match.stade,
      arbitre: match.arbitre,
      equipe_domicile: match.equipe_dom.nom,
      equipe_exterieure: match.equipe_ext.nom,
    },
    avant_le_match: {
      bilan_domicile: calculerBilan(matchsSaison, idDom, match.date_match),
      bilan_exterieur: calculerBilan(matchsSaison, idExt, match.date_match),
      derniers_matchs_domicile: derniersMatchs(idDom),
      derniers_matchs_exterieur: derniersMatchs(idExt),
      confrontations_dans_la_saison: avant
        .filter((element) => joue(element, idDom) && joue(element, idExt))
        .map(scoreFinal),
    },
    le_match:
      perspective === "avant_match"
        ? null
        : {
            score_final: scoreFinal(match),
            score_mi_temps: match.score.mi_temps
              ? `${match.score.mi_temps.dom}-${match.score.mi_temps.ext}`
              : null,
            issue: issueDuMatch(match),
            statistiques: statistiques && statistiques.disponibles ? statistiques.lignes : null,
          },
    apres_le_match:
      perspective === "avant_match"
        ? null
        : {
            bilan_final_domicile: calculerBilan(matchsSaison, idDom),
            bilan_final_exterieur: calculerBilan(matchsSaison, idExt),
            matchs_suivants_domicile: matchsSuivants(idDom),
            matchs_suivants_exterieur: matchsSuivants(idExt),
          },
    donnees_manquantes: donneesManquantes,
  };
}

// L'IA ne renvoie que des noms de statistiques : les valeurs affichées sont
// reprises depuis les données d'API-Football. Un nom inconnu est ignoré.
export function filtrerStatistiquesCitees(
  types: string[],
  statistiques: StatistiqueMatch[] | null
): StatistiqueMatch[] {
  if (!statistiques) return [];
  const parType = new Map(statistiques.map((ligne) => [ligne.type, ligne]));

  return [...new Set(types)]
    .map((type) => parType.get(type))
    .filter((ligne): ligne is StatistiqueMatch => ligne !== undefined);
}
