// Limite indicative du nombre d'analyses par adresse réseau.
// Elle est gardée en mémoire : comme toute fonction serverless est sans état,
// le compteur repart à zéro quand Vercel démarre une nouvelle instance.
// Une limite stricte demanderait un stockage partagé (par exemple Redis).
const FENETRE_MS = 60 * 60 * 1000;
const OPERATIONS_MAX_PAR_FENETRE = 20;
const operationsParAdresse = new Map<string, { nombre: number; reinitialisation: number }>();

// Renvoie null si l'opération est autorisée, sinon le délai d'attente en secondes.
export function consommerOperation(request: Request): number | null {
  const adresse =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "adresse-inconnue";
  const maintenant = Date.now();

  if (operationsParAdresse.size > 5000) {
    for (const [cle, valeur] of operationsParAdresse) {
      if (valeur.reinitialisation <= maintenant) operationsParAdresse.delete(cle);
    }
  }

  const actuel = operationsParAdresse.get(adresse);
  if (!actuel || actuel.reinitialisation <= maintenant) {
    operationsParAdresse.set(adresse, { nombre: 1, reinitialisation: maintenant + FENETRE_MS });
    return null;
  }

  if (actuel.nombre >= OPERATIONS_MAX_PAR_FENETRE) {
    return Math.max(1, Math.ceil((actuel.reinitialisation - maintenant) / 1000));
  }

  actuel.nombre += 1;
  return null;
}

export const LIMITE_ANALYSES_PAR_HEURE = OPERATIONS_MAX_PAR_FENETRE;
