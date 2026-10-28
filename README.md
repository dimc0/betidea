# Betidea

## Présentation

Betidea analyse les matchs de **Ligue 1 des saisons passées**. L'utilisateur choisit une saison, une équipe, puis clique sur un de ses matchs : un modèle d'IA rédige une analyse (titre, résumé, points clés, limites), enregistrée dans son compte et consultable plus tard.

Elle s'adresse aux passionnés de football qui veulent revenir sur un match en quelques secondes. Tout repose sur des données réelles : le score et le score à la mi-temps viennent de football-data.org et sont affichés tels quels ; l'IA ne produit que du texte, à partir de ces données et de la forme des deux équipes **avant** le match. Aucune cote, aucun pari.

Parcours :

1. Connexion par lien magique reçu par e-mail.
2. Choix d'une saison (lue dans football-data.org, jamais codée en dur), puis d'une équipe.
3. Clic sur un match : la demande est acceptée immédiatement, l'analyse est générée en arrière-plan et s'affiche dès qu'elle est prête, sans recharger la page.
4. Retrouver ses analyses dans **Mes analyses**.

## Adresse de production

https://betidea-cyan.vercel.app

Vidéo de démonstration (54 s, sans son) : [captures/demo.mp4](https://github.com/dimc0/betidea/blob/main/captures/demo.mp4)

## Architecture

Le navigateur ne parle qu'au back de l'application (Route Handlers Next.js), qui détient toutes les clés.

| Service | Rôle |
| --- | --- |
| Vercel | Héberge le front et exécute le back et le worker en serverless |
| football-data.org | Saisons, matchs terminés et score à la mi-temps de la Ligue 1 |
| Groq | Modèle d'IA qui rédige l'analyse |
| Supabase Database | Tables `analyses` et `points_cles`, rattachées à leur auteur |
| Supabase Auth | Connexion sans mot de passe (lien magique, e-mails envoyés par le SMTP de Resend) |
| Upstash Redis | Limitation à 5 nouvelles analyses par heure et par utilisateur |
| **Upstash QStash** (brique) | Génération en arrière-plan |
| **Supabase Realtime** (brique) | Affichage de l'analyse dès qu'elle est prête |

**Pourquoi ces deux briques.** Une analyse demande plusieurs appels (football-data.org, puis l'IA, parfois deux fois si la réponse est mal formée) et peut prendre plusieurs dizaines de secondes. Avec **QStash**, `POST /api/analyses` enregistre la demande avec le statut `en_attente`, publie un message et répond `202` aussitôt. QStash appelle ensuite le worker `/api/jobs/generer-analyse`, qui vérifie la signature du message, ne traite qu'une analyse encore en attente (idempotence) et demande une nouvelle tentative (code 500) en cas d'erreur passagère : quota de l'IA ou de football-data.org, panne réseau. Une erreur définitive passe l'analyse en `erreur`, et l'utilisateur peut la relancer.

Comme la génération se fait ailleurs, le navigateur doit savoir quand elle est terminée. Plutôt que d'interroger le serveur toutes les deux secondes, il s'abonne avec **Supabase Realtime** aux modifications de son analyse, et la RLS garantit qu'il ne reçoit que les siennes. Juste après l'abonnement, il relit une fois l'état de l'analyse : elle a pu se terminer avant. Le canal est toujours fermé à la fin.

La page `/admin`, réservée aux adresses de `ADMIN_EMAILS` (404 pour les autres), contrôle en parallèle les 8 services : Vercel, le modèle d'IA, football-data.org, Supabase Database, Supabase Auth, Upstash Redis, Upstash QStash et Supabase Realtime. Aucun contrôle ne consomme de tokens d'IA ni de quota d'analyses (celui de football-data.org compte pour une requête sur les 10 autorisées par minute).

## Modèle d'IA

- **Fournisseur** : Groq, par son API compatible OpenAI (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`), appelé uniquement côté serveur.
- **Modèle** : `openai/gpt-oss-20b`.
- **Justification** : l'offre gratuite de Groq suffit pour le projet. Le modèle répond en quelques secondes et accepte un schéma JSON strict (`response_format: json_schema`). La tâche est courte et très encadrée (quelques données factuelles à commenter) : un modèle plus grand serait plus lent et consommerait plus de quota, sans apport visible.
- **Réponse vérifiée** : `src/lib/generer-analyse.ts` impose le schéma `titre`, `resume`, `points_cles`, `limites`, puis vérifie la réponse (`estReponseValide`). En cas de réponse invalide, le serveur fait une seconde tentative. La consigne interdit d'inventer des chiffres et de donner des conseils de pari, et demande d'ignorer toute instruction contenue dans les données.

## Structure de données

Deux tables dans Supabase, créées par les scripts du dossier `supabase/`, à exécuter dans cet ordre : `analyses.sql`, `authentification.sql`, `asynchrone.sql`, `temps-reel.sql`, `points-cles.sql`.

```
auth.users (Supabase Auth)
   │ 1
   │ n
analyses ──────────────── 1 → n ──── points_cles
  id                                   id
  user_id → auth.users                 analyse_id → analyses (on delete cascade)
  match_id, saison                     user_id → auth.users
  match, statistiques (jsonb)          position
  analyse (jsonb : titre, résumé,      texte
           limites)
  statut, message_erreur
```

- **`analyses`** : une ligne par match analysé et par utilisateur (`unique (user_id, match_id)`). `user_id` vaut `auth.uid()` par défaut : l'application n'envoie jamais l'auteur. `statut` vaut `en_attente`, `prete` ou `erreur`.
- **`points_cles`** : les points clés d'une analyse, un par ligne, avec leur position. Ils sont enregistrés par le worker avant le passage à `prete`, puis lus par jointure (`points_cles(position, texte)`).
- **Suppression** : supprimer un utilisateur supprime ses analyses, et supprimer une analyse supprime ses points clés (`on delete cascade`).

**Règles de sécurité (Row Level Security, activée sur les deux tables)** :

| Table | Lecture | Création | Modification |
| --- | --- | --- | --- |
| `analyses` | ses propres lignes | ses propres lignes | aucune (statut géré par le système) |
| `points_cles` | ses propres lignes | aucune (écrits par le worker) | aucune |

Toute requête faite au nom d'un utilisateur passe par le client serveur, avec sa session : la base ne renvoie que ses lignes. Le client administrateur (clé secrète, RLS ignorée) n'est utilisé que sans utilisateur : le worker appelé par QStash, la relance d'une analyse en échec et les contrôles de `/admin`.

## Lancer le projet en local

**Prérequis** : Node.js 22.17 ou plus, et des comptes gratuits Supabase, Groq, football-data.org et Upstash.

```bash
npm install
cp .env.example .env.local
```

Remplir `.env.local` :

| Variable | Valeur |
| --- | --- |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Groq : `https://api.groq.com/openai/v1`, une clé d'API, `openai/gpt-oss-20b` (sans `AI_BASE_URL` ni `AI_MODEL`, ce sont les valeurs par défaut) |
| `FOOTBALL_DATA_KEY` | Clé reçue par e-mail à l'inscription sur football-data.org |
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse racine du projet Supabase (sans `/rest/v1`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publiable Supabase (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Clé secrète Supabase, serveur uniquement |
| `ADMIN_EMAILS` | Adresses autorisées à ouvrir `/admin`, séparées par des virgules |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Base Redis Upstash (région européenne) |
| `APP_URL` | `http://localhost:3000` en local, l'adresse de production sur Vercel |
| `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | En local : valeurs affichées par le serveur QStash local ; en production : console Upstash |

Seules les deux variables `NEXT_PUBLIC_` arrivent dans le navigateur, et elles ne sont pas secrètes. Sans les clés de signature QStash, le build échoue.

Dans Supabase :

1. Dans le **SQL Editor**, exécuter les scripts du dossier `supabase/` dans l'ordre indiqué plus haut.
2. Dans **Authentication → URL Configuration**, déclarer la Site URL et les Redirect URLs `http://localhost:3000/**` et `https://<production>/**`.

Lancer l'application, dans deux terminaux :

```bash
npx @upstash/qstash-cli dev
npm run dev
```

Vérifications avant chaque envoi :

```bash
npm run lint
npm run typecheck
npm run build
```

Sur Vercel, déclarer les mêmes variables (clés marquées **Sensitive**, `APP_URL` et `QSTASH_*` de production), puis redéployer. Documentation détaillée : `docs/architecture.md` et `docs/football-data.md`.

## Limites et améliorations possibles

- **Données limitées** : l'offre gratuite de football-data.org ne donne que le score et le score à la mi-temps (ni tirs, ni possession, ni buteurs), et seulement les 3 dernières saisons terminées, à 10 requêtes par minute. L'analyse reste donc assez générale ; une API plus complète la rendrait beaucoup plus riche.
- **Pas de notification par e-mail** : un utilisateur qui quitte la page doit revenir dans « Mes analyses ». Resend, déjà utilisé pour les liens de connexion, pourrait le prévenir quand l'analyse est prête.
- **Pas d'observabilité en production** : les erreurs du worker ne sont visibles que dans les journaux de Vercel. Sentry et Langfuse (tokens, latence et coût de chaque analyse) seraient les prochaines briques.
- **Région** : les fonctions Vercel s'exécutent aux États-Unis (`iad1`) : placer les fonctions dans la même région que la base réduirait la latence de chaque requête.
- **Prévisualisations** : les secrets ne sont déclarés que pour la production, donc les déploiements de prévisualisation ne fonctionnent pas.
- **Pas de tests automatisés** ni de porte de qualité dans la construction Vercel.
- **Fonctionnalités** : impossible de supprimer une analyse ou de comparer deux matchs, et une seule compétition (constante `COMPETITION` dans `src/lib/football/football-data.ts`).
