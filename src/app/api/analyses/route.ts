
import type { Affiche } from "@/lib/affiche";
import { genererAnalyse } from "@/lib/generer-analyse";
import { ErreurIA } from "@/lib/ia";

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

  if (
    typeof body !== "object" ||
    body === null
  ) {
    return Response.json(
      { erreur: "Les données envoyées sont invalides." },
      { status: 400 }
    );
  }

  const donnees = body as Record<string, unknown>;

  const sport = donnees.sport;
  const equipe_dom =
    typeof donnees.equipe_dom === "string"
      ? donnees.equipe_dom.trim()
      : "";
  const equipe_ext =
    typeof donnees.equipe_ext === "string"
      ? donnees.equipe_ext.trim()
      : "";
  const competition =
    typeof donnees.competition === "string"
      ? donnees.competition.trim()
      : "";
  const date_match =
    typeof donnees.date_match === "string"
      ? donnees.date_match.trim()
      : "";

  if (sport !== "football") {
    return Response.json(
      { erreur: "Seul le football est pris en charge." },
      { status: 400 }
    );
  }

  if (
    !equipe_dom ||
    !equipe_ext ||
    !competition ||
    !date_match
  ) {
    return Response.json(
      { erreur: "Tous les champs obligatoires doivent être remplis." },
      { status: 400 }
    );
  }

  if (
    equipe_dom.length > 150 ||
    equipe_ext.length > 150 ||
    competition.length > 150
  ) {
    return Response.json(
      {
        erreur:
          "Les participants et la compétition sont limités à 150 caractères.",
      },
      { status: 400 }
    );
  }

  if (
    donnees.contexte !== undefined &&
    typeof donnees.contexte !== "string"
  ) {
    return Response.json(
      { erreur: "Le contexte doit être du texte." },
      { status: 400 }
    );
  }

  const contexte =
    typeof donnees.contexte === "string"
      ? donnees.contexte.trim()
      : "";

  if (contexte.length > 2000) {
    return Response.json(
      { erreur: "Le contexte est limité à 2000 caractères." },
      { status: 400 }
    );
  }

  const date = new Date(`${date_match}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date_match) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== date_match
  ) {
    return Response.json(
      { erreur: "La date de la rencontre est invalide." },
      { status: 400 }
    );
  }

  const affiche: Affiche = {
    sport,
    equipe_dom,
    equipe_ext,
    competition,
    date_match,
    contexte,
  };

  try {
    const analyse = await genererAnalyse(affiche);

    return Response.json({
      message: "Analyse générée.",
      affiche,
      analyse: {
        statut: "prete",
        ...analyse,
      },
    });
  } catch (erreur) {
    if (
      erreur instanceof ErreurIA &&
      erreur.status === 429
    ) {
      return Response.json(
        {
          erreur:
            "Le quota du service d'IA est atteint. Réessayez plus tard.",
        },
        { status: 429 }
      );
    }

    if (
      erreur instanceof ErreurIA &&
      erreur.status === 413
    ) {
      return Response.json(
        { erreur: "La demande est trop volumineuse." },
        { status: 413 }
      );
    }

    if (
      erreur instanceof Error &&
      erreur.name === "TimeoutError"
    ) {
      return Response.json(
        {
          erreur:
            "Le service d'IA met trop de temps à répondre. Réessayez plus tard.",
        },
        { status: 504 }
      );
    }

    console.error("Échec de l'analyse Betidea.");

    return Response.json(
      {
        erreur:
          "La génération de l'analyse a échoué. Réessayez plus tard.",
      },
      {
        status:
          erreur instanceof ErreurIA &&
          erreur.status === 500
            ? 500
            : 502,
      }
    );
  }
}
