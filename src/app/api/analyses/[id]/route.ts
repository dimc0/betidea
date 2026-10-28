import { connection } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";

// État d'une analyse, interrogé régulièrement par le front (polling)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Exécution à chaque requête, jamais servie depuis un cache (hors du try : Next.js s'en sert).
  await connection();

  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ erreur: "Authentification requise." }, { status: 401 });
  }

  // Row Level Security : un utilisateur ne peut consulter que l'état de ses propres analyses
  // (et de leurs points clés, lus par jointure grâce à la clé étrangère analyse_id)
  const { data: analyse, error } = await supabase
    .from("analyses")
    .select("id, match, statistiques, analyse, created_at, statut, message_erreur, points_cles(position, texte)")
    .eq("id", id)
    .maybeSingle();

  if (error || !analyse) {
    return Response.json({ erreur: "Analyse introuvable." }, { status: 404 });
  }

  return Response.json(analyse);
}
