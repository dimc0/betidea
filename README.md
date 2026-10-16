# Betidea

Application Next.js serverless d'analyse de football et de création d'un combiné du jour.

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
THE_ODDS_API_KEY=
```

Les clés sont utilisées côté serveur. Ne pas les préfixer par `NEXT_PUBLIC_`.
Sur Vercel, ajouter `THE_ODDS_API_KEY`, `AI_API_KEY`, `AI_BASE_URL` et `AI_MODEL` dans **Project Settings → Environment Variables**, sélectionner les environnements concernés, puis redéployer.

## Combiné et cotes

`GET /api/combine` récupère les matchs du jour (fuseau `Europe/Paris`) et les données de The Odds API, puis demande au modèle un combiné de 2 à 4 sélections. Trois sélections sont demandées par défaut. `POST /api/combine` prend une demande de 500 caractères maximum et les identifiants des sélections courantes ; le serveur recharge les cotes, valide chaque identifiant et recalcule la cote totale.

Le MVP interroge six compétitions de football : Ligue 1, Premier League, Bundesliga, Serie A, La Liga et Ligue des champions. Pour chaque événement, il conserve les bookmakers et marchés effectivement renvoyés pour la région Europe. Chaque sélection affiche son bookmaker, son marché et la date de mise à jour. Les cotes âgées de plus de 30 minutes sont écartées. L'IA ne reçoit que ces sélections réelles ; le serveur revérifie leurs identifiants et recalcule la cote totale.

Le cache Next.js est partagé entre les visiteurs et conserve chaque réponse de compétition jusqu'à 5 minutes avant revalidation. Le coût dépend des événements et marchés effectivement renvoyés par The Odds API ; surveille le quota dans le tableau de bord du fournisseur avant une utilisation fréquente.

Les modifications de combiné sont limitées à 5 requêtes par heure et par adresse réseau. Le dépôt n'a ni comptes utilisateurs ni stockage partagé (Redis/Upstash) : cette limite en mémoire est indicative sur Vercel et peut être réinitialisée lorsqu'une instance redémarre ou mise à l'échelle. Une limite stricte par utilisateur nécessiterait une authentification et un stockage partagé.

## Analyse de match

`POST /api/analyses` utilise le client Groq partagé dans `src/lib/ia.ts`. Ce flux est conservé indépendamment du combiné.

## Vérifications

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Le dépôt ne contient actuellement pas d'authentification ni de stockage utilisateur. Les sélections privées ne sont donc pas enregistrées côté serveur ; le serveur reconstruit chaque sélection à partir du catalogue actuel avant de la modifier.
