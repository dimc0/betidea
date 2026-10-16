"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import AffichageAnalyse from "@/components/AffichageAnalyse";
import { LIMITES, type Affiche, type Perspective, type ResultatAnalyse } from "@/lib/affiche";

const SUGGESTIONS = [
  "Analyse ce match et explique le résultat.",
  "Quelle équipe a dominé statistiquement ?",
  "Quels éléments statistiques peuvent expliquer ce score ?",
  "Compare les performances de ces deux équipes pendant cette saison.",
  "Comment ces deux équipes ont-elles évolué au cours des derniers matchs ?",
];

function estResultatAnalyse(valeur: unknown): valeur is ResultatAnalyse {
  if (typeof valeur !== "object" || valeur === null) return false;
  const donnees = valeur as Record<string, unknown>;
  const analyse = donnees.analyse as Record<string, unknown> | null;

  return (
    typeof donnees.question === "string" &&
    typeof donnees.match === "object" &&
    typeof analyse === "object" &&
    analyse !== null &&
    typeof analyse.titre === "string" &&
    typeof analyse.resume === "string" &&
    Array.isArray(analyse.constats) &&
    Array.isArray(analyse.statistiques_pertinentes) &&
    typeof analyse.interpretation === "string" &&
    Array.isArray(analyse.limites)
  );
}

export default function FormulaireAnalyse({
  competitionId,
  saison,
  match,
}: {
  competitionId: number;
  saison: number;
  match: Affiche;
}) {
  const [perspective, setPerspective] = useState<Perspective>("retrospective");
  const [question, setQuestion] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [echanges, setEchanges] = useState<ResultatAnalyse[]>([]);

  function changerPerspective(nouvelle: Perspective) {
    // Une conversation rétrospective contient le résultat : on ne la réutilise pas
    // pour une analyse « avant le match ».
    setPerspective(nouvelle);
    setEchanges([]);
    setErreur("");
  }

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!question.trim() || chargement) return;

    setChargement(true);
    setErreur("");

    try {
      const reponse = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition: competitionId,
          saison,
          match: match.id,
          perspective,
          question: question.trim(),
          historique: echanges.slice(-LIMITES.echangesMax).map((echange) => ({
            question: echange.question,
            reponse: `${echange.analyse.resume}\n${echange.analyse.interpretation}`.slice(
              0,
              LIMITES.reponseMax
            ),
          })),
        }),
      });
      const donnees: unknown = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        const message =
          typeof donnees === "object" &&
          donnees !== null &&
          "erreur" in donnees &&
          typeof donnees.erreur === "string"
            ? donnees.erreur
            : "Une erreur est survenue.";
        setErreur(message);
        return;
      }

      if (!estResultatAnalyse(donnees)) {
        setErreur("La réponse reçue du serveur n'a pas le format attendu.");
        return;
      }

      setEchanges((precedents) => [...precedents, donnees]);
      setQuestion("");
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <section className="mt-6 border-t border-slate-800 pt-6">
      <h3 className="text-lg font-semibold">Analyse par l&apos;IA</h3>

      <fieldset className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
        <legend className="sr-only">Perspective de l&apos;analyse</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`perspective-${match.id}`}
            checked={perspective === "retrospective"}
            onChange={() => changerPerspective("retrospective")}
            disabled={chargement}
          />
          Rétrospective (avec le résultat)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`perspective-${match.id}`}
            checked={perspective === "avant_match"}
            onChange={() => changerPerspective("avant_match")}
            disabled={chargement}
          />
          Avant le coup d&apos;envoi (sans le résultat)
        </label>
      </fieldset>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setQuestion(suggestion)}
            disabled={chargement}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-400 disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form onSubmit={envoyer} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`question-${match.id}`} className="sr-only">
          Question sur le match
        </label>
        <input
          id={`question-${match.id}`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={LIMITES.questionMax}
          placeholder="Pose une question sur ce match…"
          disabled={chargement}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none ring-emerald-400 transition placeholder:text-slate-600 focus:ring-2"
        />
        <button
          type="submit"
          disabled={chargement || !question.trim()}
          className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {chargement ? "Analyse en cours…" : "Demander"}
        </button>
      </form>

      {erreur && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-900 bg-rose-950/60 p-3 text-sm text-rose-200">
          {erreur}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {echanges.map((echange, index) => (
          <AffichageAnalyse key={index} resultat={echange} />
        ))}
      </div>

      {chargement && (
        <p className="mt-4 animate-pulse text-sm text-slate-400">
          L&apos;IA analyse les données d&apos;API-Football…
        </p>
      )}
    </section>
  );
}
