import type { Statistique } from "@/lib/affiche";
import { ErreurFootball, recupererMatchs, recupererStatistiques } from "@/lib/football/api-football";
import { formeAvantMatch } from "@/lib/football/metier";
import { genererAnalyse } from "@/lib/generer-analyse";
import { ErreurIA } from "@/lib/ia";
import { creerClientServeur } from "@/lib/supabase/server";

export const maxDuration = 120;

const COLONNES = "id, match, statistiques, analyse, created_at";

// Analyse d'un match : { saison: 2023, match: 1234 }
export async function POST(request: Request) {
  // 0. Vérification de la session : rien n'est fait (ni quota API-Football, ni IA) pour un visiteur
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { erreur: "Votre session a expiré. Reconnectez-vous pour analyser un match." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const saison = Number(body?.saison);
  const matchId = Number(body?.match);

  if (!Number.isInteger(saison) || !Number.isInteger(matchId)) {
    return Response.json({ erreur: "La saison et le match sont obligatoires." }, { status: 400 });
  }

  // 1. Si l'utilisateur a déjà analysé ce match, on renvoie son analyse (pas de nouvel appel à l'IA).
  // Pas besoin de filtrer par user_id : la Row Level Security ne renvoie que ses analyses.
  const { data: existante } = await supabase
    .from("analyses")
    .select(COLONNES)
    .eq("match_id", matchId)
    .maybeSingle();

  if (existante) {
    return Response.json(existante);
  }

  // 2. Données du match, toujours relues depuis API-Football (jamais depuis le navigateur)
  let donnees;
  try {
    const matchs = await recupererMatchs(saison);
    const match = matchs.find((element) => element.id === matchId);
    if (!match) {
      return Response.json({ erreur: "Ce match est introuvable dans cette saison." }, { status: 404 });
    }

    // Sans statistiques, l'analyse reste possible avec le score et la forme des équipes.
    let statistiques: Statistique[] = [];
    try {
      statistiques = await recupererStatistiques(match);
    } catch (erreur) {
      console.warn("Statistiques indisponibles :", erreur);
    }

    donnees = {
      match,
      statistiques,
      formeDomicile: formeAvantMatch(matchs, match, match.domicile.id),
      formeExterieur: formeAvantMatch(matchs, match, match.exterieur.id),
    };
  } catch (erreur) {
    if (erreur instanceof ErreurFootball) {
      return Response.json({ erreur: erreur.message }, { status: erreur.status });
    }
    console.error(erreur);
    return Response.json({ erreur: "Les données du match n'ont pas pu être récupérées." }, { status: 502 });
  }

  // 3. Analyse par le modèle d'IA
  let analyse;
  try {
    analyse = await genererAnalyse(donnees);
  } catch (erreur) {
    return reponseErreurIA(erreur);
  }

  // 4. Enregistrement dans Supabase, au nom de l'utilisateur connecté (user_id = auth.uid() par défaut)
  const { data, error } = await supabase
    .from("analyses")
    .insert({
      match_id: matchId,
      saison,
      match: donnees.match,
      statistiques: donnees.statistiques,
      analyse,
      modele: process.env.AI_MODEL || "openai/gpt-oss-20b",
    })
    .select(COLONNES)
    .single();

  if (error) {
    console.error("Erreur lors de l'enregistrement de l'analyse :", error);
    return Response.json(
      { erreur: "L'analyse a été générée mais n'a pas pu être enregistrée. Réessayez plus tard." },
      { status: 500 }
    );
  }

  return Response.json(data, { status: 201 });
}

function reponseErreurIA(erreur: unknown) {
  if (erreur instanceof ErreurIA && erreur.status === 429) {
    return Response.json(
      { erreur: "Le quota du service d'IA est atteint. Réessayez dans quelques instants." },
      { status: 429 }
    );
  }

  if (erreur instanceof Error && erreur.name === "TimeoutError") {
    return Response.json(
      { erreur: "Le service d'IA met trop de temps à répondre. Réessayez plus tard." },
      { status: 504 }
    );
  }

  console.error(erreur);
  return Response.json(
    { erreur: "La génération de l'analyse a échoué. Réessayez plus tard." },
    { status: 502 }
  );
}
