# Betidea

Application Next.js serverless qui récupère les matchs et cotes Betclic, puis génère ou modifie un combiné avec Groq.

## Lancer le projet

```bash
npm install
npm run dev
```

Configurer les variables dans `.env.local` :

```env
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=clé_groq
AI_MODEL=openai/gpt-oss-20b
```

La clé Groq reste côté serveur. `GET /api/combine` récupère les matchs Betclic et génère le combiné. `POST /api/combine` le modifie selon le message saisi.

## Déploiement

Déployer le projet Next.js sur Vercel et ajouter les variables Groq dans les paramètres d'environnement du projet.
