import Link from "next/link";
import { connection } from "next/server";
import type { AnalyseEnregistree } from "@/lib/affiche";
import { formaterDate } from "@/lib/football/metier";
import { creerClientSupabase } from "@/lib/supabase";

const NOMS_PERSPECTIVES = {
  retrospective: "Rétrospective",
  avant_match: "Avant le match",
};

export default async function ListeAnalyses() {
  // Équivalent de « force-dynamic » avec cacheComponents : la page est
  // recalculée à chaque visite, pour afficher l'état actuel de la base.
  await connection();

  const supabase = creerClientSupabase();
  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, match, perspective, question, created_at")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Omit<AnalyseEnregistree, "analyse">[]>();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold">Mes analyses</h1>
          <Link
            href="/"
            className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
          >
            Nouvelle analyse
          </Link>
        </div>

        {error && (
          <p className="mt-6 text-rose-300">Impossible de charger les analyses.</p>
        )}

        {analyses && analyses.length === 0 && (
          <p className="mt-6 text-slate-400">Aucune analyse pour l’instant.</p>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {analyses?.map((analyse) => (
            <li key={analyse.id}>
              <Link
                href={`/analyses/${analyse.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-emerald-400"
              >
                <p className="font-semibold">
                  {analyse.match.equipe_dom.nom} {analyse.match.score.dom} - {analyse.match.score.ext}{" "}
                  {analyse.match.equipe_ext.nom}
                </p>
                <p className="mt-1 text-sm text-slate-300">{analyse.question}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {analyse.match.competition} · {NOMS_PERSPECTIVES[analyse.perspective]} · créée le{" "}
                  {formaterDate(analyse.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
