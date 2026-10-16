import { LIMITES, type EchangeQuestion, type Perspective, type StatistiquesMatch } from "@/lib/affiche";
import {
  ErreurFootball,
  recupererStatistiquesMatch,
  trouverMatch,
} from "@/lib/football/api-football";
import { construireDonneesAnalyse } from "@/lib/football/metier";
import { genererAnalyse } from "@/lib/generer-analyse";
import { ErreurIA } from "@/lib/ia";
import { consommerOperation, LIMITE_ANALYSES_PAR_HEURE } from "@/lib/limite";

export const maxDuration = 180;

function lireHistorique(valeur: unknown): EchangeQuestion[] | null {
  if (valeur === undefined) return [];
  if (!Array.isArray(valeur) || valeur.length > LIMITES.echangesMax) return null;

  const historique: EchangeQuestion[] = [];
  for (const element of valeur) {
    if (
      typeof element !== "object" ||
      element === null ||
      typeof element.question !== "string" ||
      typeof element.reponse !== "string" ||
      element.question.length > LIMITES.questionMax ||
      element.reponse.length > LIMITES.reponseMax
    ) {
      return null;
    }
    historique.push({ question: element.question, reponse: element.reponse });
  }
  return historique;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { erreur: "Les données envoyées ne sont pas un JSON valide." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ erreur: "Les données envoyées sont invalides." }, { status: 400 });
  }

  const donnees = body as Record<string, unknown>;
  const question = typeof donnees.question === "string" ? donnees.question.trim() : "";
  const perspective = donnees.perspective;
  const historique = lireHistorique(donnees.historique);
  const { competition, saison, match } = donnees;

  if (
    !Number.isInteger(competition) ||
    !Number.isInteger(saison) ||
    !Number.isInteger(match)
  ) {
    return Response.json(
      { erreur: "La compétition, la saison et le match sont obligatoires." },
      { status: 400 }
    );
  }

  if (!question || question.length > LIMITES.questionMax) {
    return Response.json(
      { erreur: `La question est obligatoire (${LIMITES.questionMax} caractères maximum).` },
      { status: 400 }
    );
  }

  if (perspective !== "retrospective" && perspective !== "avant_match") {
    return Response.json({ erreur: "La perspective d'analyse est invalide." }, { status: 400 });
  }

  if (!historique) {
    return Response.json(
      { erreur: `L'historique est limité à ${LIMITES.echangesMax} échanges.` },
      { status: 400 }
    );
  }

  const delaiRestant = consommerOperation(request);
  if (delaiRestant !== null) {
    return Response.json(
      { erreur: `Limite atteinte : ${LIMITE_ANALYSES_PAR_HEURE} analyses par heure.` },
      { status: 429, headers: { "Retry-After": String(delaiRestant) } }
    );
  }

  // 1. Données du match : uniquement depuis API-Football, jamais depuis le navigateur
  let donneesAnalyse;
  let matchTrouve;
  try {
    const resultat = await trouverMatch(competition as number, saison as number, match as number);
    matchTrouve = resultat.match;

    let statistiques: StatistiquesMatch | null = null;
    if (perspective === "retrospective") {
      try {
        statistiques = await recupererStatistiquesMatch(matchTrouve);
      } catch (erreur) {
        // Sans statistiques, l'analyse reste possible avec le score et les bilans.
        console.warn("Statistiques indisponibles pour l'analyse :", erreur);
      }
    }

    donneesAnalyse = construireDonneesAnalyse(
      matchTrouve,
      resultat.matchsSaison,
      statistiques,
      perspective as Perspective
    );
  } catch (erreur) {
    if (erreur instanceof ErreurFootball) {
      return Response.json({ erreur: erreur.message }, { status: erreur.status });
    }
    console.error(erreur);
    return Response.json(
      { erreur: "Les données du match n'ont pas pu être récupérées. Réessayez plus tard." },
      { status: 502 }
    );
  }

  // 2. Analyse par le modèle d'IA
  try {
    const analyse = await genererAnalyse(donneesAnalyse, question, historique);
    return Response.json({ match: matchTrouve, perspective, question, analyse });
  } catch (erreur) {
    return reponseErreur(erreur);
  }
}

function reponseErreur(erreur: unknown) {
  if (erreur instanceof ErreurIA && erreur.status === 429) {
    return Response.json(
      { erreur: "Le quota du service d'IA est atteint. Réessayez dans quelques instants." },
      { status: 429 }
    );
  }

  if (erreur instanceof ErreurIA && erreur.status === 413) {
    return Response.json(
      { erreur: "Les données du match sont trop volumineuses pour le service d'IA." },
      { status: 413 }
    );
  }

  if (
    (erreur instanceof ErreurIA && erreur.status === 504) ||
    (erreur instanceof Error && erreur.name === "TimeoutError")
  ) {
    return Response.json(
      { erreur: "Le service d'IA met trop de temps à répondre. Réessayez plus tard." },
      { status: 504 }
    );
  }

  if (erreur instanceof ErreurIA && erreur.status === 502) {
    return Response.json(
      { erreur: "Le modèle a renvoyé une analyse mal formée, elle n'a pas été affichée. Réessayez." },
      { status: 502 }
    );
  }

  console.error(erreur);
  return Response.json(
    { erreur: "La génération de l'analyse a échoué. Réessayez plus tard." },
    { status: 502 }
  );
}
