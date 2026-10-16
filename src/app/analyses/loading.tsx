// Affiché pendant que la page interroge Supabase. Avec cacheComponents,
// ce fichier sert aussi de limite <Suspense> autour des pages dynamiques.
export default function Chargement() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <p className="mx-auto max-w-3xl animate-pulse text-slate-400">Chargement des analyses…</p>
    </main>
  );
}
