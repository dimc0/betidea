import { cacheLife } from "next/cache";
import type { SnapshotCotes } from "@/lib/combine/odds-api";
import { recupererMatchsAvecCotes } from "@/lib/combine/odds-api";
import {
  creerCombine,
  limiterCataloguePourIA,
  reconstruireSelections,
  validerPropositionsIA,
  type Combine,
  type PropositionIA,
  type SelectionCombine,
} from "@/lib/combine/metier";
import { appelerModele, ErreurIA } from "@/lib/ia";

type ReponseIACombine = {
  selections: PropositionIA[];
  clarification: string;
};

const TAILLE_MAX_DONNEES_IA = 80_000;

const SCHEMA_COMBINE = {
  nom: "betidea_combine",
  schema: {
    type: "object",
    properties: {
      selections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            selectionId: { type: "string" },
            justification: { type: "string" },
          },
          required: ["selectionId", "justification"],
          additionalProperties: false,
        },
      },
      clarification: { type: "string" },
    },
    required: ["selections", "clarification"],
    additionalProperties: false,
  },
} as const;

function estReponseCombine(valeur: unknown): valeur is ReponseIACombine {
  if (typeof valeur !== "object" || valeur === null) return false;
  const donnees = valeur as Record<string, unknown>;
  return (
    typeof donnees.clarification === "string" &&
    Array.isArray(donnees.selections) &&
    donnees.selections.every((selection) => {
      if (typeof selection !== "object" || selection === null) return false;
      const item = selection as Record<string, unknown>;
      return typeof item.selectionId === "string" && typeof item.justification === "string";
    })
  );
}

function creerCatalogue(snapshot: SnapshotCotes): SelectionCombine[] {
  return snapshot.matchs.flatMap((match) =>
    match.selections.map((selection) => ({
      ...selection,
      matchId: match.id,
      match: match.match,
      competition: match.competition,
      coupEnvoi: match.coupEnvoi,
    }))
  );
}

function donneesCompactesPourIA(selections: SelectionCombine[]) {
  return selections.map((selection) => ({
    id: selection.id,
    match: selection.match,
    competition: selection.competition,
    coupEnvoi: selection.coupEnvoi,
    bookmaker: selection.bookmaker,
    marche: selection.market,
    choix: selection.selection,
    cote: selection.cote,
  }));
}

async function demanderCombine(
  instruction: string,
  donnees: unknown
): Promise<ReponseIACombine> {
  const donneesJson = JSON.stringify(donnees);
  if (donneesJson.length > TAILLE_MAX_DONNEES_IA) {
    throw new ErreurIA("Les données récupérées sont trop volumineuses pour l'IA.", 413);
  }

  const contenu = await appelerModele(
    [
      {
        role: "system",
        content: `Tu aides à composer un combiné de football avec le catalogue fourni.
Chaque sélection a un identifiant stable, un match, un marché et un bookmaker réellement renvoyés par The Odds API, et une cote réelle.
Ne crée et ne modifie jamais ces éléments. Ne renvoie que les identifiants présents dans le catalogue.
Pour chaque pari choisi, écris une justification courte et prudente. Ne garantis aucun gain.
Si la demande est ambiguë ou impossible avec les marchés présents, renvoie une clarification claire et une liste selections vide.
Pour le combiné initial, choisis exactement le nombre demandé si le catalogue contient assez de matchs distincts ; ne demande pas de clarification quand les options fournies suffisent.
Pour une modification, conserve les sélections courantes sauf si l'utilisateur demande de les retirer ou remplacer.
La cote n'est jamais une preuve de probabilité et ne doit pas être reformulée comme une certitude.`,
      },
      {
        role: "user",
        content: `${instruction}\n\nCatalogue réel des matchs et sélections disponibles :\n${donneesJson}`,
      },
    ],
    { schema: SCHEMA_COMBINE, maxCompletionTokens: 1200 }
  );

  let donneesIA: unknown;
  try {
    donneesIA = JSON.parse(contenu);
  } catch {
    throw new ErreurIA("La réponse du modèle n'est pas un JSON valide.", 502);
  }
  if (!estReponseCombine(donneesIA)) {
    throw new ErreurIA("La réponse du modèle ne respecte pas le format attendu.", 502);
  }
  return donneesIA;
}

async function genererPropositionInitialeCachee(
  catalogueJson: string,
  nombreSelections: number
): Promise<ReponseIACombine> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 900 });
  return demanderCombine(
    `Crée un combiné de ${nombreSelections} sélections, une seule par match, à partir des options disponibles.`,
    JSON.parse(catalogueJson)
  );
}

export async function genererCombineInitial(): Promise<{
  snapshot: SnapshotCotes;
  combine: Combine;
}> {
  const snapshot = await recupererMatchsAvecCotes();
  const catalogue = creerCatalogue(snapshot);
  const catalogueIA = limiterCataloguePourIA(catalogue);
  const nombreMatchsDistincts = new Set(catalogueIA.map((selection) => selection.matchId)).size;
  if (nombreMatchsDistincts < 2) {
    throw new ErreurIA("Il n'y a pas assez de matchs avec des cotes valides pour composer un combiné.", 404);
  }

  const reponse = await genererPropositionInitialeCachee(
    JSON.stringify(donneesCompactesPourIA(catalogueIA)),
    Math.min(3, nombreMatchsDistincts)
  );
  if (reponse.selections.length === 0) {
    throw new ErreurIA(
      reponse.clarification || "L'IA n'a pas proposé de sélections exploitables. Réessaie dans un instant.",
      422
    );
  }

  return {
    snapshot,
    combine: creerCombine(validerPropositionsIA(reponse.selections, catalogueIA)),
  };
}

export async function modifierCombine(
  message: string,
  selectionIds: string[]
): Promise<{ snapshot: SnapshotCotes; combine: Combine; clarification?: string }> {
  const demande = message.trim();
  if (!demande || demande.length > 500) {
    throw new ErreurIA("La demande doit contenir entre 1 et 500 caractères.", 400);
  }

  const snapshot = await recupererMatchsAvecCotes();
  const catalogue = creerCatalogue(snapshot);
  let selectionsCourantes: SelectionCombine[];
  try {
    selectionsCourantes = reconstruireSelections(selectionIds, catalogue);
  } catch (erreur) {
    throw new ErreurIA(
      erreur instanceof Error ? erreur.message : "Le combiné actuel est invalide.",
      400
    );
  }

  const catalogueIA = limiterCataloguePourIA(
    catalogue,
    selectionsCourantes.map(({ id }) => id)
  );
  const donnees = {
    selectionsCourantes: donneesCompactesPourIA(selectionsCourantes),
    catalogue: donneesCompactesPourIA(catalogueIA),
  };
  const reponse = await demanderCombine(
    `Modifie le combiné selon cette demande : ${demande}. Le combiné final doit contenir entre 2 et 4 sélections distinctes.`,
    donnees
  );

  if (reponse.clarification.trim()) {
    return {
      snapshot,
      combine: creerCombine(
        selectionsCourantes.map((selection) => ({
          ...selection,
          justification: "Sélection conservée le temps de préciser la demande.",
        }))
      ),
      clarification: reponse.clarification.trim(),
    };
  }

  return {
    snapshot,
    combine: creerCombine(validerPropositionsIA(reponse.selections, catalogueIA)),
  };
}
