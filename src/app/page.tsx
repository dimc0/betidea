"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { BetclicMatch } from "@/lib/combine/betclic";
import type { Combine } from "@/lib/combine/service";

type ReponseApi = {
  matchs: BetclicMatch[];
  nombreMatchs: number;
  recupereLe: string;
  source: string;
  combine: Combine;
};

export default function Home() {
  const [donnees, setDonnees] = useState<ReponseApi | null>(null);
  const [message, setMessage] = useState("");
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const chargerCombine = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const response = await fetch("/api/combine", { method: "GET", cache: "no-store" });
      const resultat = (await response.json()) as ReponseApi & { erreur?: string };
      if (!response.ok) throw new Error(resultat.erreur || "Impossible de charger le combiné.");
      setDonnees(resultat);
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Erreur de chargement.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void chargerCombine();
  }, [chargerCombine]);

  async function envoyerMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!donnees || !message.trim() || envoi) return;

    setEnvoi(true);
    setErreur("");
    try {
      const response = await fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, combine: donnees.combine }),
      });
      const resultat = (await response.json()) as ReponseApi & { erreur?: string };
      if (!response.ok) throw new Error(resultat.erreur || "Impossible de modifier le combiné.");
      setDonnees(resultat);
      setMessage("");
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Erreur de modification.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-3 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">Betidea · Football</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Ton combiné du jour</h1>
          </div>
          <button
            onClick={() => void chargerCombine()}
            disabled={chargement || envoi}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chargement ? "Chargement…" : "Actualiser les matchs et le combiné"}
          </button>
        </header>

        {erreur && (
          <div role="alert" className="mb-6 rounded-xl border border-rose-900 bg-rose-950/60 p-4 text-sm text-rose-200">
            {erreur}
          </div>
        )}

        {chargement && !donnees && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <div className="animate-pulse text-slate-300">Récupération des matchs puis génération du combiné…</div>
          </section>
        )}

        {donnees && !chargement && (
          <>
            <section className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Matchs disponibles</p>
                <p className="mt-1 text-2xl font-semibold">{donnees.nombreMatchs}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Sélections</p>
                <p className="mt-1 text-2xl font-semibold">{donnees.combine.paris.length}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Cote combinée</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-400">{donnees.combine.coteTotale.toFixed(2)}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
              <div className="flex flex-col gap-2 border-b border-slate-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{donnees.combine.titre}</h2>
                </div>
                <div className="rounded-lg bg-emerald-400/10 px-3 py-2 text-right">
                  <p className="text-xs text-emerald-200/70">Cote totale calculée</p>
                  <p className="text-2xl font-bold text-emerald-300">{donnees.combine.coteTotale.toFixed(2)}</p>
                </div>
              </div>

              <ol className="mt-5 space-y-3">
                {donnees.combine.paris.map((pari, index) => (
                  <li key={`${pari.match}-${pari.selection}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold">{pari.match}</p>
                            <p className="mt-1 text-xs text-slate-500">{pari.competition} · {pari.heure || "Horaire non indiqué"}</p>
                          </div>
                          <span className="self-start rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-300">
                            {pari.selection} · {pari.cote.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <form onSubmit={envoyerMessage} className="mt-6">
                <label htmlFor="message-combine" className="mb-2 block text-sm font-semibold">Modifie ton combiné</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="message-combine"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={500}
                    placeholder="Ex. : retire le pari sur Guingamp…"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none ring-emerald-400 transition placeholder:text-slate-600 focus:ring-2"
                    disabled={envoi}
                  />
                  <button
                    type="submit"
                    disabled={envoi || !message.trim()}
                    className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {envoi ? "Modification…" : "Modifier"}
                  </button>
                </div>
              </form>
            </section>

          </>
        )}
      </div>
    </main>
  );
}
