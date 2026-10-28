import type { AnalyseEnregistree, PointCle } from "@/lib/affiche";

export default function AffichageAnalyse({
  analyse,
  points,
}: {
  analyse: AnalyseEnregistree["analyse"];
  points: PointCle[];
}) {
  // Les lignes de la table points_cles arrivent sans ordre garanti : on les trie par position
  const pointsTries = [...points].sort((a, b) => a.position - b.position);

  return (
    <article className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-5">
      <p className="text-xs uppercase tracking-wide text-emerald-400">Analyse de l&apos;IA</p>
      <h3 className="mt-1 text-xl font-bold">{analyse.titre}</h3>
      <p className="mt-2 whitespace-pre-line text-slate-200">{analyse.resume}</p>

      {pointsTries.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-slate-300">
          {pointsTries.map((point) => (
            <li key={point.position}>{point.texte}</li>
          ))}
        </ul>
      )}

      {analyse.limites.length > 0 && (
        <p className="mt-4 text-sm text-amber-200/80">
          <strong>Limites :</strong> {analyse.limites.join(" ")}
        </p>
      )}
    </article>
  );
}
