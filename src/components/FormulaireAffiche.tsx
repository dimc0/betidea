
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import AffichageAnalyse from "@/components/AffichageAnalyse";
import type {
  ResultatAnalyse,
  Sport,
} from "@/lib/affiche";

const SPORTS: { valeur: Sport; nom: string }[] = [
  { valeur: "football", nom: "Football" },
];

const LIBELLES: Record<Sport, [string, string]> = {
  football: ["Équipe à domicile", "Équipe à l’extérieur"],
};

function estResultatAnalyse(
  valeur: unknown
): valeur is ResultatAnalyse {
  if (
    typeof valeur !== "object" ||
    valeur === null
  ) {
    return false;
  }

  const donnees = valeur as Record<string, unknown>;

  if (
    typeof donnees.message !== "string" ||
    typeof donnees.affiche !== "object" ||
    donnees.affiche === null ||
    typeof donnees.analyse !== "object" ||
    donnees.analyse === null
  ) {
    return false;
  }

  const affiche = donnees.affiche as Record<string, unknown>;
  const analyse = donnees.analyse as Record<string, unknown>;

  return (
    typeof affiche.sport === "string" &&
    typeof affiche.equipe_dom === "string" &&
    typeof affiche.equipe_ext === "string" &&
    typeof affiche.competition === "string" &&
    typeof affiche.date_match === "string" &&
    analyse.statut === "prete" &&
    typeof analyse.resume === "string" &&
    typeof analyse.forme_recente === "string" &&
    Array.isArray(analyse.facteurs_cles) &&
    typeof analyse.type_pari === "string" &&
    typeof analyse.confiance === "number" &&
    typeof analyse.justification === "string" &&
    Array.isArray(analyse.donnees_manquantes) &&
    Array.isArray(analyse.sources)
  );
}

export default function FormulaireAffiche() {
  const [sport, setSport] = useState<Sport>("football");
  const [participant1, setParticipant1] = useState("");
  const [participant2, setParticipant2] = useState("");
  const [competition, setCompetition] = useState("");
  const [dateMatch, setDateMatch] = useState("");
  const [contexte, setContexte] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [resultat, setResultat] =
    useState<ResultatAnalyse | null>(null);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setChargement(true);
    setErreur("");
    setMessage("");
    setResultat(null);

    try {
      const reponse = await fetch("/api/analyses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sport,
          equipe_dom: participant1.trim(),
          equipe_ext: participant2.trim(),
          competition: competition.trim(),
          date_match: dateMatch,
          contexte: contexte.trim(),
        }),
      });

      const donnees: unknown = await reponse
        .json()
        .catch(() => null);

      if (!reponse.ok) {
        const messageErreur =
          typeof donnees === "object" &&
          donnees !== null &&
          "erreur" in donnees &&
          typeof donnees.erreur === "string"
            ? donnees.erreur
            : "Une erreur est survenue.";

        setErreur(messageErreur);
        return;
      }

      if (!estResultatAnalyse(donnees)) {
        setErreur(
          "La réponse reçue du serveur n'a pas le format attendu."
        );
        return;
      }

      setMessage("Analyse reçue du serveur.");
      setResultat(donnees);
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={envoyer} className="flex flex-col gap-4">
      <div>
        <label htmlFor="sport" className="block font-medium">
          Sport
        </label>

        <select
          id="sport"
          value={sport}
          onChange={(e) => setSport(e.target.value as Sport)}
          className="mt-1 w-full rounded border p-2"
        >
          {SPORTS.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="participant1"
          className="block font-medium"
        >
          {LIBELLES[sport][0]}
        </label>

        <input
          id="participant1"
          name="equipe_dom"
          value={participant1}
          onChange={(e) => setParticipant1(e.target.value)}
          maxLength={150}
          required
          className="mt-1 w-full rounded border p-2"
        />
      </div>

      <div>
        <label
          htmlFor="participant2"
          className="block font-medium"
        >
          {LIBELLES[sport][1]}
        </label>

        <input
          id="participant2"
          name="equipe_ext"
          value={participant2}
          onChange={(e) => setParticipant2(e.target.value)}
          maxLength={150}
          required
          className="mt-1 w-full rounded border p-2"
        />
      </div>

      <div>
        <label htmlFor="competition" className="block font-medium">
          Compétition
        </label>

        <input
          id="competition"
          name="competition"
          value={competition}
          onChange={(e) => setCompetition(e.target.value)}
          maxLength={150}
          required
          placeholder="Ex. : Liga, Ligue 1, Roland-Garros..."
          className="mt-1 w-full rounded border p-2"
        />
      </div>

      <div>
        <label htmlFor="dateMatch" className="block font-medium">
          Date de la rencontre
        </label>

        <input
          id="dateMatch"
          name="date_match"
          type="date"
          value={dateMatch}
          onChange={(e) => setDateMatch(e.target.value)}
          required
          className="mt-1 w-full rounded border p-2"
        />
      </div>

      <div>
        <label htmlFor="contexte" className="block font-medium">
          Contexte complémentaire (facultatif)
        </label>

        <textarea
          id="contexte"
          name="contexte"
          value={contexte}
          onChange={(e) => setContexte(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Compositions probables, joueurs absents, derniers résultats, forme récente, statistiques..."
          className="mt-1 w-full rounded border p-2"
        />

        <p className="mt-1 text-sm text-gray-500">
          {contexte.length}/2000 caractères
        </p>
      </div>

      <button
        type="submit"
        disabled={chargement}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {chargement ? "Analyse en cours…" : "Lancer l’analyse"}
      </button>

      {erreur && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-red-700"
        >
          {erreur}
        </p>
      )}

      {message && (
        <p role="status" className="rounded border p-3">
          {message}
        </p>
      )}

      </form>

      {resultat && (
        <AffichageAnalyse affiche={resultat.affiche} analyse={resultat.analyse} />
      )}
    </div>
  );
}
