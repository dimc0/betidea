// Types partagés de Betidea (front et back).
// Toutes les données de match viennent d'API-Football, saisons passées uniquement.

export type Saison = {
  annee: number;
  libelle: string;
};

export type Equipe = {
  id: number;
  nom: string;
};

// Un match terminé.
export type Match = {
  id: number;
  date: string;
  journee: string;
  domicile: Equipe;
  exterieur: Equipe;
  butsDomicile: number;
  butsExterieur: number;
};

export type Statistique = {
  nom: string;
  domicile: string | number | null;
  exterieur: string | number | null;
};

// Réponse de l'IA, validée côté serveur.
export type Analyse = {
  titre: string;
  resume: string;
  points_cles: string[];
  limites: string[];
};

// Ce que renvoie POST /api/analyses et ce qui est enregistré dans Supabase.
export type AnalyseEnregistree = {
  id: string;
  match: Match;
  statistiques: Statistique[];
  analyse: Analyse;
  created_at: string;
};
