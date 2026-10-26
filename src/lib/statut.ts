// Moteur des contrôles de santé de la page /admin (TD2, partie 1).
export type Statut = "operationnel" | "degrade" | "en_panne";

export type ResultatControle = {
  service: string;
  description: string;
  statut: Statut;
  latenceMs: number;
  message: string;
};

export type Controle = {
  service: string;
  description: string;
  verifier: () => Promise<string>;
};

const DELAI_MAX_MS = 5000;
const SEUIL_DEGRADE_MS = 2000;

export async function executerControle(controle: Controle): Promise<ResultatControle> {
  const debut = Date.now();
  let minuteur: ReturnType<typeof setTimeout> | undefined;

  const delaiDepasse = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(
      () => rejeter(new Error(`Aucune réponse après ${DELAI_MAX_MS / 1000} secondes`)),
      DELAI_MAX_MS
    );
  });

  try {
    const message = await Promise.race([controle.verifier(), delaiDepasse]);
    const latenceMs = Date.now() - debut;

    return {
      service: controle.service,
      description: controle.description,
      statut: latenceMs > SEUIL_DEGRADE_MS ? "degrade" : "operationnel",
      latenceMs,
      message,
    };
  } catch (erreur) {
    return {
      service: controle.service,
      description: controle.description,
      statut: "en_panne",
      latenceMs: Date.now() - debut,
      message: erreur instanceof Error ? erreur.message : "Erreur inconnue",
    };
  } finally {
    clearTimeout(minuteur);
  }
}
