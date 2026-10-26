import { NextResponse } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await creerClientServeur();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }

    console.error("Échec de l'échange du code de connexion :", error);
  }

  return NextResponse.redirect(`${origin}/connexion?erreur=lien-invalide`);
}
