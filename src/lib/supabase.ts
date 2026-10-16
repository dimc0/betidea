import "server-only";
import { createClient } from "@supabase/supabase-js";

export function creerClientSupabase() {
  const url = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SECRET_KEY;

  if (!url || !cle) {
    throw new Error("La configuration de Supabase est incomplète.");
  }

  return createClient(url, cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
