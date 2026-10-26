import { connection } from "next/server";
import { estAdministrateur } from "@/lib/admin";
import { CONTROLES } from "@/lib/controles";
import { executerControle, type Statut } from "@/lib/statut";
import { creerClientServeur } from "@/lib/supabase/server";

export async function GET() {
  // Équivalent de « force-dynamic » avec cacheComponents : les contrôles sont
  // réellement exécutés à chaque appel, jamais servis depuis un cache.
  await connection();

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ erreur: "Authentification requise." }, { status: 401 });
  }

  if (!estAdministrateur(user.email)) {
    return Response.json({ erreur: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  const services = await Promise.all(CONTROLES.map(executerControle));

  let statutGlobal: Statut = "operationnel";
  if (services.some((s) => s.statut === "degrade")) statutGlobal = "degrade";
  if (services.some((s) => s.statut === "en_panne")) statutGlobal = "en_panne";

  return Response.json({
    verifieLe: new Date().toISOString(),
    statutGlobal,
    services,
  });
}
