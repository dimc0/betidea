import { genererCombineInitial, modifierCombine } from "@/lib/combine/service";
import { ErreurIA } from "@/lib/ia";

export const maxDuration = 180;

function statutErreur(error: unknown, statutParDefaut: number): number {
  if (error instanceof ErreurIA && [413, 429, 500, 502, 504].includes(error.status)) {
    return error.status;
  }
  return statutParDefaut;
}

export async function GET() {
  try {
    const { snapshot, combine } = await genererCombineInitial();
    return Response.json({
      matchs: snapshot.matchs,
      nombreMatchs: snapshot.nombreMatchs,
      recupereLe: snapshot.recupereLe,
      source: snapshot.source,
      combine,
    });
  } catch (error) {
    console.error("Erreur GET /api/combine :", error);
    return Response.json(
      { erreur: error instanceof Error ? error.message : "Impossible de générer le combiné." },
      { status: statutErreur(error, 502) }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ erreur: "Le corps de la requête doit être du JSON valide." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ erreur: "Requête invalide." }, { status: 400 });
  }

  const contenu = body as { message?: unknown; combine?: unknown };
  if (typeof contenu.message !== "string") {
    return Response.json({ erreur: "Le champ message est obligatoire." }, { status: 400 });
  }

  try {
    const { snapshot, combine } = await modifierCombine(contenu.message, contenu.combine);
    return Response.json({
      matchs: snapshot.matchs,
      nombreMatchs: snapshot.nombreMatchs,
      recupereLe: snapshot.recupereLe,
      source: snapshot.source,
      combine,
    });
  } catch (error) {
    console.error("Erreur POST /api/combine :", error);
    const message = error instanceof Error ? error.message : "Impossible de modifier le combiné.";
    return Response.json({ erreur: message }, { status: statutErreur(error, 400) });
  }
}
