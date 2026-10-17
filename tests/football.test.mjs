// Tests de la logique pure : aucun appel à API-Football ni à l'IA.
// Les objets reproduisent la forme des réponses d'API-Football v3.
import assert from "node:assert/strict";
import test from "node:test";
import {
  lireErreurApi,
  lireMatch,
  lireSaisonsPassees,
  lireStatistiques,
} from "../src/lib/football/normalisation.ts";
import { formeAvantMatch, listerEquipes, matchsDeLEquipe } from "../src/lib/football/metier.ts";

const PSG = { id: 85, name: "Paris Saint Germain" };
const LYON = { id: 80, name: "Lyon" };
const NICE = { id: 84, name: "Nice" };

function fixture(id, date, home, away, butsHome, butsAway) {
  return {
    fixture: { id, date },
    league: { round: "Regular Season - 1" },
    teams: { home, away },
    goals: { home: butsHome, away: butsAway },
  };
}

const matchs = [
  fixture(1, "2023-08-12T19:00:00+00:00", PSG, NICE, 0, 0),
  fixture(2, "2023-08-20T19:00:00+00:00", LYON, PSG, 1, 3),
  fixture(3, "2023-09-03T19:00:00+00:00", PSG, LYON, 4, 0),
].map(lireMatch);

test("le score est associé à la bonne équipe", () => {
  assert.equal(matchs[1].domicile.nom, "Lyon");
  assert.equal(matchs[1].butsDomicile, 1);
  assert.equal(matchs[1].exterieur.nom, "Paris Saint Germain");
  assert.equal(matchs[1].butsExterieur, 3);
});

test("un match sans score est ignoré", () => {
  assert.equal(lireMatch(fixture(9, "2023-08-12T19:00:00+00:00", PSG, NICE, null, null)), null);
});

test("seules les saisons terminées sont proposées", () => {
  const saisons = lireSaisonsPassees(
    {
      seasons: [
        { year: 2022, start: "2022-08-05", end: "2023-06-03" },
        { year: 2023, start: "2023-08-11", end: "2024-05-19" },
        { year: 2026, start: "2026-08-14", end: "2027-05-22" },
      ],
    },
    "2026-10-17"
  );
  assert.deepEqual(saisons, [
    { annee: 2023, libelle: "2023/2024" },
    { annee: 2022, libelle: "2022/2023" },
  ]);
});

test("les statistiques sont associées par identifiant d'équipe, pas par ordre", () => {
  const statistiques = lireStatistiques(
    [
      { team: { id: PSG.id }, statistics: [{ type: "Ball Possession", value: "64%" }] },
      { team: { id: LYON.id }, statistics: [{ type: "Ball Possession", value: "36%" }] },
    ],
    matchs[1] // Lyon (domicile) - PSG (extérieur)
  );
  assert.deepEqual(statistiques, [{ nom: "Ball Possession", domicile: "36%", exterieur: "64%" }]);
  assert.deepEqual(lireStatistiques([], matchs[1]), []);
});

test("les erreurs d'API-Football sont traduites", () => {
  assert.equal(lireErreurApi([]), null);
  assert.equal(lireErreurApi({ token: "Missing application key" }).status, 502);
  assert.equal(lireErreurApi({ requests: "Request limit reached" }).status, 429);
  assert.match(lireErreurApi({ plan: "try from 2021 to 2023" }).message, /2021 to 2023/);
});

test("équipes et matchs d'une équipe", () => {
  assert.deepEqual(listerEquipes(matchs).map((equipe) => equipe.nom), ["Lyon", "Nice", "Paris Saint Germain"]);
  assert.equal(matchsDeLEquipe(matchs, LYON.id).length, 2);
});

test("la forme avant un match n'utilise que les matchs précédents", () => {
  const forme = formeAvantMatch(matchs, matchs[2], PSG.id);
  assert.deepEqual(forme, [
    "2023-08-12 · domicile contre Nice · 0-0 · nul",
    "2023-08-20 · extérieur contre Lyon · 3-1 · victoire",
  ]);
});
