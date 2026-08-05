// Vérification navigateur du renommage CRUMBORA sur le build servi.
// Usage: node scripts/crumbora.mjs [url] — captures dans qa-artifacts/crumbora/.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://127.0.0.1:4173/";
const SHOTS = "/home/user/Cookies/qa-artifacts/crumbora";
import fs from "node:fs";
fs.mkdirSync(SHOTS, { recursive: true });

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const erreurs = [];
let echecs = 0;
const verdict = (nom, ok, detail = "") => {
  if (!ok) echecs++;
  console.log(`${ok ? "OK " : "ÉCHEC"} ${nom}${detail ? ` — ${detail}` : ""}`);
};

// --- 1. Partie neuve sur mobile: intro CRUMBORA, titre, manifeste ----------
{
  const page = await navigateur.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  verdict("titre d'onglet = Crumbora", (await page.title()) === "Crumbora", await page.title());
  const manifeste = await page.evaluate(async () => (await (await fetch("/manifest.webmanifest")).json()));
  verdict("manifeste PWA = Crumbora", manifeste.name === "Crumbora" && manifeste.short_name === "Crumbora");
  const intro = await page.locator("h1").first().innerText();
  verdict("grand titre d'intro = CRUMBORA", intro.trim() === "CRUMBORA", intro.trim());
  const corps = await page.evaluate(() => document.body.innerText);
  verdict("ancien nom absent de l'intro", !/cookie[ \-_]?craze/i.test(corps));
  const boite = await page.locator("h1").first().boundingBox();
  verdict("logo entier à 320 px (pas de coupure)", boite && boite.width <= 320 && boite.width > 150, `${Math.round(boite?.width)} px`);
  await page.screenshot({ path: `${SHOTS}/intro-320.png` });
  await page.close();
}

// --- 2. Une partie Cookie Craze s'ouvre telle quelle -----------------------
{
  // 320 px, chips ET CRMB affichés: le pire cas connu pour l'en-tête.
  const page = await navigateur.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  const partie = {
    version: 6,
    cookies: 987654,
    lifetime: 4.2e6,
    items: { oven: 30, cursor: 25, bakery: 12, grandma: 8 },
    upgrades: { "global:0": true },
    crypto: { balance: 33.75, miners: { cpu: 2 }, ledger: 2, totalEarned: 40, price: 21_000, priceHistory: [21_000] },
    prestige: { chips: 7, spent: 0, upgrades: {} },
    stats: { clicks: 12_000, bestCombo: 1.75, prestigeCount: 1 },
    ui: { introSeen: true, sounds: false },
  };
  await page.addInitScript((s) => {
    // L'horloge de la partie est posée à « maintenant »: sans ça, le retour
    // hors-ligne créditerait deux heures de minage et le solde vérifié
    // bougerait — comportement correct du jeu, mais pas l'objet du test.
    const partie = JSON.parse(s);
    partie.lastTs = Date.now();
    partie.createdAt = Date.now() - 86_400_000;
    localStorage.setItem("cookieCrazeSaveV6", JSON.stringify(partie));
  }, JSON.stringify(partie));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const entete = await page.locator("header h1").innerText();
  verdict("logo d'en-tête = CRUMBORA", entete.trim() === "CRUMBORA", entete.trim());
  // `innerText` rend le texte ENTIER même quand le CSS le coupe en
  // « CRUMBO… »: seule la géométrie dit la vérité sur l'ellipse.
  const coupe = await page.evaluate(() => {
    const el = document.querySelector("header h1");
    return { deborde: el.scrollWidth > el.clientWidth + 1, largeur: el.clientWidth };
  });
  verdict("logo d'en-tête entier (pas d'ellipse)", !coupe.deborde, `${coupe.largeur} px utiles`);
  const corps = await page.evaluate(() => document.body.innerText);
  verdict("ancien nom absent du jeu", !/cookie[ \-_]?craze/i.test(corps));
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("cookieCrazeSaveV6")));
  verdict("cookies conservés", s.cookies >= 987654, String(s.cookies));
  verdict("CRMB conservé (33,75)", Math.abs(s.crypto.balance - 33.75) < 0.005, String(s.crypto.balance));
  verdict("Registre conservé (2)", s.crypto.ledger === 2);
  verdict("chips conservées (7)", s.prestige.chips === 7);
  // « Rien de perdu », pas « rien de gagné »: les succès rétro-crédités au
  // chargement peuvent légitimement AJOUTER au solde d'une partie migrée.
  const solde = await page.locator("[data-testid='solde']").innerText();
  const compact = solde.replace(/[\s\u202F\u00A0]/g, "");
  const m = compact.match(/([\d,.]+)(K|M|Md|B)?/);
  const mult = { K: 1e3, M: 1e6, Md: 1e9, B: 1e9 }[m?.[2]] || 1;
  const affiche = parseFloat((m?.[1] || "0").replace(",", ".")) * mult;
  verdict("solde affiché ≥ solde importé (rien de perdu)", affiche >= 987_654, solde.trim());
  await page.screenshot({ path: `${SHOTS}/jeu-320.png` });

  // La sauvegarde vit toujours sous sa clé historique.
  const brut = await page.evaluate(() => localStorage.getItem("cookieCrazeSaveV6"));
  verdict("sauvegarde toujours sous la clé historique", Boolean(brut));
  await page.close();
}

// --- 3. Bureau: en-tête complet -------------------------------------------
{
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => erreurs.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem(
      "cookieCrazeSaveV6",
      JSON.stringify({ version: 6, cookies: 5000, items: { oven: 4 }, stats: { clicks: 50 }, ui: { introSeen: true, sounds: false } })
    );
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/jeu-1440.png` });
  await page.close();
}

verdict("zéro erreur console/page sur les trois sessions", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));
await navigateur.close();
console.log(echecs === 0 ? "\nRenommage vérifié: tout passe." : `\n${echecs} vérification(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
