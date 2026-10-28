import { connection } from "next/server";
import { COMPETITION, ErreurFootball, recupererSaisons } from "@/lib/football/football-data";

// Saisons terminées de la compétition, lues dans football-data.org.
export async function GET() {
  // Exécution à chaque requête, jamais au build (hors du try : Next.js s'en sert).
  await connection();

  try {
    const saisons = await recupererSaisons();
    return Response.json({ competition: COMPETITION.nom, saisons });
  } catch (erreur) {
    return reponseErreur(erreur);
  }
}

function reponseErreur(erreur: unknown) {
  if (erreur instanceof ErreurFootball) {
    return Response.json({ erreur: erreur.message }, { status: erreur.status });
  }
  console.error(erreur);
  return Response.json({ erreur: "Impossible de charger les saisons." }, { status: 502 });
}
