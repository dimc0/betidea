import type { NextRequest } from "next/server";
import { ErreurFootball, recupererMatchs } from "@/lib/football/api-football";

// Matchs terminés d'une saison passée : /api/matchs?saison=2023
export async function GET(request: NextRequest) {
  const saison = Number(request.nextUrl.searchParams.get("saison"));

  if (!Number.isInteger(saison) || saison < 1990 || saison >= new Date().getFullYear()) {
    return Response.json({ erreur: "La saison doit être une saison passée." }, { status: 400 });
  }

  try {
    const matchs = await recupererMatchs(saison);
    return Response.json({ matchs });
  } catch (erreur) {
    return reponseErreur(erreur);
  }
}

function reponseErreur(erreur: unknown) {
  if (erreur instanceof ErreurFootball) {
    return Response.json({ erreur: erreur.message }, { status: erreur.status });
  }
  console.error(erreur);
  return Response.json({ erreur: "Impossible de charger les matchs." }, { status: 502 });
}
