# Architecture de Betidea

Même organisation que le TD1 (« fiches de révision ») : le navigateur ne parle qu'au back de l'application, et seul le back détient les clés.

```
Navigateur (composants client)
   │  fetch
   ▼
Route Handlers (src/app/api/*, fonctions serverless)
   │                     │                         │
   ▼                     ▼                         ▼
API-Football         Modèle d'IA (Groq)        Supabase (table analyses)
                                                   ▲
                     Pages serveur /analyses ──────┘
```

`POST /api/analyses` enchaîne trois services : API-Football (données), le modèle (analyse), Supabase (enregistrement, statut 201). Comme au TD1 (partie 7.4), une panne du modèle et une panne de la base renvoient des messages différents.

## Fichiers

| Fichier | Rôle | Exécution |
| --- | --- | --- |
| `src/lib/affiche.ts` | Types partagés et `LIMITES` (front + back) | les deux |
| `src/lib/football/normalisation.ts` | Réponse brute API-Football → types Betidea, lecture du champ `errors` | les deux (pur) |
| `src/lib/football/metier.ts` | Bilans, séparation avant / après le match, objet envoyé à l'IA | les deux (pur) |
| `src/lib/football/api-football.ts` | Appels réseau, clé `API_FOOTBALL_KEY`, cache `"use cache"` | serveur (`server-only`) |
| `src/lib/ia.ts` | Client du modèle (`appelerModele`, `ErreurIA`) | serveur |
| `src/lib/generer-analyse.ts` | Consigne, schéma JSON, validation, nouvelle tentative | serveur |
| `src/lib/supabase.ts` | Client Supabase avec la clé secrète | serveur (`server-only`) |
| `supabase/analyses.sql` | Création de la table `analyses` + RLS | Supabase |
| `src/app/analyses/page.tsx` | Liste des analyses enregistrées | serveur |
| `src/app/analyses/[id]/page.tsx` | Détail d'une analyse | serveur |
| `src/app/analyses/loading.tsx` | Chargement + limite `<Suspense>` | serveur |
| `src/lib/limite.ts` | Limite indicative d'analyses par adresse | serveur |
| `src/app/api/competitions/route.ts` | `GET` compétitions et saisons passées | serveur |
| `src/app/api/matchs/route.ts` | `GET` matchs terminés d'une saison | serveur |
| `src/app/api/statistiques/route.ts` | `GET` statistiques d'un match | serveur |
| `src/app/api/analyses/route.ts` | `POST` analyse ou question complémentaire | serveur |
| `src/app/page.tsx` | Page d'accueil (composant serveur) | serveur |
| `src/components/ExplorateurMatchs.tsx` | Sélecteurs, liste des matchs | client |
| `src/components/DetailMatch.tsx` | Score, statistiques | client |
| `src/components/FormulaireAnalyse.tsx` | Perspective, questions, historique | client |
| `src/components/AffichageAnalyse.tsx` | Affichage d'une analyse | sans `"use client"` |
| `src/components/TableauStatistiques.tsx` | Tableau domicile / extérieur | sans `"use client"` |
| `src/components/ComparaisonEquipes.tsx` | Comparaison de deux équipes (calculs, sans IA) | client |

## Faits et interprétations

- **Faits** : score, statistiques et bilans sont affichés directement depuis API-Football ou calculés à partir des scores.
- **IA** : `resume`, `constats`, `interpretation` et `limites` sont rédigés par le modèle. `statistiques_pertinentes` ne contient que des noms de statistiques ; les valeurs sont reprises côté serveur (`filtrerStatistiquesCitees`).
- **Limites** : les `donnees_manquantes` calculées par le serveur sont toujours ajoutées aux limites affichées.

## Passé et futur

`construireDonneesAnalyse` range les données en trois blocs : `avant_le_match`, `le_match`, `apres_le_match`. En perspective `avant_match`, les deux derniers valent `null` : l'information n'est jamais envoyée au modèle. Changer de perspective vide la conversation, pour ne pas réinjecter un résultat via l'historique.

## Cache et erreurs

Next.js remplace en production le message d'une erreur levée dans une fonction `"use cache"`. Les fonctions mises en cache renvoient donc un objet `{ ok, donnees }` ou `{ ok: false, erreur, status }`, et l'erreur `ErreurFootball` est levée en dehors du cache. Une erreur est mise en cache avec `cacheLife("seconds")` seulement.
