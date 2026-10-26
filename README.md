# Betidea

Application Next.js serverless d'analyse des matchs de **Ligue 1 des saisons passées**.

1. On choisit une saison (lue dans API-Football).
2. On choisit une équipe.
3. On clique sur un de ses matchs : l'IA l'analyse automatiquement, et l'analyse est enregistrée dans Supabase.

Il faut être connecté (lien magique envoyé par e-mail, Supabase Auth). Chaque utilisateur ne voit que ses propres analyses (Row Level Security).

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

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

ADMIN_EMAILS=
```

Seules l'URL du projet Supabase (adresse racine, sans `/rest/v1`) et sa clé publiable portent le préfixe `NEXT_PUBLIC_` : elles ne sont pas secrètes et le navigateur en a besoin pour la connexion. Les clés secrètes ne le portent jamais. `ADMIN_EMAILS` liste, séparées par des virgules, les adresses autorisées à ouvrir `/admin`. Sur Vercel : **Settings → Environment Variables** (clés en **Sensitive**), supprimer `SUPABASE_URL`, puis redéployer (les variables `NEXT_PUBLIC_` sont intégrées au moment du build).

Dans Supabase, exécuter dans le **SQL Editor** `supabase/analyses.sql`, puis `supabase/authentification.sql`. Dans **Authentication → URL Configuration**, déclarer la Site URL de production et les Redirect URLs `http://localhost:3000/**` et `https://<production>/**`.

## Routes

| Route | Rôle |
| --- | --- |
| `GET /api/saisons` | Saisons terminées de la Ligue 1 (`/leagues`) |
| `GET /api/matchs?saison=2023` | Matchs terminés de la saison (`/fixtures`, une seule requête) |
| `POST /api/analyses` `{ saison, match }` | Réservé aux utilisateurs connectés (401 sinon). Statistiques du match (`/fixtures/statistics`), analyse par l'IA, enregistrement dans Supabase. Si l'utilisateur a déjà analysé ce match, son analyse est renvoyée sans rappeler l'IA. |
| `GET /auth/callback` | Échange le code du lien magique contre une session |

Pages : `/connexion`, `/` (parcours), `/analyses` (mes analyses), `/analyses/[id]` (détail), `/admin` (état des services, administrateurs uniquement). Le proxy (`src/proxy.ts`) rafraîchit la session et redirige les visiteurs non connectés vers `/connexion`.

`GET /api/admin/statut` (401 sans session, 403 si l'adresse n'est pas dans `ADMIN_EMAILS`) contrôle en parallèle Vercel, le modèle d'IA, API-Football, Supabase Database et Supabase Auth (5 s maximum par service, « dégradé » au-delà de 2 s). Aucun contrôle ne consomme de quota : `GET /models` pour l'IA, `GET /status` pour API-Football, un simple décompte pour Supabase, la première page des utilisateurs pour Supabase Auth.

Pour changer de compétition, modifier `COMPETITION` dans `src/lib/football/api-football.ts`.

## Quotas et cache

Les réponses d'API-Football sont mises en cache une semaine (`"use cache"`) : une saison passée ne change plus. Une erreur n'est gardée que quelques secondes. Si ton offre refuse une saison, le message de l'API (qui indique les saisons autorisées) est affiché.

## Vérifications

```bash
npm run typecheck
npm run lint
npm run build
```
