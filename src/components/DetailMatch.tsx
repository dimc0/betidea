import Link from "next/link";
import AffichageAnalyse from "@/components/AffichageAnalyse";
import type { AnalyseEnregistree } from "@/lib/affiche";
import { formaterDate } from "@/lib/football/metier";

// Score, statistiques (données API-Football) puis analyse de l'IA.
export default function DetailMatch({ resultat }: { resultat: AnalyseEnregistree }) {
  const { match, statistiques, analyse } = resultat;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs text-slate-500">
        {formaterDate(match.date)} · {match.journee}
      </p>
      <h2 className="mt-2 text-2xl font-bold">
        {match.domicile.nom} {match.butsDomicile} - {match.butsExterieur} {match.exterieur.nom}
      </h2>

      {statistiques.length > 0 ? (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {statistiques.map((statistique) => (
              <tr key={statistique.nom} className="border-t border-slate-800">
                <td className="py-1.5 font-semibold">{statistique.domicile ?? "—"}</td>
                <td className="py-1.5 text-center text-slate-400">{statistique.nom}</td>
                <td className="py-1.5 text-right font-semibold">{statistique.exterieur ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          API-Football ne fournit pas de statistiques pour ce match.
        </p>
      )}

      <AffichageAnalyse analyse={analyse} />

      <Link href={`/analyses/${resultat.id}`} className="mt-3 inline-block text-sm text-emerald-300 underline">
        Retrouver cette analyse
      </Link>
    </section>
  );
}
