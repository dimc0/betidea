// Tests de la logique pure : aucun appel à API-Football ni au modèle d'IA.
// Les objets ci-dessous reproduisent la forme des réponses d'API-Football v3.
import assert from "node:assert/strict";
import test from "node:test";
import {
  associerStatistiques,
  lireErreurApi,
  normaliserCompetition,
  normaliserMatch,
} from "../src/lib/football/normalisation.ts";
import {
  calculerBilan,
  construireDonneesAnalyse,
  filtrerStatistiquesCitees,
  libelleSaison,
} from "../src/lib/football/metier.ts";

function fixture({ id, date, home, away, butsHome, butsAway, statut = "FT" }) {
  return {
    fixture: { id, date, referee: "Arbitre", status: { short: statut }, venue: { name: "Stade" } },
    league: { id: 61, name: "Ligue 1", season: 2023, round: "Regular Season - 1" },
    teams: {
      home: { id: home.id, name: home.nom, logo: "", winner: butsHome > butsAway },
      away: { id: away.id, name: away.nom, logo: "", winner: butsAway > butsHome },
    },
    goals: { home: butsHome, away: butsAway },
    score: { halftime: { home: 1, away: 0 }, fulltime: { home: butsHome, away: butsAway }, penalty: { home: null, away: null } },
  };
}

const PSG = { id: 85, nom: "Paris Saint Germain" };
const LYON = { id: 80, nom: "Lyon" };
const NICE = { id: 84, nom: "Nice" };

const matchsSaison = [
  fixture({ id: 1, date: "2023-08-12T19:00:00+00:00", home: PSG, away: NICE, butsHome: 0, butsAway: 0 }),
  fixture({ id: 2, date: "2023-08-20T19:00:00+00:00", home: LYON, away: PSG, butsHome: 1, butsAway: 3 }),
  fixture({ id: 3, date: "2023-09-03T19:00:00+00:00", home: PSG, away: LYON, butsHome: 4, butsAway: 0 }),
  fixture({ id: 4, date: "2023-09-17T19:00:00+00:00", home: NICE, away: PSG, butsHome: 3, butsAway: 2 }),
].map(normaliserMatch);

test("le score est associé à l'équipe à domicile et à l'équipe à l'extérieur de la réponse", () => {
  const match = matchsSaison[1];
  assert.equal(match.equipe_dom.nom, "Lyon");
  assert.equal(match.score.dom, 1);
  assert.equal(match.equipe_ext.nom, "Paris Saint Germain");
  assert.equal(match.score.ext, 3);
});

test("un match non terminé ou incomplet est ignoré", () => {
  assert.equal(normaliserMatch(fixture({ id: 9, date: "2023-08-12T19:00:00+00:00", home: PSG, away: NICE, butsHome: 0, butsAway: 0, statut: "NS" })), null);
  const sansScore = fixture({ id: 10, date: "2023-08-12T19:00:00+00:00", home: PSG, away: NICE, butsHome: 0, butsAway: 0 });
  sansScore.goals = { home: null, away: null };
  assert.equal(normaliserMatch(sansScore), null);
});

test("seules les saisons terminées sont proposées, avec leur couverture réelle", () => {
  const competition = normaliserCompetition(
    {
      league: { id: 61, name: "Ligue 1", logo: "" },
      country: { name: "France" },
      seasons: [
        { year: 2022, start: "2022-08-05", end: "2023-06-03", current: false, coverage: { fixtures: { statistics_fixtures: true } } },
        { year: 2023, start: "2023-08-11", end: "2024-05-19", current: false, coverage: { fixtures: { statistics_fixtures: false } } },
        { year: 2026, start: "2026-08-14", end: "2027-05-22", current: true, coverage: { fixtures: { statistics_fixtures: true } } },
      ],
    },
    "2026-10-16"
  );

  assert.deepEqual(competition.saisons.map((saison) => saison.annee), [2023, 2022]);
  assert.equal(competition.saisons[0].statistiques_disponibles, false);
  assert.equal(competition.saisons[1].statistiques_disponibles, true);
  assert.equal(libelleSaison(competition.saisons[0]), "2023/2024");
});

test("les statistiques sont associées par identifiant d'équipe, pas par ordre", () => {
  const match = matchsSaison[1]; // Lyon (dom) - PSG (ext)
  const statistiques = associerStatistiques(
    [
      { team: { id: PSG.id }, statistics: [{ type: "Ball Possession", value: "64%" }, { type: "Red Cards", value: null }] },
      { team: { id: LYON.id }, statistics: [{ type: "Ball Possession", value: "36%" }, { type: "Red Cards", value: null }] },
    ],
    match
  );

  assert.equal(statistiques.disponibles, true);
  assert.deepEqual(statistiques.lignes, [
    { type: "Ball Possession", libelle: "Possession", dom: "36%", ext: "64%" },
  ]);
});

test("une réponse de statistiques vide signale l'absence de données", () => {
  assert.deepEqual(associerStatistiques([], matchsSaison[0]), { disponibles: false, lignes: [] });
});

test("les erreurs d'API-Football sont traduites en messages compréhensibles", () => {
  assert.equal(lireErreurApi([]), null);
  assert.equal(lireErreurApi({ token: "Error/Missing application key." }).status, 502);
  assert.equal(lireErreurApi({ requests: "You have reached the request limit for the day" }).status, 429);
  assert.equal(lireErreurApi({ rateLimit: "Too many requests" }).status, 429);
  const plan = lireErreurApi({ plan: "Free plans do not have access to this season, try from 2021 to 2023." });
  assert.equal(plan.status, 403);
  assert.match(plan.message, /try from 2021 to 2023/);
});

test("le bilan avant un match exclut ce match et les suivants", () => {
  const avant = calculerBilan(matchsSaison, PSG.id, matchsSaison[2].date_match);
  assert.equal(avant.joues, 2);
  assert.deepEqual(avant.forme, ["N", "V"]);
  assert.equal(avant.points, 4);

  const saison = calculerBilan(matchsSaison, PSG.id);
  assert.equal(saison.joues, 4);
  assert.equal(saison.buts_marques, 9);
  assert.equal(saison.buts_encaisses, 4);
});

test("la perspective avant-match ne transmet ni le score, ni les statistiques, ni l'avenir", () => {
  const match = matchsSaison[2]; // PSG 4-0 Lyon
  const statistiques = { disponibles: true, lignes: [{ type: "Total Shots", libelle: "Tirs au total", dom: 20, ext: 4 }] };
  const donnees = construireDonneesAnalyse(match, matchsSaison, statistiques, "avant_match");

  assert.equal(donnees.le_match, null);
  assert.equal(donnees.apres_le_match, null);
  assert.equal(donnees.avant_le_match.bilan_domicile.joues, 2);
  const texte = JSON.stringify(donnees);
  assert.ok(!texte.includes("4-0"));
  assert.ok(!texte.includes("Total Shots"));
});

test("la perspective rétrospective transmet les vraies données du match sélectionné", () => {
  const match = matchsSaison[2];
  const statistiques = { disponibles: true, lignes: [{ type: "Total Shots", libelle: "Tirs au total", dom: 20, ext: 4 }] };
  const donnees = construireDonneesAnalyse(match, matchsSaison, statistiques, "retrospective");

  assert.equal(donnees.match.equipe_domicile, "Paris Saint Germain");
  assert.equal(donnees.le_match.score_final, "Paris Saint Germain 4-0 Lyon");
  assert.equal(donnees.le_match.issue, "Victoire de Paris Saint Germain.");
  assert.deepEqual(donnees.le_match.statistiques, statistiques.lignes);
  assert.equal(donnees.apres_le_match.matchs_suivants_domicile.length, 1);
});

test("une statistique citée par l'IA mais absente des données est ignorée", () => {
  const lignes = [{ type: "Total Shots", libelle: "Tirs au total", dom: 20, ext: 4 }];
  assert.deepEqual(filtrerStatistiquesCitees(["Total Shots", "expected_goals", "Total Shots"], lignes), lignes);
  assert.deepEqual(filtrerStatistiquesCitees(["Total Shots"], null), []);
});
