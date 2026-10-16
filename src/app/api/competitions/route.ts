import { connection } from "next/server";
import { recupererCompetitions, reponseErreurFootball } from "@/lib/football/api-football";

// Compétitions suivies et leurs saisons terminées, telles que renvoyées par API-Football.
export async function GET() {
  // Exécution à chaque requête (jamais au build) : connection() doit rester hors du try,
  // car Next.js s'en sert pour interrompre le pré-rendu.
  await connection();

  try {
    const resultat = await recupererCompetitions();
    return Response.json(resultat);
  } catch (erreur) {
    return reponseErreurFootball(erreur);
  }
}
