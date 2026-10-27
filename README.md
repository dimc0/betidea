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

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

APP_URL=
QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

Seules l'URL du projet Supabase (adresse racine, sans `/rest/v1`) et sa clé publiable portent le préfixe `NEXT_PUBLIC_` : elles ne sont pas secrètes et le navigateur en a besoin pour la connexion. Les clés secrètes ne le portent jamais. `ADMIN_EMAILS` liste, séparées par des virgules, les adresses autorisées à ouvrir `/admin`. `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` viennent de la base Redis créée sur console.upstash.com (région européenne, offre gratuite). `APP_URL` est l'adresse de l'application, où QStash livre les messages. En local, les variables `QSTASH_*` sont celles affichées par le serveur QStash local (`npx @upstash/qstash-cli dev`, dans un second terminal) ; en production, celles de la rubrique QStash de la console Upstash. Sans clés de signature, le build échoue. Sur Vercel : **Settings → Environment Variables** (clés en **Sensitive**), supprimer `SUPABASE_URL`, puis redéployer (les variables `NEXT_PUBLIC_` sont intégrées au moment du build).

Dans Supabase, exécuter dans le **SQL Editor** `supabase/analyses.sql`, puis `supabase/authentification.sql`, puis `supabase/asynchrone.sql`. Dans **Authentication → URL Configuration**, déclarer la Site URL de production et les Redirect URLs `http://localhost:3000/**` et `https://<production>/**`.

## Routes

| Route | Rôle |
| --- | --- |
| `GET /api/saisons` | Saisons terminées de la Ligue 1 (`/leagues`) |
| `GET /api/matchs?saison=2023` | Matchs terminés de la saison (`/fixtures`, une seule requête) |
| `POST /api/analyses` `{ saison, match }` | Réservé aux utilisateurs connectés (401 sinon). Enregistre la demande (statut `en_attente`), publie un message QStash et répond **202** `{ id, statut }`. Si l'utilisateur a déjà demandé ce match, sa demande (prête ou en cours) est renvoyée ; une analyse en échec est relancée. Quota de 5 nouvelles analyses par heure et par utilisateur (Upstash Redis, fenêtre glissante) : 429 + `Retry-After` au-delà, `X-RateLimit-Remaining` sur chaque réponse. |
| `GET /api/analyses/[id]` | État d'une analyse (`en_attente`, `prete`, `erreur`), interrogé toutes les 2 s par le front |
| `POST /api/jobs/generer-analyse` | Worker appelé par QStash (signature vérifiée) : statistiques (`/fixtures/statistics`), forme, analyse par l'IA, enregistrement. Réessayé par QStash en cas d'erreur passagère |
| `GET /auth/callback` | Échange le code du lien magique contre une session |

Pages : `/connexion`, `/` (parcours), `/analyses` (mes analyses), `/analyses/[id]` (détail), `/admin` (état des services, administrateurs uniquement). Le proxy (`src/proxy.ts`) rafraîchit la session et redirige les visiteurs non connectés vers `/connexion`.

`GET /api/admin/statut` (401 sans session, 403 si l'adresse n'est pas dans `ADMIN_EMAILS`) contrôle en parallèle Vercel, le modèle d'IA, API-Football, Supabase Database, Supabase Auth, Upstash Redis et Upstash QStash (5 s maximum par service, « dégradé » au-delà de 2 s). Aucun contrôle ne consomme de quota : `GET /models` pour l'IA, `GET /status` pour API-Football, un simple décompte pour Supabase, la première page des utilisateurs pour Supabase Auth, `PING` pour Redis, la liste des planifications pour QStash.

Pour changer de compétition, modifier `COMPETITION` dans `src/lib/football/api-football.ts`.

## Quotas et cache

Les réponses d'API-Football sont mises en cache une semaine (`"use cache"`) : une saison passée ne change plus. Une erreur n'est gardée que quelques secondes. Si ton offre refuse une saison, le message de l'API (qui indique les saisons autorisées) est affiché.

## Vérifications

```bash
npm run typecheck
npm run lint
npm run build
```
