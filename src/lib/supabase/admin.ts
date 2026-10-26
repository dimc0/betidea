import "server-only";
import { createClient } from "@supabase/supabase-js";

// Ce client utilise la clé secrète : il ignore la Row Level Security.
// Il ne doit servir qu'aux traitements sans utilisateur connecté.
export function creerClientAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SECRET_KEY;

  if (!url || !cle) {
    throw new Error("La configuration de Supabase est incomplète.");
  }

  return createClient(url, cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
