# Betidea

Application Next.js serverless d'analyse des matchs de **Ligue 1 des saisons passées**.

1. On choisit une saison (lue dans API-Football).
2. On choisit une équipe.
3. On clique sur un de ses matchs : l'IA l'analyse automatiquement, et l'analyse est enregistrée dans Supabase.

## Lancer le projet

```bash
npm install
npm run dev
```

Créer `.env.local` à partir de `.env.example` :

```env
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=
AI_MODEL=openai/gpt-oss-20b
API_FOOTBALL_KEY=

SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

Aucune de ces variables ne doit porter le préfixe `NEXT_PUBLIC_`. Sur Vercel : **Settings → Environment Variables** (clés en **Sensitive**), puis redéployer.

Dans Supabase, exécuter `supabase/analyses.sql` dans le **SQL Editor**.

## Routes

| Route | Rôle |
| --- | --- |
| `GET /api/saisons` | Saisons terminées de la Ligue 1 (`/leagues`) |
| `GET /api/matchs?saison=2023` | Matchs terminés de la saison (`/fixtures`, une seule requête) |
| `POST /api/analyses` `{ saison, match }` | Statistiques du match (`/fixtures/statistics`), analyse par l'IA, enregistrement dans Supabase. Si le match a déjà été analysé, l'analyse enregistrée est renvoyée sans rappeler l'IA. |

Pages : `/` (parcours), `/analyses` (liste), `/analyses/[id]` (détail).

Pour changer de compétition, modifier `COMPETITION` dans `src/lib/football/api-football.ts`.

## Quotas et cache

Les réponses d'API-Football sont mises en cache une semaine (`"use cache"`) : une saison passée ne change plus. Une erreur n'est gardée que quelques secondes. Si ton offre refuse une saison, le message de l'API (qui indique les saisons autorisées) est affiché.

## Vérifications

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```
