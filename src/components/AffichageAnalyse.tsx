import TableauStatistiques from "@/components/TableauStatistiques";
import type { ResultatAnalyse } from "@/lib/affiche";

const NOMS_PERSPECTIVES = {
  retrospective: "Analyse rétrospective (résultat connu)",
  avant_match: "Avant le coup d'envoi (résultat exclu)",
};

export default function AffichageAnalyse({ resultat }: { resultat: ResultatAnalyse }) {
  const { analyse, match } = resultat;

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
      <p className="text-sm text-slate-400">
        <span className="font-semibold text-slate-200">Question :</span> {resultat.question}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-emerald-400">
        {NOMS_PERSPECTIVES[resultat.perspective]}
      </p>

      <h3 className="mt-4 text-xl font-bold">{analyse.titre}</h3>
      <p className="mt-2 whitespace-pre-line text-slate-200">{analyse.resume}</p>

      {analyse.constats.length > 0 && (
        <section className="mt-5">
          <h4 className="font-semibold">Constats tirés des données</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
            {analyse.constats.map((constat, index) => (
              <li key={index}>{constat}</li>
            ))}
          </ul>
        </section>
      )}

      {analyse.statistiques_pertinentes.length > 0 && (
        <section className="mt-5">
          <h4 className="font-semibold">Statistiques citées</h4>
          <p className="text-xs text-slate-500">
            Valeurs reprises directement d&apos;API-Football, pas rédigées par l&apos;IA.
          </p>
          <TableauStatistiques
            lignes={analyse.statistiques_pertinentes}
            equipeDom={match.equipe_dom.nom}
            equipeExt={match.equipe_ext.nom}
          />
        </section>
      )}

      {analyse.interpretation && (
        <section className="mt-5 rounded-lg border border-sky-900 bg-sky-950/30 p-4">
          <h4 className="font-semibold text-sky-200">Interprétation de l&apos;IA</h4>
          <p className="mt-2 whitespace-pre-line text-sky-100/90">{analyse.interpretation}</p>
        </section>
      )}

      {analyse.limites.length > 0 && (
        <details open className="mt-5">
          <summary className="cursor-pointer text-sm text-amber-300">
            Limites et données manquantes ({analyse.limites.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/80">
            {analyse.limites.map((limite, index) => (
              <li key={index}>{limite}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
