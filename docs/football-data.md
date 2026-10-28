# football-data.org (API v4) — notes d'intégration

Base : `https://api.football-data.org/v4` — authentification par l'en-tête `X-Auth-Token` (variable serveur `FOOTBALL_DATA_KEY`, clé gratuite obtenue sur football-data.org/client/register).

Remplace API-Football, qui a supprimé le compte : son offre gratuite n'autorise pas une utilisation depuis Vercel.

## Offre gratuite

- 12 compétitions, dont la Ligue 1 (code `FL1`), 10 requêtes par minute, pas de quota journalier.
- Seules la saison en cours et les **3 précédentes** sont accessibles (vérifié : 2026/27 en cours, 2025/26, 2024/25, 2023/24 ; 2022/23 et avant → 403). Betidea ne propose donc que les 3 dernières saisons terminées (`SAISONS_ACCESSIBLES` dans `football-data.ts`).
- Pas de statistiques de match (tirs, possession), ni de compositions, ni de buteurs : seulement le score final et le score à la mi-temps.

## Endpoints utilisés

| Endpoint | Paramètres | Usage | Cache |
| --- | --- | --- | --- |
| `/competitions/FL1` | — | Saisons (`seasons[].startDate`, `endDate`) | 1 semaine |
| `/competitions/FL1/matches` | `season` (année de début) | Tous les matchs d'une saison en une requête ; seuls les `status: "FINISHED"` sont gardés | 1 semaine |
| `/matches/{id}` | — | Score à la mi-temps (`score.halfTime`), seule « statistique » disponible | 1 semaine |

Champs lus dans un match : `id`, `utcDate`, `matchday`, `status`, `homeTeam/awayTeam.id/shortName`, `score.fullTime.home/away`.

## Erreurs

Contrairement à API-Football, football-data.org utilise les codes HTTP. Le corps vaut `{ message, errorCode }`.

| Code reçu | Signification | Statut renvoyé par Betidea |
| --- | --- | --- |
| 400 / 401 | Clé absente ou invalide | 502 |
| 403 | Ressource hors de l'offre (saison trop ancienne) | 403 |
| 429 | Plus de 10 requêtes par minute | 429 |
| autre | Erreur du service | 502 |

Traduction dans `lireErreurApi` (`src/lib/football/normalisation.ts`).

## Coût en requêtes

- Ouverture de l'application : 1 requête `/competitions/FL1` (puis cache).
- Choix d'une saison : 1 requête `/matches` de la saison (puis cache).
- Analyse d'un match jamais analysé : 1 requête `/matches/{id}` dans le worker. Un match déjà analysé est relu dans Supabase (0 requête).

## Vérification manuelle (avec la clé)

```bash
curl -s -H "X-Auth-Token: $FOOTBALL_DATA_KEY" https://api.football-data.org/v4/competitions/FL1
curl -s -H "X-Auth-Token: $FOOTBALL_DATA_KEY" "https://api.football-data.org/v4/competitions/FL1/matches?season=2024" | head -c 600
```

L'en-tête de réponse `X-Requests-Available-Minute` indique les requêtes restantes dans la minute.
