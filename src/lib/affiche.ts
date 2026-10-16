// Types partagés de Betidea : analyse historique du football.
// Toutes les données de match proviennent d'API-Football (saisons passées).

// Limites communes au front (confort) et au back (sécurité, quota du modèle).
export const LIMITES = {
  questionMax: 500,
  echangesMax: 4,
  reponseMax: 1500,
};

export type SaisonDisponible = {
  annee: number;
  debut: string;
  fin: string;
  statistiques_disponibles: boolean;
};

export type Competition = {
  id: number;
  nom: string;
  pays: string;
  logo: string;
  saisons: SaisonDisponible[];
};

export type EquipeMatch = {
  id: number;
  nom: string;
  logo: string;
};

export type ScorePartiel = {
  dom: number;
  ext: number;
};

// Un match terminé (FT, AET ou PEN) tel que renvoyé par API-Football.
export type Affiche = {
  id: number;
  competition: string;
  competition_id: number;
  saison: number;
  journee: string;
  date_match: string;
  statut: string;
  stade: string | null;
  arbitre: string | null;
  equipe_dom: EquipeMatch;
  equipe_ext: EquipeMatch;
  score: {
    dom: number;
    ext: number;
    mi_temps: ScorePartiel | null;
    tirs_au_but: ScorePartiel | null;
  };
};

export type ValeurStatistique = string | number | null;

export type StatistiqueMatch = {
  type: string;
  libelle: string;
  dom: ValeurStatistique;
  ext: ValeurStatistique;
};

export type StatistiquesMatch = {
  disponibles: boolean;
  lignes: StatistiqueMatch[];
};

export type ResultatEquipe = "V" | "N" | "D";

export type BilanEquipe = {
  equipe: string;
  joues: number;
  victoires: number;
  nuls: number;
  defaites: number;
  buts_marques: number;
  buts_encaisses: number;
  points: number;
  forme: ResultatEquipe[];
};

// « retrospective » : le résultat est connu et analysé.
// « avant_match » : seules les informations antérieures au coup d'envoi sont utilisées.
export type Perspective = "retrospective" | "avant_match";

// Objet envoyé à l'IA : uniquement les données réellement disponibles,
// rangées selon leur moment par rapport au match.
export type DonneesAnalyse = {
  perspective: Perspective;
  match: {
    competition: string;
    saison: number;
    journee: string;
    date: string;
    stade: string | null;
    arbitre: string | null;
    equipe_domicile: string;
    equipe_exterieure: string;
  };
  avant_le_match: {
    bilan_domicile: BilanEquipe;
    bilan_exterieur: BilanEquipe;
    derniers_matchs_domicile: string[];
    derniers_matchs_exterieur: string[];
    confrontations_dans_la_saison: string[];
  };
  le_match: {
    score_final: string;
    score_mi_temps: string | null;
    issue: string;
    statistiques: StatistiqueMatch[] | null;
  } | null;
  apres_le_match: {
    bilan_final_domicile: BilanEquipe;
    bilan_final_exterieur: BilanEquipe;
    matchs_suivants_domicile: string[];
    matchs_suivants_exterieur: string[];
  } | null;
  donnees_manquantes: string[];
};

export type AnalyseStructuree = {
  titre: string;
  resume: string;
  constats: string[];
  // Statistiques citées par l'IA, avec les valeurs reprises côté serveur depuis API-Football.
  statistiques_pertinentes: StatistiqueMatch[];
  interpretation: string;
  limites: string[];
};

export type EchangeQuestion = {
  question: string;
  reponse: string;
};

export type ResultatAnalyse = {
  match: Affiche;
  perspective: Perspective;
  question: string;
  analyse: AnalyseStructuree;
};

// Une analyse enregistrée dans Supabase possède en plus un identifiant et une date.
export type AnalyseEnregistree = ResultatAnalyse & {
  id: string;
  created_at: string;
};
