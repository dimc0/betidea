import Link from "next/link";
import BoutonDeconnexion from "@/components/BoutonDeconnexion";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function EnTete() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <header className="border-b border-slate-800 bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 text-sm sm:px-8">
        <Link href="/" className="font-semibold text-emerald-400">
          Betidea
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">{user.email}</span>
          <BoutonDeconnexion />
        </div>
      </div>
    </header>
  );
}
