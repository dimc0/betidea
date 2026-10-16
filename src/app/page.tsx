import ExplorateurMatchs from "@/components/ExplorateurMatchs";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-800 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
            Betidea · Football
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Analyse historique du football
          </h1>
          <p className="mt-2 text-slate-400">
            Explore les matchs terminés des saisons passées, consulte leurs statistiques réelles et
            demande à l&apos;IA de les analyser.
          </p>
        </header>

        <ExplorateurMatchs />
      </div>
    </main>
  );
}
