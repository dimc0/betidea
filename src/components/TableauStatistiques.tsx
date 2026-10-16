import type { StatistiqueMatch, ValeurStatistique } from "@/lib/affiche";

function afficherValeur(valeur: ValeurStatistique): string {
  return valeur === null ? "—" : String(valeur);
}

// Valeurs affichées telles que renvoyées par API-Football ; « — » = non fourni.
export default function TableauStatistiques({
  lignes,
  equipeDom,
  equipeExt,
}: {
  lignes: StatistiqueMatch[];
  equipeDom: string;
  equipeExt: string;
}) {
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-slate-500">
          <th className="w-1/4 pb-2 text-left font-medium">{equipeDom}</th>
          <th className="pb-2 text-center font-medium">Statistique</th>
          <th className="w-1/4 pb-2 text-right font-medium">{equipeExt}</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((ligne) => (
          <tr key={ligne.type} className="border-t border-slate-800">
            <td className="py-2 font-semibold">{afficherValeur(ligne.dom)}</td>
            <td className="py-2 text-center text-slate-400">{ligne.libelle}</td>
            <td className="py-2 text-right font-semibold">{afficherValeur(ligne.ext)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
