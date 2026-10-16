# Betidea

Application Next.js serverless d'**analyse historique du football**. L'utilisateur choisit une compétition et une saison passée, parcourt les matchs terminés, consulte le score et les statistiques fournis par [API-Football](https://www.api-football.com/), puis demande à une IA d'analyser le match en langage naturel.

Betidea ne récupère ni matchs du jour, ni cotes, et ne propose aucun pari.

## Lancer le projet

```bash
npm install
npm run dev
```

Copier `.env.example` vers `.env.local`, puis renseigner les clés uniquement dans le fichier local :

```env
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=
AI_MODEL=openai/gpt-oss-20b
API_FOOTBALL_KEY=

SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

Les clés sont lues uniquement côté serveur : ne jamais les préfixer par `NEXT_PUBLIC_`. Sur Vercel, ajouter ces six variables dans **Settings → Environment Variables** (clés marquées **Sensitive**), puis redéployer.

### Base de données Supabase

Dans le **SQL Editor** de Supabase, exécuter `supabase/analyses.sql` : il crée la table `analyses` et active la Row Level Security (aucune règle : seule la clé secrète du serveur y accède). `SUPABASE_URL` est l'adresse racine du projet (`https://xxxx.supabase.co`, sans `/rest/v1`).

## Fonctionnement

1. `GET /api/competitions` : Ligue 1, Premier League, Bundesliga, Serie A, La Liga et Ligue des champions, avec leurs **saisons terminées** lues dans `/leagues` (aucune saison n'est écrite dans le code).
2. `GET /api/matchs?competition=61&saison=2023` : matchs terminés (`FT`, `AET`, `PEN`) de la saison, en **une seule requête** `/fixtures`.
3. `GET /api/statistiques?competition=61&saison=2023&match=…` : statistiques `/fixtures/statistics` associées à chaque équipe par son identifiant. Aucune requête n'est envoyée si API-Football n'annonce pas de statistiques pour la saison.
4. `POST /api/analyses` : le serveur retrouve le match, construit un objet de données typé, puis demande au modèle une analyse structurée (schéma JSON validé côté serveur, deux tentatives).

Deux perspectives d'analyse :

- **Rétrospective** : score, statistiques et suite de la saison sont fournis à l'IA.
- **Avant le coup d'envoi** : le serveur retire lui-même le score, les statistiques et les matchs postérieurs. L'IA ne peut donc pas s'en servir.

Chaque analyse est enregistrée dans Supabase (statut `201`), puis consultable sur `/analyses` (liste) et `/analyses/[id]` (détail). Ces pages lisent la base directement depuis des composants serveur ; `await connection()` les rend dynamiques (équivalent de `force-dynamic` avec `cacheComponents`), et `loading.tsx` fournit la limite `<Suspense>` exigée par Next.js 16.

Les statistiques citées par l'IA sont réaffichées avec les valeurs d'API-Football ; une statistique inconnue est ignorée. Les questions complémentaires renvoient les derniers échanges au modèle comme contexte de conversation.

## Quotas et cache

Les réponses d'API-Football sont mises en cache avec `"use cache"` : 1 jour pour les compétitions, 1 semaine pour les matchs et statistiques d'une saison passée. Une erreur (quota, saison refusée par l'offre…) n'est conservée que quelques secondes. Le cache est propre à chaque instance serverless.

Les analyses IA sont limitées à 20 par heure et par adresse réseau. Cette limite est gardée en mémoire : elle est indicative sur Vercel, puisqu'une fonction serverless est sans état.

L'offre gratuite d'API-Football limite les saisons accessibles : si une saison est refusée, le message renvoyé par l'API (qui indique les saisons autorisées) est affiché tel quel.

## Vérifications

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Les tests (`tests/football.test.mjs`) portent sur la logique pure et n'appellent ni API-Football ni le modèle d'IA.

Voir aussi `docs/api-football.md` et `docs/architecture.md`.
