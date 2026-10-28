import { ErreurFootball, recupererMatchs } from "@/lib/football/football-data";
import { limiteurAnalyses } from "@/lib/limitation";
import { publierGeneration } from "@/lib/qstash";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { creerClientServeur } from "@/lib/supabase/server";

const COLONNES = "id, match, statistiques, analyse, created_at, statut, message_erreur";

// Demande d'analyse d'un match : { saison: 2023, match: 1234 }
export async function POST(request: Request) {
  // 0. Vérification de la session : rien n'est fait (ni requête football-data.org, ni IA) pour un visiteur
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

  // 1. Si l'utilisateur a déjà demandé ce match, on renvoie sa demande (prête ou en cours).
  // Pas besoin de filtrer par user_id : la Row Level Security ne renvoie que ses analyses.
  // Seule une analyse en échec est relancée.
  const { data: existante } = await supabase
    .from("analyses")
    .select(COLONNES)
    .eq("match_id", matchId)
    .maybeSingle();

  if (existante && existante.statut !== "erreur") {
    return Response.json(existante);
  }

  // 2. Vérification du quota de l'utilisateur, avant les ressources coûteuses (football-data.org et IA).
  // Relire une analyse déjà enregistrée (étape 1) ne consomme pas de quota.
  const enTetesQuota: Record<string, string> = {};

  try {
    const quota = await limiteurAnalyses.limit(user.id);

    enTetesQuota["X-RateLimit-Limit"] = String(quota.limit);
    enTetesQuota["X-RateLimit-Remaining"] = String(quota.remaining);

    if (!quota.success) {
      const secondes = Math.max(1, Math.ceil((quota.reset - Date.now()) / 1000));
      const minutes = Math.ceil(secondes / 60);

      return Response.json(
        {
          erreur: `Vous avez atteint votre quota de ${quota.limit} analyses par heure. Réessayez dans ${minutes} minute(s).`,
        },
        { status: 429, headers: { ...enTetesQuota, "Retry-After": String(secondes) } }
      );
    }
  } catch (erreur) {
    // Si Redis est indisponible, on laisse passer la requête plutôt que de bloquer
    // tous les utilisateurs : c'est un choix « fail open ».
    console.error("Limitation de débit indisponible :", erreur);
  }

  // 3. Enregistrement de la demande, avec le statut « en attente »
  let analyseId: string;

  if (existante) {
    // Relance d'une analyse en échec. La Row Level Security n'autorise pas l'utilisateur à modifier
    // ses analyses : le statut est un champ géré par le système, d'où le client administrateur.
    const { error } = await creerClientAdmin()
      .from("analyses")
      .update({ statut: "en_attente", message_erreur: null })
      .eq("id", existante.id);

    if (error) {
      console.error("Erreur lors de la relance de l'analyse :", error);
      return reponseErreurEnregistrement();
    }
    analyseId = existante.id;
  } else {
    // Le match est relu dans football-data.org (en cache) : une demande pour un match inexistant
    // est refusée immédiatement, sans rien enregistrer.
    let match;
    try {
      const matchs = await recupererMatchs(saison);
      match = matchs.find((element) => element.id === matchId);
    } catch (erreur) {
      return reponseErreurFootball(erreur);
    }

    if (!match) {
      return Response.json({ erreur: "Ce match est introuvable dans cette saison." }, { status: 404 });
    }

    // user_id = auth.uid() par défaut, statut = « en_attente » par défaut
    const { data, error } = await supabase
      .from("analyses")
      .insert({ match_id: matchId, saison, match })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Erreur lors de l'enregistrement de la demande :", error);
      return reponseErreurEnregistrement();
    }
    analyseId = data.id;
  }

  // 4. Publication du message de génération dans la file
  try {
    await publierGeneration(analyseId);
  } catch (erreur) {
    console.error("Erreur lors de la publication du message :", erreur);

    // Traitement système, sans utilisateur : usage légitime du client administrateur
    await creerClientAdmin()
      .from("analyses")
      .update({ statut: "erreur", message_erreur: "La génération n'a pas pu être lancée." })
      .eq("id", analyseId);

    return Response.json(
      { erreur: "La génération n'a pas pu être lancée. Réessayez plus tard." },
      { status: 503 }
    );
  }

  // 5. Réponse immédiate : la demande est acceptée, le traitement suivra
  return Response.json(
    { id: analyseId, statut: "en_attente" },
    { status: 202, headers: enTetesQuota }
  );
}

function reponseErreurEnregistrement() {
  return Response.json(
    { erreur: "La demande n'a pas pu être enregistrée. Réessayez plus tard." },
    { status: 500 }
  );
}

function reponseErreurFootball(erreur: unknown) {
  if (erreur instanceof ErreurFootball) {
    return Response.json({ erreur: erreur.message }, { status: erreur.status });
  }
  console.error(erreur);
  return Response.json({ erreur: "Les données du match n'ont pas pu être récupérées." }, { status: 502 });
}
