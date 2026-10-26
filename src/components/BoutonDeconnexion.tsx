"use client";

import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";

export default function BoutonDeconnexion() {
  const router = useRouter();

  async function deconnecter() {
    await creerClientNavigateur().auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  return (
    <button onClick={deconnecter} className="text-emerald-300 underline">
      Se déconnecter
    </button>
  );
}
