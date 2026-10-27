import "server-only";
import { redis } from "@/lib/limitation";
import { qstash } from "@/lib/qstash";
import type { Controle } from "@/lib/statut";
import { creerClientAdmin } from "@/lib/supabase/admin";

const controleVercel: Controle = {
  service: "Vercel",
  description: "Hébergement et fonctions serverless",
  verifier: async () => {
    const environnement = process.env.VERCEL_ENV ?? "local";
    const region = process.env.VERCEL_REGION ?? "poste du développeur";
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "aucun";
    return `Environnement : ${environnement} · Région : ${region} · Commit : ${commit}`;
  },
};

const controleIA: Controle = {
  service: "Modèle d'IA",
  description: "Analyse des matchs (API compatible OpenAI)",
  verifier: async () => {
    // Mêmes valeurs par défaut que src/lib/ia.ts, pour contrôler ce que l'application utilise vraiment.
    const baseUrl = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
    const apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY;
    const model = process.env.AI_MODEL || "openai/gpt-oss-20b";

    if (!apiKey) {
      throw new Error("Variable AI_API_KEY manquante");
    }

    // GET /models : vérifie la clé et le modèle sans générer de texte (aucun token consommé).
    const reponse = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!reponse.ok) {
      throw new Error(`L'API a répondu avec le statut ${reponse.status}`);
    }

    const donnees = await reponse.json();
    const modeleDisponible = donnees.data?.some((m: { id: string }) => m.id === model);

    if (!modeleDisponible) {
      throw new Error(`Le modèle ${model} n'est pas disponible chez ce fournisseur`);
    }

    return `Modèle ${model} disponible sur ${new URL(baseUrl).host}`;
  },
};

const controleApiFootball: Controle = {
  service: "API-Football",
  description: "Saisons, matchs et statistiques",
  verifier: async () => {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      throw new Error("Variable API_FOOTBALL_KEY manquante");
    }

    // GET /status : informations du compte, sans consommer le quota de requêtes.
    const reponse = await fetch("https://v3.football.api-sports.io/status", {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    });

    if (!reponse.ok) {
      throw new Error(`L'API a répondu avec le statut ${reponse.status}`);
    }

    // API-Football répond en HTTP 200 même en cas d'erreur : il faut lire « errors ».
    const donnees = await reponse.json();
    const erreurs = donnees.errors && !Array.isArray(donnees.errors) ? Object.values(donnees.errors) : [];
    if (erreurs.length > 0) {
      throw new Error(String(erreurs[0]));
    }

    const offre = donnees.response?.subscription?.plan ?? "inconnue";
    const utilisees = donnees.response?.requests?.current;
    const limite = donnees.response?.requests?.limit_day;

    return utilisees !== undefined && limite !== undefined
      ? `Offre ${offre} · ${utilisees} / ${limite} requêtes utilisées aujourd'hui`
      : `Offre ${offre}`;
  },
};

const controleBase: Controle = {
  service: "Supabase Database",
  description: "Base de données des analyses",
  verifier: async () => {
    const supabase = creerClientAdmin();
    const { count, error } = await supabase
      .from("analyses")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw new Error(error.message);
    }

    return `${count ?? 0} analyse(s) enregistrée(s)`;
  },
};

const controleAuth: Controle = {
  service: "Supabase Auth",
  description: "Connexion des utilisateurs",
  verifier: async () => {
    const supabase = creerClientAdmin();
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      throw new Error(error.message);
    }

    return "Service d'authentification joignable";
  },
};

const controleRedis: Controle = {
  service: "Upstash Redis",
  description: "Limitation du nombre d'analyses",
  verifier: async () => {
    const reponse = await redis.ping();

    if (reponse !== "PONG") {
      throw new Error(`Réponse inattendue : ${reponse}`);
    }

    const nombreCles = await redis.dbsize();
    return `Base joignable · ${nombreCles} clé(s) en mémoire`;
  },
};

const controleQStash: Controle = {
  service: "Upstash QStash",
  description: "File de messages des analyses",
  verifier: async () => {
    if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
      throw new Error("Variables QSTASH_URL ou QSTASH_TOKEN manquantes");
    }

    if (!process.env.APP_URL) {
      throw new Error("Variable APP_URL manquante : QStash ne saurait pas où livrer les messages");
    }

    if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
      throw new Error("Clés de signature manquantes : le worker refuserait tous les messages");
    }

    await qstash.schedules.list();

    return `Service joignable · Destination : ${process.env.APP_URL}`;
  },
};

export const CONTROLES: Controle[] = [
  controleVercel,
  controleIA,
  controleApiFootball,
  controleBase,
  controleAuth,
  controleRedis,
  controleQStash,
];
