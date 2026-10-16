import type { Browser } from "puppeteer-core";

export type BetclicOdds = {
  selection: string;
  cote: number;
};

export type BetclicMatch = {
  id: string;
  match: string;
  equipe_domicile: string;
  equipe_exterieure: string;
  competition: string;
  heure: string;
  url: string;
  cotes: BetclicOdds[];
  recuperation: string;
};

export type BetclicSnapshot = {
  source: string;
  recupereLe: string;
  nombreMatchs: number;
  matchs: BetclicMatch[];
};

const URL_BETCLIC =
  "https://www.betclic.fr/football-sfootball/top-football-europeen-p0";
const ATTENTE_CHARGEMENT_MS = 20000;

let chromiumPathPromise: Promise<string> | undefined;

async function obtenirCheminChromium(): Promise<string> {
  const host = process.env.VERCEL_URL;

  if (!host) {
    throw new Error("VERCEL_URL est manquant pour charger Chromium.");
  }

  chromiumPathPromise ??= import("@sparticuz/chromium-min")
    .then(({ default: chromium }) =>
      chromium.executablePath(`https://${host}/chromium-pack.tar`)
    )
    .catch((erreur: unknown) => {
      chromiumPathPromise = undefined;
      throw erreur;
    });

  return chromiumPathPromise;
}

export async function recupererMatchsBetclic(): Promise<BetclicSnapshot> {
  let browser: Browser | undefined;

  try {
    if (process.env.VERCEL === "1") {
      const { default: puppeteer } = await import("puppeteer-core");
      const { default: chromium } = await import("@sparticuz/chromium-min");
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await obtenirCheminChromium(),
        headless: "shell",
      });
    } else {
      const { default: puppeteer } = await import("puppeteer");
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });
    await page.setUserAgent((await page.browser().userAgent()).replace("HeadlessChrome", "Chrome"));
    await page.setExtraHTTPHeaders({ "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8" });
    await page.goto(URL_BETCLIC, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const cartesChargees = await page.waitForFunction(
      () => document.querySelectorAll(".groupEvents_card").length > 0,
      { timeout: ATTENTE_CHARGEMENT_MS }
    ).then(() => true).catch(() => false);

    if (!cartesChargees) {
      const diagnostic = await page.evaluate(() => ({
        titre: document.title,
        url: window.location.href,
        extrait: document.body.innerText.slice(0, 300),
      }));
      console.error("Betclic n'a affiché aucune carte de match.", diagnostic);
      throw new Error(
        `Betclic n'a affiché aucun match après ${ATTENTE_CHARGEMENT_MS / 1000} secondes (${diagnostic.titre || diagnostic.url}).`
      );
    }

    await page.waitForFunction(
      () => document.querySelectorAll(".groupEvents_card .market_odds button").length > 0,
      { timeout: 10000 }
    ).catch(() => undefined);

    const recuperation = new Date().toISOString();
    const extraits = await page.evaluate((dateRecuperation) => {
      const txt = (valeur: string | null | undefined) =>
        (valeur ?? "").replace(/\s+/g, " ").trim();

      return Array.from(document.querySelectorAll<HTMLElement>(".groupEvents_card"))
        .map((carte) => {
          const lien = carte.querySelector<HTMLAnchorElement>("a.cardEvent");
          const domicile = txt(
            carte.querySelector<HTMLElement>('[data-qa="contestant-1-label"]')?.innerText
          );
          const exterieur = txt(
            carte.querySelector<HTMLElement>('[data-qa="contestant-2-label"]')?.innerText
          );
          const competition = txt(carte.querySelector<HTMLElement>(".breadcrumb")?.innerText);
          const heure = txt(carte.querySelector<HTMLElement>(".scoreboard_hour")?.innerText);
          const cotes = Array.from(carte.querySelectorAll<HTMLButtonElement>(".market_odds button"))
            .map((bouton) => {
              const morceaux = txt(bouton.innerText).split(" ");
              const coteParBouton = morceaux[morceaux.length - 1] ?? "";
              const selection = txt(
                bouton.querySelector<HTMLElement>(".btn_label.is-top")?.innerText
              ) || morceaux.slice(0, -1).join(" ");
              const coteTexte = txt(
                bouton.querySelector<HTMLElement>("bcdk-bet-button-odds-animated")?.innerText
              ) || coteParBouton;
              const cote = Number(coteTexte.replace(",", "."));
              if (!selection || !coteTexte || !Number.isFinite(cote) || cote <= 1) {
                return null;
              }
              return { selection, cote };
            })
            .filter((cote): cote is { selection: string; cote: number } => cote !== null);

          if (!lien?.href || !domicile || !exterieur || cotes.length === 0) {
            return null;
          }

          const url = lien.href;
          const label = txt(lien.getAttribute("aria-label"));
          return {
            id: url,
            match: label || `${domicile} - ${exterieur}`,
            equipe_domicile: domicile,
            equipe_exterieure: exterieur,
            competition,
            heure,
            url,
            cotes,
            recuperation: dateRecuperation,
          };
        })
        .filter((match): match is NonNullable<typeof match> => match !== null);
    }, recuperation) as BetclicMatch[];

    const uniques = Array.from(
      new Map(extraits.map((match) => [match.url, match])).values()
    );

    if (uniques.length === 0) {
      const diagnostic = await page.evaluate(() => ({
        titre: document.title,
        nombreCartes: document.querySelectorAll(".groupEvents_card").length,
        nombreBoutonsCotes: document.querySelectorAll(".groupEvents_card .market_odds button").length,
      }));
      console.error("Aucun match Betclic exploitable n'a été extrait.", diagnostic);
      throw new Error(
        `Aucun match exploitable trouvé (cartes : ${diagnostic.nombreCartes}, boutons de cotes : ${diagnostic.nombreBoutonsCotes}).`
      );
    }

    const snapshot: BetclicSnapshot = {
      source: URL_BETCLIC,
      recupereLe: recuperation,
      nombreMatchs: uniques.length,
      matchs: uniques,
    };

    return snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(`Impossible de récupérer les cotes Betclic : ${message}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
