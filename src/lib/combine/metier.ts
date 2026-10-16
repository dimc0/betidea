import type { SelectionCote } from "@/lib/combine/odds-api";

export type SelectionCombine = SelectionCote & {
  matchId: string;
  match: string;
  competition: string;
  coupEnvoi: string;
};

export type PropositionIA = {
  selectionId: string;
  justification: string;
};

export type PariCombine = SelectionCombine & { justification: string };

export type Combine = {
  titre: string;
  paris: PariCombine[];
  coteTotale: number;
};

const MATCHS_MAX_POUR_IA = 10;
const SELECTIONS_MAX_PAR_MATCH_POUR_IA = 8;

export function limiterCataloguePourIA(
  catalogue: SelectionCombine[],
  selectionIdsPrioritaires: string[] = []
): SelectionCombine[] {
  const prioritaires = new Set(selectionIdsPrioritaires);
  const groupes = new Map<string, SelectionCombine[]>();
  for (const selection of catalogue) {
    const groupe = groupes.get(selection.matchId) ?? [];
    groupe.push(selection);
    groupes.set(selection.matchId, groupe);
  }

  const matchsPrioritaires = selectionIdsPrioritaires
    .map((id) => catalogue.find((selection) => selection.id === id)?.matchId)
    .filter((id): id is string => id !== undefined);
  const ordreMatchs = [...new Set([...matchsPrioritaires, ...groupes.keys()])]
    .slice(0, MATCHS_MAX_POUR_IA);

  return ordreMatchs.flatMap((matchId) => {
    const selections = groupes.get(matchId) ?? [];
    return [
      ...selections.filter((selection) => prioritaires.has(selection.id)),
      ...selections.filter((selection) => !prioritaires.has(selection.id)),
    ].slice(0, SELECTIONS_MAX_PAR_MATCH_POUR_IA);
  });
}

export function reconstruireSelections(
  ids: string[],
  catalogue: SelectionCombine[]
): SelectionCombine[] {
  const parId = new Map(catalogue.map((selection) => [selection.id, selection]));
  const resultats = ids.map((id) => {
    const selection = parId.get(id);
    if (!selection) {
      throw new Error("Une sélection du combiné n'est plus disponible. Actualise les matchs.");
    }
    return selection;
  });

  verifierNombreEtMatchs(resultats);
  return resultats;
}

export function validerPropositionsIA(
  propositions: PropositionIA[],
  catalogue: SelectionCombine[]
): PariCombine[] {
  const parId = new Map(catalogue.map((selection) => [selection.id, selection]));
  const resultats = propositions.map(({ selectionId, justification }) => {
    const selection = parId.get(selectionId);
    if (!selection) {
      throw new Error("L'IA a proposé une sélection inconnue des cotes reçues.");
    }
    if (typeof justification !== "string" || justification.trim().length === 0) {
      throw new Error("L'IA n'a pas fourni de justification exploitable.");
    }
    return { ...selection, justification: justification.trim() };
  });

  verifierNombreEtMatchs(resultats);
  return resultats;
}

export function calculerCoteTotale(paris: Array<{ cote: number }>): number {
  return paris.reduce((total, pari) => total * pari.cote, 1);
}

export function creerCombine(paris: PariCombine[]): Combine {
  return {
    titre: "Ton combiné du jour",
    paris,
    coteTotale: calculerCoteTotale(paris),
  };
}

function verifierNombreEtMatchs(
  selections: Array<{ matchId: string; cote: number }>
): void {
  if (selections.length < 2 || selections.length > 4) {
    throw new Error("Un combiné doit contenir entre 2 et 4 sélections.");
  }

  if (new Set(selections.map((selection) => selection.matchId)).size !== selections.length) {
    throw new Error("Un combiné ne peut contenir qu'une sélection par match.");
  }

  if (selections.some((selection) => !Number.isFinite(selection.cote) || selection.cote <= 1)) {
    throw new Error("Une cote du combiné est invalide.");
  }
}
