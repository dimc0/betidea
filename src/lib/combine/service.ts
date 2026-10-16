import { recupererMatchsBetclic } from "@/lib/combine/betclic";
import type { BetclicSnapshot } from "@/lib/combine/betclic";
import { appelerModele, ErreurIA } from "@/lib/ia";

export type PariCombine = {
  match: string;
  competition: string;
  heure: string;
  selection: string;
  cote: number;
};

export type Combine = {
  titre: string;
  paris: PariCombine[];
  coteTotale: number;
};

type ReponseIACombine = {
  paris: PariCombine[];
};

const TAILLE_MAX_DONNEES_IA = 80_000;

const SCHEMA_COMBINE = {
  nom: "betidea_combine",
  schema: {
    type: "object",
    properties: {
      paris: {
        type: "array",
        items: {
          type: "object",
          properties: {
            match: { type: "string" },
            competition: { type: "string" },
            heure: { type: "string" },
            selection: { type: "string" },
            cote: { type: "number" },
          },
          required: ["match", "competition", "heure", "selection", "cote"],
          additionalProperties: false,
        },
      },
    },
    required: ["paris"],
    additionalProperties: false,
  },
} as const;

async function demanderCombine(instruction: string, donnees: unknown): Promise<ReponseIACombine> {
  const donneesJson = JSON.stringify(donnees);
  if (donneesJson.length > TAILLE_MAX_DONNEES_IA) {
    throw new ErreurIA("Les données récupérées sont trop volumineuses pour l'IA.", 413);
  }

  const contenu = await appelerModele(
    [
      {
        role: "system",
        content: "À partir des matchs et cotes fournis, réponds avec le combiné demandé. N'ajoute pas de match absent des données.",
      },
      { role: "user", content: `${instruction}\n\nDonnées : ${donneesJson}` },
    ],
    { schema: SCHEMA_COMBINE, maxCompletionTokens: 1000 }
  );

  try {
    return JSON.parse(contenu) as ReponseIACombine;
  } catch {
    throw new ErreurIA("La réponse du modèle n'est pas un JSON valide.", 502);
  }
}

function creerCombine(reponse: ReponseIACombine): Combine {
  return {
    titre: "Ton combiné du jour",
    paris: reponse.paris,
    coteTotale: reponse.paris.reduce((total, pari) => total * pari.cote, 1),
  };
}

export async function genererCombineInitial(): Promise<{
  snapshot: BetclicSnapshot;
  combine: Combine;
}> {
  const snapshot = await recupererMatchsBetclic();
  const reponse = await demanderCombine(
    "Crée un combiné de 3 sélections à partir des matchs disponibles.",
    snapshot.matchs
  );
  const combine = creerCombine(reponse);
  return { snapshot, combine };
}

export async function modifierCombine(
  message: string,
  combineActuel: unknown
): Promise<{ snapshot: BetclicSnapshot; combine: Combine }> {
  const snapshot = await recupererMatchsBetclic();
  const reponse = await demanderCombine(
    `Modifie le combiné actuel selon cette demande : ${message}`,
    { matchs: snapshot.matchs, combineActuel }
  );
  const combine = creerCombine(reponse);
  return { snapshot, combine };
}
