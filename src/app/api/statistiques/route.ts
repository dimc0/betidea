import type { NextRequest } from "next/server";
import {
  recupererStatistiquesMatch,
  reponseErreurFootball,
  trouverMatch,
} from "@/lib/football/api-football";
import { lireEntierPositif } from "@/lib/football/normalisation";

// Statistiques d'un match terminé. Le match est d'abord retrouvé dans sa saison
// pour associer chaque valeur à la bonne équipe (domicile / extérieur).
export async function GET(request: NextRequest) {
  const parametres = request.nextUrl.searchParams;
  const competition = lireEntierPositif(parametres.get("competition"));
  const saison = lireEntierPositif(parametres.get("saison"));
  const matchId = lireEntierPositif(parametres.get("match"));

  if (!competition || !saison || !matchId) {
    return Response.json(
      { erreur: "Les paramètres « competition », « saison » et « match » sont obligatoires." },
      { status: 400 }
    );
  }

  try {
    const { match } = await trouverMatch(competition, saison, matchId);
    const statistiques = await recupererStatistiquesMatch(match);
    return Response.json({ statistiques });
  } catch (erreur) {
    return reponseErreurFootball(erreur);
  }
}
