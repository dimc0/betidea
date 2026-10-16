"use client";

import { useState } from "react";
import type { Affiche, BilanEquipe } from "@/lib/affiche";
import { calculerBilan, equipesDeLaSaison, formaterDate } from "@/lib/football/metier";

const LIGNES: { libelle: string; valeur: (bilan: BilanEquipe) => string | number }[] = [
  { libelle: "Matchs joués", valeur: (bilan) => bilan.joues },
  { libelle: "Victoires", valeur: (bilan) => bilan.victoires },
  { libelle: "Nuls", valeur: (bilan) => bilan.nuls },
  { libelle: "Défaites", valeur: (bilan) => bilan.defaites },
  { libelle: "Buts marqués", valeur: (bilan) => bilan.buts_marques },
  { libelle: "Buts encaissés", valeur: (bilan) => bilan.buts_encaisses },
  { libelle: "Différence de buts", valeur: (bilan) => bilan.buts_marques - bilan.buts_encaisses },
  { libelle: "Points (3/1/0)", valeur: (bilan) => bilan.points },
  {
    libelle: "Points par match",
    valeur: (bilan) => (bilan.joues > 0 ? (bilan.points / bilan.joues).toFixed(2) : "—"),
  },
  { libelle: "5 derniers résultats", valeur: (bilan) => bilan.forme.join(" ") || "—" },
];

// Comparaison calculée à partir des scores des matchs terminés de la saison :
// ce sont des faits, aucune IA n'intervient ici.
export default function ComparaisonEquipes({
  matchs,
  match,
}: {
  matchs: Affiche[];
  match: Affiche | null;
}) {
  const equipes = equipesDeLaSaison(matchs);
  const [equipeA, setEquipeA] = useState(match?.equipe_dom.id ?? equipes[0]?.id ?? 0);
  const [equipeB, setEquipeB] = useState(match?.equipe_ext.id ?? equipes[1]?.id ?? 0);
  const [avantLeMatch, setAvantLeMatch] = useState(false);

  if (equipes.length < 2) return null;

  const dateLimite = match && avantLeMatch ? match.date_match : undefined;
  const bilanA = calculerBilan(matchs, equipeA, dateLimite);
  const bilanB = calculerBilan(matchs, equipeB, dateLimite);
  const nomEquipe = (id: number) => equipes.find((equipe) => equipe.id === id)?.nom ?? "";

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Comparer deux équipes sur la saison</h2>
      <p className="mt-1 text-sm text-slate-400">
        Bilans calculés à partir des scores renvoyés par API-Football, dans cette compétition uniquement.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { id: "equipe-a", valeur: equipeA, changer: setEquipeA },
          { id: "equipe-b", valeur: equipeB, changer: setEquipeB },
        ].map((selecteur, index) => (
          <div key={selecteur.id}>
            <label htmlFor={selecteur.id} className="block text-sm font-medium">
              Équipe {index + 1}
            </label>
            <select
              id={selecteur.id}
              value={selecteur.valeur}
              onChange={(e) => selecteur.changer(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm"
            >
              {equipes.map((equipe) => (
                <option key={equipe.id} value={equipe.id}>
                  {equipe.nom}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {match && (
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={avantLeMatch}
            onChange={(e) => setAvantLeMatch(e.target.checked)}
          />
          Seulement les matchs joués avant le {formaterDate(match.date_match)}
        </label>
      )}

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <th className="pb-2 text-left font-medium">{nomEquipe(equipeA)}</th>
            <th className="pb-2 text-center font-medium">Indicateur</th>
            <th className="pb-2 text-right font-medium">{nomEquipe(equipeB)}</th>
          </tr>
        </thead>
        <tbody>
          {LIGNES.map((ligne) => (
            <tr key={ligne.libelle} className="border-t border-slate-800">
              <td className="py-2 font-semibold">{ligne.valeur(bilanA)}</td>
              <td className="py-2 text-center text-slate-400">{ligne.libelle}</td>
              <td className="py-2 text-right font-semibold">{ligne.valeur(bilanB)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
