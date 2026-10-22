"use client";

import { useEffect, useState } from "react";
import type { ResultatControle, Statut } from "@/lib/statut";

type ReponseStatut = {
  verifieLe: string;
  statutGlobal: Statut;
  services: ResultatControle[];
};

const AFFICHAGE: Record<Statut, { libelle: string; classes: string }> = {
  operationnel: { libelle: "Opérationnel", classes: "bg-emerald-950 text-emerald-300" },
  degrade: { libelle: "Dégradé", classes: "bg-amber-950 text-amber-300" },
  en_panne: { libelle: "En panne", classes: "bg-rose-950 text-rose-300" },
};

const MESSAGE_GLOBAL: Record<Statut, string> = {
  operationnel: "Tous les services sont opérationnels.",
  degrade: "Au moins un service répond lentement.",
  en_panne: "Au moins un service est en panne.",
};

async function recupererStatut(): Promise<ReponseStatut> {
  const reponse = await fetch("/api/admin/statut", { cache: "no-store" });
  if (!reponse.ok) {
    throw new Error(`Statut ${reponse.status}`);
  }
  return reponse.json();
}

export default function Admin() {
  const [donnees, setDonnees] = useState<ReponseStatut | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  function actualiser() {
    setChargement(true);
    recupererStatut()
      .then((resultat) => {
        setDonnees(resultat);
        setErreur("");
      })
      .catch(() => setErreur("Impossible de joindre la route de statut."))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    recupererStatut()
      .then(setDonnees)
      .catch(() => setErreur("Impossible de joindre la route de statut."))
      .finally(() => setChargement(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Administration</h1>
          <button
            onClick={actualiser}
            disabled={chargement}
            className="rounded-lg bg-emerald-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-50"
          >
            {chargement ? "Vérification…" : "Relancer les tests"}
          </button>
        </div>

        {erreur && (
          <p className="mt-6 rounded-lg border border-rose-900 bg-rose-950/60 p-3 text-rose-200">
            {erreur}
          </p>
        )}

        {donnees && (
          <>
            <p className={`mt-6 rounded-lg p-3 font-medium ${AFFICHAGE[donnees.statutGlobal].classes}`}>
              {MESSAGE_GLOBAL[donnees.statutGlobal]}
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-2">Service</th>
                    <th className="p-2">Statut</th>
                    <th className="p-2">Temps de réponse</th>
                    <th className="p-2">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees.services.map((s) => (
                    <tr key={s.service} className="border-b border-slate-800 align-top">
                      <td className="p-2">
                        <p className="font-medium">{s.service}</p>
                        <p className="text-slate-500">{s.description}</p>
                      </td>
                      <td className="p-2">
                        <span className={`rounded px-2 py-1 text-xs font-medium ${AFFICHAGE[s.statut].classes}`}>
                          {AFFICHAGE[s.statut].libelle}
                        </span>
                      </td>
                      <td className="p-2">{s.latenceMs} ms</td>
                      <td className="p-2 text-slate-300">{s.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Dernière vérification : {new Date(donnees.verifieLe).toLocaleString("fr-FR")}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
