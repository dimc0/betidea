// Petites fonctions de calcul sur les matchs (pures, utilisables côté front et back).
import type { Equipe, Match } from "@/lib/affiche";

export function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

// Liste des équipes de la saison, triée par nom.
export function listerEquipes(matchs: Match[]): Equipe[] {
  const equipes = new Map<number, Equipe>();
  for (const match of matchs) {
    equipes.set(match.domicile.id, match.domicile);
    equipes.set(match.exterieur.id, match.exterieur);
  }
  return [...equipes.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export function matchsDeLEquipe(matchs: Match[], equipeId: number): Match[] {
  return matchs.filter(
    (match) => match.domicile.id === equipeId || match.exterieur.id === equipeId
  );
}

// Résumé d'un match du point de vue d'une équipe, ex. « 2023-09-24 · contre Lens · 3-1 · victoire ».
export function resumerPourEquipe(match: Match, equipeId: number): string {
  const aDomicile = match.domicile.id === equipeId;
  const adversaire = aDomicile ? match.exterieur.nom : match.domicile.nom;
  const pour = aDomicile ? match.butsDomicile : match.butsExterieur;
  const contre = aDomicile ? match.butsExterieur : match.butsDomicile;
  const resultat = pour > contre ? "victoire" : pour < contre ? "défaite" : "nul";

  return `${match.date.slice(0, 10)} · ${aDomicile ? "domicile" : "extérieur"} contre ${adversaire} · ${pour}-${contre} · ${resultat}`;
}

// Les 5 derniers matchs joués par une équipe AVANT un match donné.
export function formeAvantMatch(matchs: Match[], match: Match, equipeId: number): string[] {
  return matchsDeLEquipe(matchs, equipeId)
    .filter((element) => Date.parse(element.date) < Date.parse(match.date))
    .slice(-5)
    .map((element) => resumerPourEquipe(element, equipeId));
}
