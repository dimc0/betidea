import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import type { Match, Statistique } from "@/lib/affiche";
import { ErreurFootball, recupererMatchs, recupererStatistiques } from "@/lib/football/football-data";
import { formeAvantMatch } from "@/lib/football/metier";
import { genererAnalyse } from "@/lib/generer-analyse";
import { ErreurIA, messageErreurIA } from "@/lib/ia";
import { NOMBRE_REESSAIS } from "@/lib/qstash";
import { creerClientAdmin } from "@/lib/supabase/admin";

// L'IA peut mettre jusqu'à 60 s par tentative (2 tentatives internes dans genererAnalyse)
export const maxDuration = 120;

function estReessayable(erreur: unknown): boolean {
  if (erreur instanceof ErreurIA) {
    return erreur.status === 429 || erreur.status >= 500;
  }
  if (erreur instanceof ErreurFootball) {
    // Quota par minute ou service injoignable : passager. Clé refusée, offre, compte suspendu : définitif.
    return erreur.status === 429 || erreur.status === 503;
  }
  // Panne réseau ou erreur inattendue : une nouvelle tentative peut réussir
  return true;
}

function messageErreur(erreur: unknown): string {
  return erreur instanceof ErreurFootball ? erreur.message : messageErreurIA(erreur);
}

async function traiter(request: Request) {
  const { analyseId } = await request.json();
  const tentative = Number(request.headers.get("Upstash-Retried") ?? "0");

  // Le worker n'a pas d'utilisateur connecté : il utilise le client administrateur
  const supabase = creerClientAdmin();

  const { data: demande } = await supabase
    .from("analyses")
    .select("id, saison, match, statut, user_id")
    .eq("id", analyseId)
    .maybeSingle<{ id: string; saison: number; match: Match; statut: string; user_id: string }>();

  // Idempotence : une analyse absente ou déjà traitée n'est pas générée une seconde fois
  if (!demande || demande.statut !== "en_attente") {
    return Response.json({ resultat: "ignoré" });
  }

  try {
    const { match, saison } = demande;
    const matchs = await recupererMatchs(saison);

    // Sans statistiques, l'analyse reste possible avec le score et la forme des équipes.
    let statistiques: Statistique[] = [];
    try {
      statistiques = await recupererStatistiques(match);
    } catch (erreur) {
      console.warn("Statistiques indisponibles :", erreur);
    }

    const analyse = await genererAnalyse({
      match,
      statistiques,
      formeDomicile: formeAvantMatch(matchs, match, match.domicile.id),
      formeExterieur: formeAvantMatch(matchs, match, match.exterieur.id),
    });

    // Les points clés vont dans leur propre table, le reste de l'analyse dans la colonne jsonb.
    // Ils sont enregistrés AVANT le passage à « prete » : le front les relit dès qu'il voit ce statut.
    const { points_cles, ...texteAnalyse } = analyse;

    // Relance d'une analyse en échec : on efface d'éventuels points d'une tentative précédente
    await supabase.from("points_cles").delete().eq("analyse_id", demande.id);

    if (points_cles.length > 0) {
      const { error } = await supabase.from("points_cles").insert(
        points_cles.map((texte, index) => ({
          analyse_id: demande.id,
          user_id: demande.user_id, // le worker n'a pas de session : l'auteur est celui de l'analyse
          position: index + 1,
          texte,
        }))
      );
      if (error) throw new Error(`Enregistrement des points clés impossible : ${error.message}`);
    }

    await supabase
      .from("analyses")
      .update({
        statistiques,
        analyse: texteAnalyse,
        modele: process.env.AI_MODEL || "openai/gpt-oss-20b",
        statut: "prete",
      })
      .eq("id", demande.id);

    return Response.json({ resultat: "prête" });
  } catch (erreur) {
    console.error(`Échec de la génération (tentative ${tentative + 1}) :`, erreur);

    // Erreur passagère et tentatives restantes : on demande à QStash de réessayer
    if (estReessayable(erreur) && tentative < NOMBRE_REESSAIS) {
      return Response.json({ resultat: "nouvelle tentative" }, { status: 500 });
    }

    // Erreur définitive ou dernière tentative : on enregistre l'échec
    await supabase
      .from("analyses")
      .update({ statut: "erreur", message_erreur: messageErreur(erreur) })
      .eq("id", demande.id);

    return Response.json({ resultat: "erreur" });
  }
}

export const POST = verifySignatureAppRouter(traiter);
