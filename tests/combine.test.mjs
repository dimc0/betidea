import assert from "node:assert/strict";
import test from "node:test";
import {
  calculerCoteTotale,
  limiterCataloguePourIA,
  reconstruireSelections,
  validerPropositionsIA,
} from "../src/lib/combine/metier.ts";

const catalogue = [
  { id: "match-1:bookmaker-a:h2h:Home", matchId: "match-1", match: "Home - Away", competition: "Ligue 1", coupEnvoi: "2026-10-16T18:00:00Z", bookmakerKey: "bookmaker-a", bookmaker: "Bookmaker A", marketKey: "h2h", market: "Résultat du match (1N2)", selection: "Home", cote: 1.91, miseAJourLe: "2026-10-16T16:00:00Z" },
  { id: "match-2:bookmaker-b:h2h:Draw", matchId: "match-2", match: "A - B", competition: "Ligue 1", coupEnvoi: "2026-10-16T19:00:00Z", bookmakerKey: "bookmaker-b", bookmaker: "Bookmaker B", marketKey: "h2h", market: "Résultat du match (1N2)", selection: "Nul", cote: 3.2, miseAJourLe: "2026-10-16T16:00:00Z" },
  { id: "match-3:bookmaker-c:h2h:Away", matchId: "match-3", match: "C - D", competition: "Premier League", coupEnvoi: "2026-10-16T20:00:00Z", bookmakerKey: "bookmaker-c", bookmaker: "Bookmaker C", marketKey: "h2h", market: "Résultat du match (1N2)", selection: "Away", cote: 2.1, miseAJourLe: "2026-10-16T16:00:00Z" },
];

test("le serveur calcule le produit exact des cotes de référence", () => {
  assert.equal(calculerCoteTotale([{ cote: 1.91 }, { cote: 3.2 }, { cote: 2.1 }]), 12.8352);
});

test("les propositions utilisent les cotes du catalogue", () => {
  const paris = validerPropositionsIA(
    catalogue.map(({ id }) => ({
      selectionId: id,
      justification: "Choix prudent.",
      cote: 999,
      source: "source inventée",
    })),
    catalogue
  );

  assert.equal(paris[0].cote, 1.91);
  assert.equal(paris[0].bookmaker, "Bookmaker A");
  assert.equal(paris[1].selection, "Nul");
  assert.equal(paris.length, 3);
});

test("une sélection inconnue est rejetée", () => {
  assert.throws(
    () => validerPropositionsIA([
      { selectionId: "inconnue", justification: "Choix." },
      { selectionId: catalogue[1].id, justification: "Choix." },
    ], catalogue),
    /inconnue/
  );
});

test("un combiné ne peut pas contenir deux sélections du même match", () => {
  const doublonMatch = [
    catalogue[0],
    { ...catalogue[0], id: "match-1:h2h:Away", selection: "Away" },
  ];

  assert.throws(
    () => validerPropositionsIA(
      doublonMatch.map(({ id }) => ({ selectionId: id, justification: "Choix." })),
      doublonMatch
    ),
    /une sélection par match/
  );
});

test("les modifications peuvent retirer un pari et gardent un combiné valide", () => {
  const restants = reconstruireSelections(
    [catalogue[0].id, catalogue[2].id],
    catalogue
  );

  assert.deepEqual(restants.map(({ id }) => id), [catalogue[0].id, catalogue[2].id]);
});

test("le catalogue envoyé à l'IA est limité et conserve les sélections actuelles", () => {
  const grandCatalogue = Array.from({ length: 15 }, (_, matchIndex) =>
    Array.from({ length: 12 }, (_, selectionIndex) => ({
      ...catalogue[0],
      id: `match-${matchIndex}-selection-${selectionIndex}`,
      matchId: `match-${matchIndex}`,
    }))
  ).flat();
  const catalogueIA = limiterCataloguePourIA(grandCatalogue, [
    "match-14-selection-11",
  ]);

  assert.equal(new Set(catalogueIA.map(({ matchId }) => matchId)).size, 10);
  assert.ok(catalogueIA.length <= 80);
  assert.ok(catalogueIA.some(({ id }) => id === "match-14-selection-11"));
  assert.ok(catalogueIA.every(({ id }) => grandCatalogue.some((selection) => selection.id === id)));
});

test("les combinés de moins de deux sélections sont rejetés", () => {
  assert.throws(() => reconstruireSelections([catalogue[0].id], catalogue), /entre 2 et 4/);
});
