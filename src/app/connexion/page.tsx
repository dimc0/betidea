import { redirect } from "next/navigation";
import FormulaireConnexion from "@/components/FormulaireConnexion";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const { erreur } = await searchParams;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
          Betidea · Ligue 1
        </p>
        <h1 className="mt-2 text-3xl font-bold">Connexion</h1>
        <p className="mt-2 text-slate-400">
          Saisissez votre adresse e-mail : vous recevrez un lien pour vous connecter, sans
          mot de passe.
        </p>
        <FormulaireConnexion erreurLien={erreur === "lien-invalide"} />
      </div>
    </main>
  );
}
