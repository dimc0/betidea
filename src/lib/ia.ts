import "server-only";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type SchemaJSON = {
  nom: string;
  schema: Record<string, unknown>;
};

export class ErreurIA extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ErreurIA";
    this.status = status;
  }
}

export async function appelerModele(
  messages: Message[],
  options: {
    schema?: SchemaJSON;
    rechercheWeb?: boolean;
    maxCompletionTokens?: number;
  } = {}
): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "openai/gpt-oss-20b";
  const baseUrl = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");

  if (!apiKey) {
    throw new ErreurIA("La clé Groq AI_API_KEY n'est pas configurée.", 500);
  }

  const rechercheWeb = options.rechercheWeb === true;
  const consignesRecherche = rechercheWeb
    ? "\n\nRecherche sur Internet les informations récentes nécessaires. Privilégie les sources fiables. N'invente aucune statistique, blessure, composition ou source. Si une information n'est pas vérifiable, indique-le."
    : "";
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n") + consignesRecherche;
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));
  const corps: Record<string, unknown> = {
    model,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...conversation,
    ],
    max_completion_tokens: options.maxCompletionTokens ?? 4096,
  };

  if (rechercheWeb) {
    corps.tools = [{ type: "browser_search" }];
  } else if (options.schema) {
    corps.response_format = {
      type: "json_schema",
      json_schema: {
        name: options.schema.nom,
        strict: false,
        schema: options.schema.schema,
      },
    };
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(60000),
    });
  } catch (erreur) {
    if (erreur instanceof Error && erreur.name === "TimeoutError") {
      throw new ErreurIA("La requête Groq a dépassé le délai autorisé.", 504);
    }
    throw erreur;
  }

  if (!reponse.ok) {
    const detail = await reponse.text();
    console.error(`Erreur Groq (${reponse.status}) : ${detail}`);
    throw new ErreurIA(
      reponse.status === 429
        ? "Le quota Groq est atteint. Réessaie plus tard."
        : "Le modèle Groq a renvoyé une erreur.",
      reponse.status
    );
  }

  const donnees = (await reponse.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const contenu = donnees.choices?.[0]?.message?.content;
  if (!contenu) {
    throw new ErreurIA("Groq n'a renvoyé aucun texte exploitable.", 502);
  }
  return contenu;
}

export function messageErreurIA(erreur: unknown): string {
  if (erreur instanceof ErreurIA && erreur.status === 429) {
    return "Le service d'IA est momentanément saturé.";
  }

  if (erreur instanceof ErreurIA && erreur.status === 413) {
    return "Les données du match sont trop volumineuses pour le service d'IA.";
  }

  // appelerModele transforme un délai dépassé en ErreurIA 504
  if (erreur instanceof ErreurIA && erreur.status === 504) {
    return "Le service d'IA a mis trop de temps à répondre.";
  }

  return "La génération de l'analyse a échoué.";
}
