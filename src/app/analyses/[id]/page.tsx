import Link from "next/link";
import { notFound } from "next/navigation";
import AffichageAnalyse from "@/components/AffichageAnalyse";
import type { AnalyseEnregistree } from "@/lib/affiche";
import { formaterDate } from "@/lib/football/metier";
import { creerClientSupabase } from "@/lib/supabase";

export default async function DetailAnalyse({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = creerClientSupabase();
  const { data: analyse } = await supabase
    .from("analyses")
    .select("id, match, perspective, question, analyse, created_at")
    .eq("id", id)
    .maybeSingle<AnalyseEnregistree>();

  if (!analyse) {
    notFound();
  }

  const { match } = analyse;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/analyses" className="text-emerald-300 underline">
          ← Retour à mes analyses
        </Link>

        <h1 className="mt-4 text-2xl font-bold">
          {match.equipe_dom.nom} {match.score.dom} - {match.score.ext} {match.equipe_ext.nom}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {match.competition} · match du {formaterDate(match.date_match)} · analyse créée le{" "}
          {formaterDate(analyse.created_at)}
        </p>

        <div className="mt-6">
          <AffichageAnalyse resultat={analyse} />
        </div>
      </div>
    </main>
  );
}
