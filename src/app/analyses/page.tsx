import Link from "next/link";
import { connection } from "next/server";
import type { AnalyseEnregistree } from "@/lib/affiche";
import { formaterDate } from "@/lib/football/metier";
import { creerClientSupabase } from "@/lib/supabase";

export default async function ListeAnalyses() {
  // Équivalent de « force-dynamic » avec cacheComponents : la page est
  // recalculée à chaque visite pour afficher l'état actuel de la base.
  await connection();

  const supabase = creerClientSupabase();
  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, match, created_at")
    .order("created_at", { ascending: false })
    .returns<Pick<AnalyseEnregistree, "id" | "match" | "created_at">[]>();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mes analyses</h1>
          <Link href="/" className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950">
            Nouvelle analyse
          </Link>
        </div>

        {error && <p className="mt-6 text-rose-300">Impossible de charger les analyses.</p>}

        {analyses && analyses.length === 0 && (
          <p className="mt-6 text-slate-400">Aucune analyse pour l’instant.</p>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {analyses?.map(({ id, match, created_at }) => (
            <li key={id}>
              <Link
                href={`/analyses/${id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-emerald-400"
              >
                <p className="font-semibold">
                  {match.domicile.nom} {match.butsDomicile} - {match.butsExterieur} {match.exterieur.nom}
                </p>
                <p className="text-sm text-slate-500">
                  Match du {formaterDate(match.date)} · analysé le {formaterDate(created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
