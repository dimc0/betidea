@AGENTS.md

# Betidea — consignes pour Claude

Projet de Bachelor Développement Web : application Next.js 16 serverless d'**analyse historique du football** (API-Football + IA Groq). L'étudiant doit pouvoir expliquer chaque ligne à l'oral.

## Méthode à respecter (TD du module)

- Suivre la structure du TD1 « fiches de révision » : types + `LIMITES` partagés (`src/lib/affiche.ts`), client IA unique (`src/lib/ia.ts`), génération dans `src/lib/generer-*.ts` (`CONSIGNE_SYSTEME`, `SCHEMA_*`, `NOMBRE_TENTATIVES`, `estReponseValide`, `tenterGeneration`), routes qui valident tout ce qui vient du front et finissent par une fonction `reponseErreur`.
- Page d'accueil en composant serveur ; `"use client"` seulement sur les composants interactifs ; composants d'affichage sans `"use client"`.
- Code simple et lisible, noms en français, pas d'abstraction ni de dépendance non justifiée.
- Ne jamais écrire une clé dans le code, ne jamais créer de variable `NEXT_PUBLIC_` pour un secret. Les fichiers qui lisent une clé importent `server-only`.

## Règles produit

- Uniquement des saisons passées, lues depuis API-Football (`/leagues`), jamais codées en dur.
- Aucune donnée fictive : si l'API ne renvoie pas une information, l'afficher comme absente.
- Ni cotes, ni bookmakers, ni combinés, ni conseils de pari.
- Séparer passé et futur : la perspective `avant_match` exclut score, statistiques et matchs postérieurs dans `construireDonneesAnalyse` (code, pas seulement consigne).
- Les valeurs statistiques affichées viennent d'API-Football, jamais du texte de l'IA.

## Pièges techniques connus

- `cacheComponents: true` : le cache passe par `"use cache"` + `cacheLife`. Une erreur levée dans une fonction `"use cache"` perd son message en production : renvoyer `{ ok: false, erreur, status }` et utiliser `cacheLife("seconds")` pour les erreurs (voir `src/lib/football/api-football.ts`).
- `await connection()` doit rester hors d'un `try/catch` dans un Route Handler.
- Pages qui lisent Supabase : `await connection()` à la place de `export const dynamic = "force-dynamic"` (incompatible avec `cacheComponents`), et un `loading.tsx` dans le dossier comme limite `<Suspense>` (sinon `next build` échoue).
- Table Supabase : `supabase/analyses.sql` (RLS activée sans règle, accès uniquement via `SUPABASE_SECRET_KEY` dans `src/lib/supabase.ts`).
- API-Football répond en HTTP 200 même en erreur : lire le champ `errors` (`lireErreurApi`).
- Lire `node_modules/next/dist/docs/` avant d'utiliser une API Next.js.

## Commandes

```bash
npm run test       # tests purs, sans réseau (tests/football.test.mjs)
npm run typecheck
npm run lint
npm run build
```

Les fichiers testés par `node --test` (`normalisation.ts`, `metier.ts`) ne doivent importer que des types via `@/` (les imports de valeurs `@/` ne sont pas résolus par Node).

Documentation : `docs/architecture.md`, `docs/api-football.md`.
