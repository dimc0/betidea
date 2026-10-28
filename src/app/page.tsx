import Link from "next/link";
import ExplorateurMatchs from "@/components/ExplorateurMatchs";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-slate-800 pb-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              Betidea · Ligue 1
            </p>
            <Link href="/analyses" className="text-sm text-emerald-300 underline">
              Mes analyses
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-bold">Analyse des matchs des saisons passées</h1>
        </header>

        <ExplorateurMatchs />
      </div>
    </main>
  );
}
