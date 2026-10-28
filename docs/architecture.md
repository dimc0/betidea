# Architecture de Betidea

Même organisation que le TD1 : le navigateur ne parle qu'au back, et seul le back détient les clés secrètes. Seule exception (TD2) : le navigateur parle à Supabase Auth avec la clé publiable pour demander un lien de connexion et se déconnecter.

```
Navigateur (ExplorateurMatchs, composant client)
   │  fetch
   ▼
Route Handlers : /api/saisons, /api/matchs, /api/analyses
   │                     │                    │
   ▼                     ▼                    ▼
football-data.org    IA (Groq)            Supabase (tables analyses → points_cles)
                                              ▲
                     Pages serveur /analyses ─┘
```

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/lib/affiche.ts` | Types partagés (Saison, Equipe, Match, Statistique, Analyse) |
| `src/lib/football/normalisation.ts` | Réponses football-data.org → types Betidea (pur) |
| `src/lib/football/metier.ts` | Équipes de la saison, matchs d'une équipe, forme avant un match (pur) |
| `src/lib/football/football-data.ts` | Appels à football-data.org + cache (`server-only`) |
| `src/lib/ia.ts` | Client du modèle d'IA |
| `src/lib/generer-analyse.ts` | Consigne, schéma JSON, validation, nouvelle tentative |
| `src/lib/supabase/client.ts` | Client navigateur (clé publiable) : connexion, déconnexion |
| `src/lib/supabase/server.ts` | Client serveur (clé publiable + cookie de session, RLS appliquée) |
| `src/lib/supabase/admin.ts` | Client administrateur (clé secrète, RLS ignorée) : contrôles de `/admin` uniquement |
| `src/lib/supabase/proxy.ts` + `src/proxy.ts` | Rafraîchit la session à chaque requête, redirige vers `/connexion` |
| `src/lib/admin.ts` | `estAdministrateur` (liste `ADMIN_EMAILS`) |
| `src/lib/qstash.ts` | Client QStash et `publierGeneration` (message `{ analyseId }`, 3 nouvelles tentatives) |
| `src/app/api/jobs/generer-analyse/route.ts` | Worker : statistiques, forme, IA, statut `prete` ou `erreur` (client administrateur) |
| `src/lib/limitation.ts` | Client Upstash Redis et limiteur `limiteurAnalyses` (5 par heure, fenêtre glissante) |
| `src/app/connexion/`, `src/app/auth/callback/` | Lien magique : formulaire, puis échange du code contre une session |
| `src/components/EnTete.tsx` | Adresse de l'utilisateur et bouton de déconnexion |
| `src/app/api/*/route.ts` | Routes du back |
| `src/app/page.tsx` | Page d'accueil (composant serveur) |
| `src/components/ExplorateurMatchs.tsx` | Saison → équipe → matchs → analyse (composant client) |
| `src/components/DetailMatch.tsx` | Score, statistiques, analyse (affichage) |
| `src/components/AffichageAnalyse.tsx` | Texte de l'analyse (affichage) |
| `src/app/analyses/` | Liste et détail des analyses enregistrées |
| `src/lib/statut.ts` | Moteur des contrôles de santé (délai max, seuil « dégradé ») |
| `src/lib/controles.ts` | Contrôles de Vercel, de l'IA, de football-data.org, de Supabase Database et Auth, d'Upstash Redis et QStash, de Supabase Realtime (`server-only`) |
| `src/app/api/admin/statut/route.ts` | Lance les contrôles en parallèle, statut global = le pire |
| `src/app/admin/page.tsx` | Vérifie l'administrateur (composant serveur), 404 sinon |
| `src/components/TableauStatut.tsx` | Tableau de bord des services (composant client) |

## Points à savoir expliquer

- **Faits / IA** : score et score à la mi-temps viennent de football-data.org et sont affichés tels quels ; l'IA ne rédige que le texte (titre, résumé, points clés, limites).
- **Passé / futur** : la « forme » envoyée à l'IA ne contient que les matchs joués avant le match analysé (`formeAvantMatch`).
- **Cache** : une fonction `"use cache"` ne lève pas d'erreur (Next.js en masquerait le message en production) ; elle renvoie `{ ok, ... }` et l'erreur est levée en dehors.
- **Pages Supabase** : `await connection()` remplace `force-dynamic` (incompatible avec `cacheComponents`) ; `loading.tsx` sert de limite `<Suspense>`.
- **Quota IA** : un match déjà analysé par l'utilisateur est relu dans Supabase au lieu de rappeler l'IA.
- **Authentification / autorisation** : Supabase Auth dit qui est l'utilisateur ; la Row Level Security (`supabase/authentification.sql`) filtre les analyses par `user_id`. `user_id` vaut `auth.uid()` par défaut : la route n'envoie jamais l'auteur. Contrainte `unique (user_id, match_id)` : un même match peut être analysé par plusieurs utilisateurs.
- **Base de données** : deux tables liées. `analyses` (une ligne par match analysé et par utilisateur) et `points_cles` (`supabase/points-cles.sql`) : une analyse a plusieurs points clés (relation 1 → n), reliés par la clé étrangère `analyse_id` (`on delete cascade`). Chaque table a sa colonne `user_id` et sa Row Level Security (lecture de ses propres lignes uniquement). Le worker enregistre les points clés (client administrateur, `user_id` de l'analyse) avant de passer l'analyse à `prete` ; les lectures les récupèrent par jointure (`points_cles(position, texte)`). La ligne reçue en temps réel ne contient pas les points clés : le front relit alors `GET /api/analyses/[id]`.
- **Génération asynchrone** : `POST /api/analyses` (producteur) enregistre l'analyse `en_attente`, publie un message QStash et répond 202. QStash appelle le worker (consommateur) ; le front est prévenu par Supabase Realtime (partie 6, voir ci-dessous). Le message ne contient que l'identifiant : le worker relit la base.
- **Temps réel** : `ExplorateurMatchs` s'abonne (WebSocket, Supabase Realtime) aux `UPDATE` de son analyse (`filter: id=eq.…`). La table `analyses` est dans la publication `supabase_realtime` (`supabase/temps-reel.sql`) ; la RLS s'applique aussi aux événements. Juste après `SUBSCRIBED`, une lecture de `GET /api/analyses/[id]` évite la condition de concurrence (analyse terminée avant l'abonnement). Le canal est toujours fermé (`removeChannel`), délai maximal 90 s.
- **Worker** : signature QStash vérifiée (`verifySignatureAppRouter`), idempotent (ne traite qu'une analyse encore `en_attente`), client administrateur (pas de session). Erreur passagère (IA 429/5xx, football-data.org 429/503, réseau) : code 500, QStash réessaie. Erreur définitive ou dernière tentative : statut `erreur` et code 200.
- **Relance** : avec `unique (user_id, match_id)`, une analyse en échec est remise `en_attente` (client administrateur, la RLS n'autorise pas l'utilisateur à modifier ses analyses) puis republiée.
- **Limitation de débit** : 5 nouvelles analyses par heure et par utilisateur (identifiant Supabase, pas l'IP). Le quota est vérifié après la relecture d'une analyse déjà enregistrée (gratuite) et avant football-data.org et l'IA (coûteux). Si Redis est indisponible, la requête passe (« fail open ») et l'incident est journalisé.
- **Clé secrète** : le client administrateur ignore la RLS ; il n'est utilisé que pour les contrôles de `/admin`, jamais pour une requête faite au nom d'un utilisateur.
- **Session et cacheComponents** : tout ce qui lit le cookie est dans une limite `<Suspense>` (`EnTete` dans le layout, `loading.tsx` dans `/connexion`, `/admin`, `/analyses`).
