# API-Football v3 — notes d'intégration

Base : `https://v3.football.api-sports.io` — authentification par l'en-tête `x-apisports-key` (variable serveur `API_FOOTBALL_KEY`).

> Ces notes décrivent l'usage fait par Betidea. Les endpoints et formats n'ont pas pu être interrogés depuis l'environnement de développement cloud (réseau bloqué) : le code valide donc chaque champ avant de l'utiliser. À revérifier avec la clé réelle (voir « Vérification manuelle »).

## Endpoints utilisés

| Endpoint | Paramètres | Usage | Cache |
| --- | --- | --- | --- |
| `/leagues` | `id` | Saisons (`year`, `start`, `end`) | 1 semaine |
| `/fixtures` | `league`, `season`, `status=FT-AET-PEN` | Tous les matchs terminés d'une saison en une requête | 1 semaine |
| `/fixtures/statistics` | `fixture` | Un bloc par équipe (`team.id`, `statistics[].type/value`) | 1 semaine |

Champs lus dans `/fixtures` : `fixture.id`, `fixture.date`, `league.round`, `teams.home/away.id/name`, `goals.home/away`.

`goals` contient le score final (prolongation comprise). Les buts `home` sont associés à `teams.home` de la même réponse.

## Erreurs

API-Football répond en HTTP 200 même en cas d'erreur. Le champ `errors` vaut `[]` si tout va bien, sinon un objet :

| Clé | Signification | Statut renvoyé par Betidea |
| --- | --- | --- |
| `token` | Clé absente ou invalide | 502 |
| `requests` | Quota journalier atteint | 429 |
| `rateLimit` | Trop de requêtes par minute | 429 |
| `plan` | Saison non incluse dans l'offre (le message indique les saisons autorisées) | 403 |
| `access` | Compte suspendu | 502 |
| autre | Paramètre refusé | 502 |

Traduction dans `lireErreurApi` (`src/lib/football/normalisation.ts`), testée dans `tests/football.test.mjs`.

## Coût en requêtes

- Ouverture de l'application : 1 requête `/leagues` (puis cache).
- Choix d'une saison : 1 requête `/fixtures` (puis cache).
- Clic sur un match jamais analysé : 1 requête `/fixtures/statistics`. Un match déjà analysé est relu dans Supabase (0 requête, 0 appel IA).

## Vérification manuelle (avec la clé)

```bash
curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" https://v3.football.api-sports.io/status
curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" "https://v3.football.api-sports.io/leagues?id=61"
curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" "https://v3.football.api-sports.io/fixtures?league=61&season=2023&status=FT-AET-PEN" | head -c 600
```

`/status` (non décompté du quota) indique l'offre et les requêtes restantes du jour. Si `/fixtures` renvoie une erreur `plan`, son message liste les saisons accessibles avec l'offre.
