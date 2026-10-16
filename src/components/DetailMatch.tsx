"use client";

import { useEffect, useState } from "react";
import FormulaireAnalyse from "@/components/FormulaireAnalyse";
import TableauStatistiques from "@/components/TableauStatistiques";
import type { Affiche, StatistiquesMatch } from "@/lib/affiche";
import { formaterDate, issueDuMatch } from "@/lib/football/metier";

export default function DetailMatch({
  competitionId,
  saison,
  match,
  statistiquesPrevues,
}: {
  competitionId: number;
  saison: number;
  match: Affiche;
  statistiquesPrevues: boolean;
}) {
  // Si API-Football indique qu'il n'y a pas de statistiques pour cette saison,
  // aucune requête n'est envoyée : le quota est préservé.
  const [chargement, setChargement] = useState(statistiquesPrevues);
  const [erreur, setErreur] = useState("");
  const [statistiques, setStatistiques] = useState<StatistiquesMatch | null>(null);

  useEffect(() => {
    if (!statistiquesPrevues) return;
    let actif = true;

    fetch(
      `/api/statistiques?competition=${competitionId}&saison=${saison}&match=${match.id}`
    )
      .then(async (reponse) => {
        const donnees = await reponse.json().catch(() => null);
        if (!reponse.ok) {
          throw new Error(donnees?.erreur ?? "Impossible de charger les statistiques.");
        }
        if (actif) setStatistiques(donnees.statistiques);
      })
      .catch((error: unknown) => {
        if (actif) {
          setErreur(error instanceof Error ? error.message : "Impossible de charger les statistiques.");
        }
      })
      .finally(() => {
        if (actif) setChargement(false);
      });

    return () => {
      actif = false;
    };
  }, [competitionId, saison, match.id, statistiquesPrevues]);

  const { score } = match;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {[match.competition, match.journee, formaterDate(match.date_match)].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <p className="text-lg font-semibold">{match.equipe_dom.nom}</p>
        <p className="rounded-lg bg-emerald-400/10 px-4 py-2 text-3xl font-bold text-emerald-300">
          {score.dom} - {score.ext}
        </p>
        <p className="text-lg font-semibold">{match.equipe_ext.nom}</p>
      </div>

      <p className="mt-3 text-center text-sm text-slate-400">
        {issueDuMatch(match)}
        {score.mi_temps && ` Mi-temps : ${score.mi_temps.dom}-${score.mi_temps.ext}.`}
      </p>
      {(match.stade || match.arbitre) && (
        <p className="mt-1 text-center text-xs text-slate-500">
          {[match.stade && `Stade : ${match.stade}`, match.arbitre && `Arbitre : ${match.arbitre}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Statistiques du match</h3>
        <p className="text-xs text-slate-500">Source : API-Football. « — » signifie non fourni.</p>

        {!statistiquesPrevues && (
          <p className="mt-3 text-sm text-slate-400">
            API-Football n&apos;annonce pas de statistiques détaillées pour cette saison. Le score et les
            bilans restent disponibles.
          </p>
        )}
        {chargement && (
          <p className="mt-3 animate-pulse text-sm text-slate-400">Chargement des statistiques…</p>
        )}
        {erreur && (
          <p role="alert" className="mt-3 rounded-lg border border-rose-900 bg-rose-950/60 p-3 text-sm text-rose-200">
            {erreur}
          </p>
        )}
        {statistiques && !statistiques.disponibles && (
          <p className="mt-3 text-sm text-slate-400">
            API-Football ne fournit pas de statistiques détaillées pour ce match.
          </p>
        )}
        {statistiques?.disponibles && (
          <TableauStatistiques
            lignes={statistiques.lignes}
            equipeDom={match.equipe_dom.nom}
            equipeExt={match.equipe_ext.nom}
          />
        )}
      </section>

      <FormulaireAnalyse competitionId={competitionId} saison={saison} match={match} />
    </article>
  );
}
