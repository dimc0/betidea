"use client";

import { useEffect, useRef, useState } from "react";
import ComparaisonEquipes from "@/components/ComparaisonEquipes";
import DetailMatch from "@/components/DetailMatch";
import type { Affiche, Competition } from "@/lib/affiche";
import { formaterDate, libelleSaison } from "@/lib/football/metier";

async function lireReponse<T>(reponse: Response, messageParDefaut: string): Promise<T> {
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(donnees?.erreur ?? messageParDefaut);
  return donnees as T;
}

export default function ExplorateurMatchs() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [chargementCompetitions, setChargementCompetitions] = useState(true);
  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [saison, setSaison] = useState<number | null>(null);
  const [matchs, setMatchs] = useState<Affiche[]>([]);
  const [chargementMatchs, setChargementMatchs] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [matchId, setMatchId] = useState<number | null>(null);
  const [erreur, setErreur] = useState("");
  // Évite d'afficher la réponse d'une saison sélectionnée précédemment.
  const requeteCourante = useRef("");

  useEffect(() => {
    let actif = true;
    fetch("/api/competitions")
      .then((reponse) =>
        lireReponse<{ competitions: Competition[]; avertissements: string[] }>(
          reponse,
          "Impossible de charger les compétitions."
        )
      )
      .then((donnees) => {
        if (!actif) return;
        setCompetitions(donnees.competitions);
        setAvertissements(donnees.avertissements);
        setCompetitionId(donnees.competitions[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (actif) setErreur(error instanceof Error ? error.message : "Erreur de chargement.");
      })
      .finally(() => {
        if (actif) setChargementCompetitions(false);
      });

    return () => {
      actif = false;
    };
  }, []);

  const competition = competitions.find((element) => element.id === competitionId) ?? null;
  const saisonChoisie = competition?.saisons.find((element) => element.annee === saison) ?? null;
  const match = matchs.find((element) => element.id === matchId) ?? null;
  const filtre = recherche.trim().toLowerCase();
  const matchsAffiches = matchs
    .filter(
      (element) =>
        !filtre ||
        element.equipe_dom.nom.toLowerCase().includes(filtre) ||
        element.equipe_ext.nom.toLowerCase().includes(filtre)
    )
    .slice()
    .reverse();

  async function chargerMatchs(idCompetition: number, annee: number) {
    const cle = `${idCompetition}-${annee}`;
    requeteCourante.current = cle;
    setChargementMatchs(true);
    setErreur("");
    setMatchs([]);
    setMatchId(null);
    setRecherche("");

    try {
      const reponse = await fetch(`/api/matchs?competition=${idCompetition}&saison=${annee}`);
      const donnees = await lireReponse<{ matchs: Affiche[] }>(
        reponse,
        "Impossible de charger les matchs."
      );
      if (requeteCourante.current !== cle) return;
      setMatchs(donnees.matchs);
      if (donnees.matchs.length === 0) {
        setErreur("API-Football ne renvoie aucun match terminé pour cette saison.");
      }
    } catch (error) {
      if (requeteCourante.current === cle) {
        setErreur(error instanceof Error ? error.message : "Impossible de charger les matchs.");
      }
    } finally {
      if (requeteCourante.current === cle) setChargementMatchs(false);
    }
  }

  function changerCompetition(id: number) {
    requeteCourante.current = "";
    setCompetitionId(id);
    setSaison(null);
    setMatchs([]);
    setMatchId(null);
    setErreur("");
    setChargementMatchs(false);
  }

  function changerSaison(annee: number) {
    setSaison(annee);
    if (competitionId) void chargerMatchs(competitionId, annee);
  }

  return (
    <div className="mt-6">
      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2">
        <div>
          <label htmlFor="competition" className="block text-sm font-medium">
            Compétition
          </label>
          <select
            id="competition"
            value={competitionId ?? ""}
            onChange={(e) => changerCompetition(Number(e.target.value))}
            disabled={chargementCompetitions || competitions.length === 0}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm"
          >
            {chargementCompetitions && <option value="">Chargement…</option>}
            {competitions.map((element) => (
              <option key={element.id} value={element.id}>
                {element.nom}
                {element.pays ? ` · ${element.pays}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="saison" className="block text-sm font-medium">
            Saison passée
          </label>
          <select
            id="saison"
            value={saison ?? ""}
            onChange={(e) => changerSaison(Number(e.target.value))}
            disabled={!competition || chargementMatchs}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm"
          >
            <option value="" disabled>
              Choisir une saison
            </option>
            {competition?.saisons.map((element) => (
              <option key={element.annee} value={element.annee}>
                {libelleSaison(element)}
                {element.statistiques_disponibles ? "" : " (sans statistiques détaillées)"}
              </option>
            ))}
          </select>
        </div>
      </section>

      {avertissements.map((avertissement) => (
        <p key={avertissement} role="status" className="mt-3 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
          {avertissement}
        </p>
      ))}

      {erreur && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-900 bg-rose-950/60 p-4 text-sm text-rose-200">
          {erreur}
        </p>
      )}

      {saisonChoisie && competition && (
        <p className="mt-4 rounded-lg border border-sky-900 bg-sky-950/30 p-3 text-sm text-sky-200">
          Saison {libelleSaison(saisonChoisie)} terminée ({competition.nom}) : données historiques
          d&apos;API-Football, sans données en direct ni prédiction.
        </p>
      )}

      {chargementMatchs && (
        <p className="mt-6 animate-pulse text-slate-300">Récupération des matchs terminés…</p>
      )}

      {matchs.length > 0 && competitionId && saison && (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">Matchs terminés</h2>
                <span className="text-xs text-slate-500">{matchsAffiches.length} / {matchs.length}</span>
              </div>
              <label htmlFor="recherche" className="sr-only">
                Filtrer par équipe
              </label>
              <input
                id="recherche"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Filtrer par équipe…"
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-emerald-400 focus:ring-2"
              />
              <ul className="mt-3 max-h-[36rem] space-y-2 overflow-y-auto pr-1">
                {matchsAffiches.map((element) => (
                  <li key={element.id}>
                    <button
                      type="button"
                      onClick={() => setMatchId(element.id)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                        element.id === matchId
                          ? "border-emerald-400 bg-emerald-400/10"
                          : "border-slate-800 bg-slate-950/70 hover:border-slate-600"
                      }`}
                    >
                      <span className="block text-xs text-slate-500">
                        {formaterDate(element.date_match)}
                        {element.journee && ` · ${element.journee}`}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate">{element.equipe_dom.nom}</span>
                        <span className="shrink-0 font-bold text-emerald-300">
                          {element.score.dom} - {element.score.ext}
                        </span>
                        <span className="truncate text-right">{element.equipe_ext.nom}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {match ? (
              <DetailMatch
                key={match.id}
                competitionId={competitionId}
                saison={saison}
                match={match}
                statistiquesPrevues={saisonChoisie?.statistiques_disponibles ?? false}
              />
            ) : (
              <section className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-400">
                Sélectionne un match pour voir son score, ses statistiques et l&apos;analyser avec l&apos;IA.
              </section>
            )}
          </div>

          <ComparaisonEquipes key={match?.id ?? `${competitionId}-${saison}`} matchs={matchs} match={match} />
        </>
      )}
    </div>
  );
}
