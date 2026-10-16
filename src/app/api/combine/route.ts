import { ErreurCotes } from "@/lib/combine/odds-api";
import { genererCombineInitial, modifierCombine } from "@/lib/combine/service";
import { ErreurIA } from "@/lib/ia";
import { connection } from "next/server";

export const maxDuration = 180;

const FENETRE_LIMITE_MS = 60 * 60 * 1000;
const OPERATIONS_MAX_PAR_FENETRE = 5;
const operationsParAdresse = new Map<string, { nombre: number; reinitialisation: number }>();

function consommerOperation(request: Request): number | null {
  const adresse =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "adresse-inconnue";
  const maintenant = Date.now();

  if (operationsParAdresse.size > 5000) {
    for (const [cle, valeur] of operationsParAdresse) {
      if (valeur.reinitialisation <= maintenant) operationsParAdresse.delete(cle);
    }
    while (operationsParAdresse.size > 5000) {
      const premiereCle = operationsParAdresse.keys().next().value as string | undefined;
      if (!premiereCle) break;
      operationsParAdresse.delete(premiereCle);
    }
  }

  const actuel = operationsParAdresse.get(adresse);
  if (!actuel || actuel.reinitialisation <= maintenant) {
    operationsParAdresse.set(adresse, {
      nombre: 1,
      reinitialisation: maintenant + FENETRE_LIMITE_MS,
    });
    return null;
  }

  if (actuel.nombre >= OPERATIONS_MAX_PAR_FENETRE) {
    return Math.max(1, Math.ceil((actuel.reinitialisation - maintenant) / 1000));
  }

  actuel.nombre += 1;
  return null;
}

function statutErreur(error: unknown, statutParDefaut: number): number {
  if (error instanceof ErreurCotes) return error.status;
  if (error instanceof ErreurIA && [400, 404, 413, 422, 429, 500, 502, 504].includes(error.status)) {
    return error.status;
  }
  return statutParDefaut;
}

function reponseErreur(error: unknown, statutParDefaut: number, fallback: string) {
  return Response.json(
    { erreur: error instanceof Error ? error.message : fallback },
    { status: statutErreur(error, statutParDefaut) }
  );
}

export async function GET() {
  try {
    await connection();
    const { snapshot, combine } = await genererCombineInitial();
    return Response.json({
      nombreMatchs: snapshot.nombreMatchs,
      recupereLe: snapshot.recupereLe,
      date: snapshot.date,
      source: snapshot.source,
      avertissements: snapshot.avertissements,
      combine,
    });
  } catch (error) {
    console.error("Erreur GET /api/combine :", error);
    return reponseErreur(error, 502, "Impossible de générer le combiné.");
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ erreur: "Le corps de la requête doit être du JSON valide." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ erreur: "Requête invalide." }, { status: 400 });
  }

  const contenu = body as { message?: unknown; selectionIds?: unknown };
  if (typeof contenu.message !== "string" || contenu.message.trim().length === 0) {
    return Response.json({ erreur: "Le champ message est obligatoire." }, { status: 400 });
  }
  if (contenu.message.length > 500) {
    return Response.json({ erreur: "La demande est limitée à 500 caractères." }, { status: 400 });
  }
  if (
    !Array.isArray(contenu.selectionIds) ||
    contenu.selectionIds.length < 2 ||
    contenu.selectionIds.length > 4 ||
    !contenu.selectionIds.every((id) => typeof id === "string")
  ) {
    return Response.json({ erreur: "Les identifiants des 2 à 4 sélections actuelles sont requis." }, { status: 400 });
  }

  const delaiRestant = consommerOperation(request);
  if (delaiRestant !== null) {
    return Response.json(
      { erreur: "Limite atteinte : 5 modifications de combiné par heure et par adresse réseau." },
      { status: 429, headers: { "Retry-After": String(delaiRestant) } }
    );
  }

  try {
    const resultat = await modifierCombine(contenu.message, contenu.selectionIds);
    return Response.json({
      nombreMatchs: resultat.snapshot.nombreMatchs,
      recupereLe: resultat.snapshot.recupereLe,
      date: resultat.snapshot.date,
      source: resultat.snapshot.source,
      avertissements: resultat.snapshot.avertissements,
      combine: resultat.combine,
      clarification: resultat.clarification,
    });
  } catch (error) {
    console.error("Erreur POST /api/combine :", error);
    return reponseErreur(error, 502, "Impossible de modifier le combiné.");
  }
}
