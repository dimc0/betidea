import Link from "next/link";
import { notFound } from "next/navigation";
import DetailMatch from "@/components/DetailMatch";
import type { AnalyseEnregistree } from "@/lib/affiche";
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
    .select("id, match, statistiques, analyse, created_at")
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
          <DetailMatch resultat={analyse} />
        </div>
      </div>
    </main>
  );
}
