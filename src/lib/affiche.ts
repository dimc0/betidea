
export type Sport = "football";

export type Affiche = {
  sport: Sport;
  equipe_dom: string;
  equipe_ext: string;
  competition: string;
  date_match: string;
  contexte?: string;
};

export type SourceAnalyse = {
  titre: string;
  url: string;
};

export type AnalyseStructuree = {
  resume: string;
  forme_recente: string;
  facteurs_cles: string[];
  type_pari: string;
  confiance: number;
  justification: string;
  donnees_manquantes: string[];
  sources: SourceAnalyse[];
};

export type ResultatAnalyse = {
  message: string;
  affiche: Affiche;
  analyse: AnalyseStructuree & {
    statut: "prete";
  };
};
