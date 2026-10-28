"use client";

import { useEffect, useState } from "react";
import DetailMatch from "@/components/DetailMatch";
import type { AnalyseEnregistree, Match, Saison } from "@/lib/affiche";
import { formaterDate, listerEquipes, matchsDeLEquipe } from "@/lib/football/metier";
import { creerClientNavigateur } from "@/lib/supabase/client";

const DELAI_MAX_MS = 90000;

// Message à afficher : celui du serveur, sinon un message de repli (jamais un détail technique)
function messageErreur(error: unknown, repli: string): string {
  if (error instanceof TypeError) return "Impossible de contacter le serveur. Vérifiez votre connexion.";
  return error instanceof Error && error.message ? error.message : repli;
}

// S'abonne aux changements de l'analyse et attend qu'elle soit prête ou en erreur
async function attendreAnalyse(id: string): Promise<AnalyseEnregistree> {
  const supabase = creerClientNavigateur();

  // Charge la session : l'abonnement doit être fait au nom de l'utilisateur,
  // pour que la Row Level Security autorise la réception des événements
  await supabase.auth.getSession();

  return new Promise((resolve, reject) => {
    const canal = supabase.channel(`analyse-${id}`);
    let termine = false;

    function terminer(action: () => void) {
      if (termine) return;
      termine = true;
      clearTimeout(minuteur);
      supabase.removeChannel(canal);
      action();
    }

    function examiner(analyse: AnalyseEnregistree) {
      if (analyse.statut === "prete") {
        terminer(() => resolve(analyse));
      } else if (analyse.statut === "erreur") {
        terminer(() =>
          reject(new Error(analyse.message_erreur ?? "La génération de l'analyse a échoué."))
        );
      }
    }

    // Délai maximal : sans réponse au bout de 90 s, on arrête d'attendre
    const minuteur = setTimeout(
      () =>
        terminer(() =>
          reject(
            new Error(
              "L'analyse prend plus de temps que prévu. Elle apparaîtra dans « Mes analyses » dès qu'elle sera prête."
            )
          )
        ),
      DELAI_MAX_MS
    );

    // Relit l'analyse complète : la ligne reçue en temps réel ne contient pas
    // les points clés, rangés dans une autre table
    async function relire() {
      try {
        const reponse = await fetch(`/api/analyses/${id}`, { cache: "no-store" });
        if (reponse.ok) examiner(await reponse.json());
      } catch {
        // Panne réseau passagère : le délai maximal finira par afficher un message
      }
    }

    canal
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "analyses", filter: `id=eq.${id}` },
        (evenement) => {
          if ((evenement.new as AnalyseEnregistree).statut !== "en_attente") relire();
        }
      )
      .subscribe((statut) => {
        // L'analyse a pu se terminer avant l'abonnement : on vérifie une fois l'état actuel
        if (statut === "SUBSCRIBED") relire();

        if (statut === "CHANNEL_ERROR" || statut === "TIMED_OUT") {
          terminer(() =>
            reject(
              new Error(
                "La connexion en temps réel a échoué. L'analyse apparaîtra dans « Mes analyses » dès qu'elle sera prête."
              )
            )
          );
        }
      });
  });
}

export default function ExplorateurMatchs() {
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [saison, setSaison] = useState<number | null>(null);
  const [matchs, setMatchs] = useState<Match[]>([]);
  const [equipeId, setEquipeId] = useState<number | null>(null);
  const [matchChoisi, setMatchChoisi] = useState<number | null>(null);
  const [resultat, setResultat] = useState<AnalyseEnregistree | null>(null);
  const [chargement, setChargement] = useState("");
  const [erreur, setErreur] = useState("");
  const [restantes, setRestantes] = useState<number | null>(null);

  // 1. Au chargement de la page : les saisons disponibles
  useEffect(() => {
    fetch("/api/saisons")
      .then(async (reponse) => {
        const donnees = await reponse.json().catch(() => ({}));
        if (!reponse.ok) throw new Error(donnees.erreur);
        setSaisons(donnees.saisons);
      })
      .catch((error) => setErreur(messageErreur(error, "Impossible de charger les saisons.")));
  }, []);

  // 2. Choix d'une saison : tous ses matchs terminés
  async function choisirSaison(annee: number) {
    setSaison(annee);
    setMatchs([]);
    setEquipeId(null);
    setMatchChoisi(null);
    setResultat(null);
    setErreur("");
    setChargement("Chargement des matchs…");

    try {
      const reponse = await fetch(`/api/matchs?saison=${annee}`);
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error(donnees.erreur);
      setMatchs(donnees.matchs);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible de charger les matchs."));
    } finally {
      setChargement("");
    }
  }

  // 3. Clic sur un match : demande d'analyse, puis attente du traitement en arrière-plan
  async function analyserMatch(match: Match) {
    setMatchChoisi(match.id);
    setResultat(null);
    setErreur("");
    setChargement("Analyse en cours…");

    try {
      const reponse = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saison, match: match.id }),
      });
      const donnees = await reponse.json().catch(() => ({}));
      const entete = reponse.headers.get("X-RateLimit-Remaining");
      if (entete !== null) setRestantes(Number(entete));
      if (!reponse.ok) throw new Error(donnees.erreur);

      // Analyse déjà prête (match déjà analysé) : affichage direct
      if (donnees.statut === "prete") {
        setResultat(donnees);
        return;
      }

      // Demande acceptée (202) ou déjà en cours : on attend le worker
      setResultat(await attendreAnalyse(donnees.id));
    } catch (error) {
      setErreur(messageErreur(error, "L'analyse a échoué. Réessayez plus tard."));
    } finally {
      setChargement("");
    }
  }

  // Retour à la liste des matchs de l'équipe, après une analyse
  function revenirAuxMatchs() {
    setMatchChoisi(null);
    setResultat(null);
    setErreur("");
  }

  const equipes = listerEquipes(matchs);
  const matchsAffiches = equipeId ? matchsDeLEquipe(matchs, equipeId) : [];

  // Un match a été choisi : seule son analyse est affichée
  if (matchChoisi !== null) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        {chargement ? (
          <p className="animate-pulse text-center text-lg text-slate-300">{chargement}</p>
        ) : (
          <button onClick={revenirAuxMatchs} className="self-start text-emerald-300 underline">
            ← Retour aux matchs
          </button>
        )}

        {erreur && (
          <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/60 p-3 text-rose-200">
            {erreur}
          </p>
        )}

        {resultat && <DetailMatch resultat={resultat} />}

        {restantes !== null && !chargement && (
          <p className="text-sm text-slate-500">
            {restantes > 0
              ? `Il vous reste ${restantes} analyse(s) pour l'heure en cours.`
              : "Vous avez utilisé tout votre quota pour l'heure en cours."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={saison ?? ""}
          onChange={(e) => choisirSaison(Number(e.target.value))}
          className="rounded-lg border border-slate-700 bg-slate-900 p-3"
        >
          <option value="" disabled>
            Choisis une saison
          </option>
          {saisons.map((element) => (
            <option key={element.annee} value={element.annee}>
              Saison {element.libelle}
            </option>
          ))}
        </select>

        <select
          value={equipeId ?? ""}
          onChange={(e) => setEquipeId(Number(e.target.value))}
          disabled={equipes.length === 0}
          className="rounded-lg border border-slate-700 bg-slate-900 p-3 disabled:opacity-50"
        >
          <option value="" disabled>
            Choisis une équipe
          </option>
          {equipes.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nom}
            </option>
          ))}
        </select>
      </div>

      {erreur && (
        <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/60 p-3 text-rose-200">
          {erreur}
        </p>
      )}

      {chargement && <p className="animate-pulse text-slate-400">{chargement}</p>}

      {matchsAffiches.length > 0 && (
        <ul className="flex flex-col gap-2">
          {matchsAffiches.map((match) => (
            <li key={match.id}>
              <button
                onClick={() => analyserMatch(match)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-left text-sm transition hover:border-slate-600"
              >
                <span className="block text-xs text-slate-500">{formaterDate(match.date)}</span>
                {match.domicile.nom}{" "}
                <strong className="text-emerald-300">
                  {match.butsDomicile} - {match.butsExterieur}
                </strong>{" "}
                {match.exterieur.nom}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
