@AGENTS.md

# Betidea — consignes pour Claude

Projet de Bachelor Développement Web : application Next.js 16 serverless qui analyse les matchs de Ligue 1 des saisons passées (football-data.org + IA Groq + Supabase). L'étudiant doit pouvoir expliquer chaque ligne à l'oral : **garder l'application la plus simple possible**.

Parcours unique : saison → équipe → liste de ses matchs → clic → analyse automatique (enregistrée dans Supabase).

## Méthode à respecter (TD du module)

- Suivre la structure du TD1 « fiches de révision » : types partagés (`src/lib/affiche.ts`), client IA unique (`src/lib/ia.ts`), génération dans `src/lib/generer-analyse.ts` (`CONSIGNE_SYSTEME`, `SCHEMA_ANALYSE`, `NOMBRE_TENTATIVES`, `estReponseValide`, `tenterGeneration`), routes qui valident ce qui vient du front et finissent par une fonction `reponseErreur…`.
- Page d'accueil en composant serveur ; `"use client"` seulement sur `ExplorateurMatchs`, `TableauStatut`, `FormulaireConnexion` et `BoutonDeconnexion` (comme dans le TD2) ; composants d'affichage sans `"use client"`.
- Code simple, noms en français, pas d'abstraction ni de dépendance non justifiée. Ne pas rajouter de fonctionnalités non demandées.
- Jamais de clé dans le code ni de variable `NEXT_PUBLIC_` pour un secret (seules `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sont publiques). Les fichiers qui lisent une clé secrète importent `server-only`.
- Requête faite au nom d'un utilisateur → `creerClientServeur()` (RLS). `creerClientAdmin()` seulement sans utilisateur (contrôles de `/admin`).

## Git

- Ne jamais mentionner Claude dans les noms de branche, les messages de commit ou les pull requests : pas de préfixe `claude/`, pas de lignes `Co-Authored-By` ni `Claude-Session`.

## Règles produit

- Saisons passées uniquement, lues depuis football-data.org (`/competitions/FL1`), jamais codées en dur. Compétition : constante `COMPETITION` dans `football-data.ts`. API-Football a été abandonnée (compte supprimé : offre gratuite interdite sur Vercel).
- Aucune donnée fictive. Ni cotes, ni paris.
- Score et score à la mi-temps affichés depuis football-data.org (offre gratuite : pas d'autres statistiques) ; l'IA ne produit que du texte.
- La forme envoyée à l'IA ne contient que les matchs antérieurs au match analysé.

## TD2

- Partie 1 faite : page `/admin` + `GET /api/admin/statut` (`src/lib/statut.ts`, `src/lib/controles.ts`). Contrôles : Vercel, modèle d'IA (`GET /models`), football-data.org (`GET /competitions/FL1`), Supabase (`count` sur `analyses`), Supabase Auth (`listUsers`).
- Partie 2 faite : connexion par lien magique (`/connexion`, `/auth/callback`), proxy de session (`src/proxy.ts`), analyses par utilisateur (`supabase/authentification.sql`, RLS, `unique (user_id, match_id)`), `/admin` réservée à `ADMIN_EMAILS` (404 page, 401/403 route). SMTP Resend configuré dans Supabase (2.12).
- Partie 3 (PDF, stockage) non faite.
- Partie 4 faite : limitation de débit Upstash Redis (`src/lib/limitation.ts`, `limiteurAnalyses`, 5/h, préfixe `betidea:analyses`), vérifiée dans `POST /api/analyses` après la relecture d'une analyse existante et avant football-data.org, fail open ; quota restant affiché dans `ExplorateurMatchs` ; contrôle Upstash Redis (`PING`) dans `/admin`.
- Partie 5 faite : génération asynchrone avec QStash. `POST /api/analyses` enregistre `en_attente` (ou relance une analyse en `erreur`), publie (`src/lib/qstash.ts`) et répond 202 ; worker `src/app/api/jobs/generer-analyse/route.ts` (signature, idempotence, client admin, 500 = réessayer) ; colonnes `statut`, `message_erreur` (`supabase/asynchrone.sql`) ; contrôle Upstash QStash dans `/admin`.
- Partie 6 faite : Supabase Realtime remplace le polling. `attendreAnalyse` (`ExplorateurMatchs`) s'abonne aux `UPDATE` de l'analyse, vérifie une fois l'état après `SUBSCRIBED`, ferme toujours le canal ; table `analyses` dans `supabase_realtime` (`supabase/temps-reel.sql`) ; contrôle Supabase Realtime dans `/admin` (8 services).
- Adapter chaque partie du TD au projet (analyses de matchs au lieu de fiches, `connection()` au lieu de `force-dynamic`), en gardant le code du TD le plus fidèle possible.

## Pièges techniques connus

- `cacheComponents: true` : cache via `"use cache"` + `cacheLife`. Une fonction `"use cache"` ne doit pas lever d'erreur (message masqué en production) : elle renvoie `{ ok, ... }`, `cacheLife("seconds")` pour les erreurs.
- `await connection()` hors d'un `try/catch` dans un Route Handler.
- Pages qui lisent Supabase : `await connection()` au lieu de `force-dynamic`, et `loading.tsx` dans le dossier comme limite `<Suspense>`.
- Lecture du cookie de session (`creerClientServeur`) hors `<Suspense>` = erreur de build : `EnTete` est dans un `<Suspense>` du layout, les pages concernées ont un `loading.tsx`.
- `partialPrefetching` lit la session pendant le prérendu, et Supabase appelle alors `Date.now()` (erreur « unstable value Date.now() ») : `await connection()` avant `creerClientServeur()` dans chaque composant serveur ou page qui lit la session.
- `verifySignatureAppRouter` lève une erreur au chargement si `QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` manquent : build impossible sans ces variables (local et Vercel).
- football-data.org : vrais codes HTTP (400 clé, 403 saison hors offre gratuite, 429 = 10 requêtes/min), traduits par `lireErreurApi`. Offre gratuite limitée aux dernières saisons.
- Après suppression d'une route, `.next/types` peut garder d'anciens types : relancer `npm run build` avant `npm run typecheck`.
- Lire `node_modules/next/dist/docs/` avant d'utiliser une API Next.js.

## Commandes

```bash
npm run typecheck
npm run lint
npm run build
```

Documentation : `docs/architecture.md`, `docs/football-data.md`.
