import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const EMAIL = process.env.ADMIN_EMAILS.split(",")[0].trim();
const MATCH = 442743, SAISON = 2023;
const t0 = Date.now(), t = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;

// 1. Lien de connexion généré par l'API d'administration (pas d'e-mail)
const admin = createClient(URL_SB, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: lien, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
if (e1) throw e1;

// 2. Session au format des cookies de @supabase/ssr (comme dans le navigateur)
const jar = new Map();
const client = createServerClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) },
});
const { error: e2 } = await client.auth.verifyOtp({ token_hash: lien.properties.hashed_token, type: "magiclink" });
if (e2) throw e2;
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
console.log(`[${t()}] connecté (${jar.size} cookie(s) de session)`);

// 3. Demande d'analyse
const r = await fetch("http://localhost:3001/api/analyses", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ saison: SAISON, match: MATCH }) });
const corps = await r.json();
console.log(`[${t()}] POST /api/analyses → ${r.status}`, JSON.stringify(corps).slice(0, 120), "restantes:", r.headers.get("X-RateLimit-Remaining"));
if (!corps.id) process.exit(0);
if (corps.statut === "prete") { console.log("déjà prête (match déjà analysé)"); process.exit(0); }

// 4. Abonnement temps réel, au nom de l'utilisateur (RLS), comme attendreAnalyse
await client.realtime.setAuth((await client.auth.getSession()).data.session.access_token);
const canal = client.channel(`analyse-${corps.id}`);
const resultat = await new Promise((ok) => {
  const minuteur = setTimeout(() => ok({ statut: "délai de 90 s dépassé" }), 90000);
  canal.on("postgres_changes", { event: "UPDATE", schema: "public", table: "analyses", filter: `id=eq.${corps.id}` }, (ev) => {
    console.log(`[${t()}] événement temps réel reçu : statut=${ev.new.statut}`);
    if (ev.new.statut !== "en_attente") { clearTimeout(minuteur); ok(ev.new); }
  }).subscribe(async (s) => {
    console.log(`[${t()}] canal : ${s}`);
    if (s === "SUBSCRIBED") {
      const v = await fetch(`http://localhost:3001/api/analyses/${corps.id}`, { headers: { Cookie: cookie } }).then((x) => x.json());
      console.log(`[${t()}] vérification initiale : statut=${v.statut}`);
      if (v.statut !== "en_attente") { clearTimeout(minuteur); ok(v); }
    }
  });
});
await client.removeChannel(canal);
console.log(`[${t()}] RÉSULTAT : statut=${resultat.statut}`, resultat.message_erreur ?? "", resultat.analyse ? `| titre IA : « ${resultat.analyse.titre} » | stats : ${JSON.stringify(resultat.statistiques)}` : "");
console.log("COOKIE_POUR_NAVIGATEUR=" + encodeURIComponent(JSON.stringify([...jar])));
process.exit(0);
