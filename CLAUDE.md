@AGENTS.md

# Betidea — consignes pour Claude

Projet de Bachelor Développement Web : application Next.js 16 serverless qui analyse les matchs de Ligue 1 des saisons passées (API-Football + IA Groq + Supabase). L'étudiant doit pouvoir expliquer chaque ligne à l'oral : **garder l'application la plus simple possible**.

Parcours unique : saison → équipe → liste de ses matchs → clic → analyse automatique (enregistrée dans Supabase).

## Méthode à respecter (TD du module)

- Suivre la structure du TD1 « fiches de révision » : types partagés (`src/lib/affiche.ts`), client IA unique (`src/lib/ia.ts`), génération dans `src/lib/generer-analyse.ts` (`CONSIGNE_SYSTEME`, `SCHEMA_ANALYSE`, `NOMBRE_TENTATIVES`, `estReponseValide`, `tenterGeneration`), routes qui valident ce qui vient du front et finissent par une fonction `reponseErreur…`.
- Page d'accueil en composant serveur ; `"use client"` seulement sur `ExplorateurMatchs` ; composants d'affichage sans `"use client"`.
- Code simple, noms en français, pas d'abstraction ni de dépendance non justifiée. Ne pas rajouter de fonctionnalités non demandées.
- Jamais de clé dans le code ni de variable `NEXT_PUBLIC_` pour un secret. Les fichiers qui lisent une clé importent `server-only`.

## Règles produit

- Saisons passées uniquement, lues depuis API-Football (`/leagues`), jamais codées en dur. Compétition : constante `COMPETITION` dans `api-football.ts`.
- Aucune donnée fictive. Ni cotes, ni paris.
- Score et statistiques affichés depuis API-Football ; l'IA ne produit que du texte.
- La forme envoyée à l'IA ne contient que les matchs antérieurs au match analysé.

## Pièges techniques connus

- `cacheComponents: true` : cache via `"use cache"` + `cacheLife`. Une fonction `"use cache"` ne doit pas lever d'erreur (message masqué en production) : elle renvoie `{ ok, ... }`, `cacheLife("seconds")` pour les erreurs.
- `await connection()` hors d'un `try/catch` dans un Route Handler.
- Pages qui lisent Supabase : `await connection()` au lieu de `force-dynamic`, et `loading.tsx` dans le dossier comme limite `<Suspense>`.
- API-Football répond en HTTP 200 même en erreur : lire `errors` (`lireErreurApi`).
- Après suppression d'une route, `.next/types` peut garder d'anciens types : relancer `npm run build` avant `npm run typecheck`.
- Lire `node_modules/next/dist/docs/` avant d'utiliser une API Next.js.

## Commandes

```bash
npm run test       # tests purs, sans réseau (tests/football.test.mjs)
npm run typecheck
npm run lint
npm run build
```

Les fichiers testés par `node --test` (`normalisation.ts`, `metier.ts`) ne doivent importer que des types via `@/`.

Documentation : `docs/architecture.md`, `docs/api-football.md`.
