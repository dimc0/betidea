# Architecture de Betidea

Même organisation que le TD1 : le navigateur ne parle qu'au back, et seul le back détient les clés.

```
Navigateur (ExplorateurMatchs, composant client)
   │  fetch
   ▼
Route Handlers : /api/saisons, /api/matchs, /api/analyses
   │                     │                    │
   ▼                     ▼                    ▼
API-Football         IA (Groq)            Supabase (table analyses)
                                              ▲
                     Pages serveur /analyses ─┘
```

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/lib/affiche.ts` | Types partagés (Saison, Equipe, Match, Statistique, Analyse) |
| `src/lib/football/normalisation.ts` | Réponses API-Football → types Betidea (pur, testé) |
| `src/lib/football/metier.ts` | Équipes de la saison, matchs d'une équipe, forme avant un match (pur, testé) |
| `src/lib/football/api-football.ts` | Appels à API-Football + cache (`server-only`) |
| `src/lib/ia.ts` | Client du modèle d'IA |
| `src/lib/generer-analyse.ts` | Consigne, schéma JSON, validation, nouvelle tentative |
| `src/lib/supabase.ts` | Client Supabase (`server-only`) |
| `src/app/api/*/route.ts` | Routes du back |
| `src/app/page.tsx` | Page d'accueil (composant serveur) |
| `src/components/ExplorateurMatchs.tsx` | Saison → équipe → matchs → analyse (composant client) |
| `src/components/DetailMatch.tsx` | Score, statistiques, analyse (affichage) |
| `src/components/AffichageAnalyse.tsx` | Texte de l'analyse (affichage) |
| `src/app/analyses/` | Liste et détail des analyses enregistrées |
| `src/lib/statut.ts` | Moteur des contrôles de santé (délai max, seuil « dégradé ») |
| `src/lib/controles.ts` | Contrôles de Vercel, de l'IA, d'API-Football et de Supabase (`server-only`) |
| `src/app/api/admin/statut/route.ts` | Lance les contrôles en parallèle, statut global = le pire |
| `src/app/admin/page.tsx` | Tableau de bord des services (composant client) |

## Points à savoir expliquer

- **Faits / IA** : score et statistiques viennent d'API-Football et sont affichés tels quels ; l'IA ne rédige que le texte (titre, résumé, points clés, limites).
- **Passé / futur** : la « forme » envoyée à l'IA ne contient que les matchs joués avant le match analysé (`formeAvantMatch`).
- **Cache** : une fonction `"use cache"` ne lève pas d'erreur (Next.js en masquerait le message en production) ; elle renvoie `{ ok, ... }` et l'erreur est levée en dehors.
- **Pages Supabase** : `await connection()` remplace `force-dynamic` (incompatible avec `cacheComponents`) ; `loading.tsx` sert de limite `<Suspense>`.
- **Quota IA** : un match déjà analysé est relu dans Supabase au lieu de rappeler l'IA.
