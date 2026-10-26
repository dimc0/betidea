// La page vérifie la session avant d'afficher le tableau : avec cacheComponents,
// ce fichier sert de limite <Suspense> (comme dans /analyses).
export default function Chargement() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <p className="mx-auto max-w-4xl animate-pulse text-slate-400">Chargement…</p>
    </main>
  );
}
