import type { NextRequest } from "next/server";
import { recupererMatchsTermines, reponseErreurFootball } from "@/lib/football/api-football";
import { lireEntierPositif } from "@/lib/football/normalisation";

// Matchs terminés d'une compétition pour une saison passée.
export async function GET(request: NextRequest) {
  const competition = lireEntierPositif(request.nextUrl.searchParams.get("competition"));
  const saison = lireEntierPositif(request.nextUrl.searchParams.get("saison"));

  if (!competition || !saison) {
    return Response.json(
      { erreur: "Les paramètres « competition » et « saison » sont obligatoires." },
      { status: 400 }
    );
  }

  if (saison >= new Date().getFullYear()) {
    return Response.json(
      { erreur: "Betidea n'analyse que des saisons passées." },
      { status: 400 }
    );
  }

  try {
    const matchs = await recupererMatchsTermines(competition, saison);
    return Response.json({ matchs });
  } catch (erreur) {
    return reponseErreurFootball(erreur);
  }
}
