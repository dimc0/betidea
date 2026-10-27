import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import DetailMatch from "@/components/DetailMatch";
import type { AnalyseEnregistree } from "@/lib/affiche";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function DetailAnalyse({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Session lue à chaque requête (voir EnTete).
  await connection();

  const supabase = await creerClientServeur();
  const { data: analyse } = await supabase
    .from("analyses")
    .select("id, match, statistiques, analyse, created_at, statut, message_erreur")
    .eq("id", id)
    .maybeSingle<AnalyseEnregistree>();

  if (!analyse) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/analyses" className="text-emerald-300 underline">
          ← Retour à mes analyses
        </Link>
        <div className="mt-4">
          {analyse.statut === "prete" && <DetailMatch resultat={analyse} />}

          {analyse.statut === "en_attente" && (
            <p className="rounded-lg border border-amber-900 bg-amber-950/60 p-3 text-amber-200">
              L&apos;analyse de {analyse.match.domicile.nom} - {analyse.match.exterieur.nom} est en
              cours de génération. Rechargez la page dans quelques instants.
            </p>
          )}

          {analyse.statut === "erreur" && (
            <p className="rounded-lg border border-rose-900 bg-rose-950/60 p-3 text-rose-200">
              L&apos;analyse de {analyse.match.domicile.nom} - {analyse.match.exterieur.nom} a
              échoué : {analyse.message_erreur ?? "erreur inconnue"}. Relancez-la depuis l&apos;accueil.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
