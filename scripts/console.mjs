// Vérifie qu'une session de jeu ne produit AUCUNE erreur console, et mesure la
// mémoire après un long moment de jeu.
// Usage: npx vite-node scripts/console.mjs [url]
//
// Playwright n'est pas une dépendance du projet — c'est un outil de mesure
// lancé à la main. `npm i playwright && npx playwright install chromium`.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:4173/";
const SAUVEGARDE = {
  version: 6,
  cookies: 5e9,
  lifetime: 8e10,
  cpcBase: 1,
  items: { oven: 180, bakery: 120, farm_cps: 90, factory_cps: 60, cursor: 200, grandma: 150, farm: 100, portal: 6 },
  upgrades: { "tier:oven:0": true, "tier:cursor:0": true, "global:0": true },
  prestige: { chips: 800, spent: 60, upgrades: { celestial_dough: 10, golden_fingers: 8 } },
  crypto: { balance: 120, ledger: 3, miners: { cpu: 5, gpu: 2 }, positions: [{ id: "p", amount: 20, tierId: "long", startedAt: 0, unlockAt: 0 }] },
  ascension: { stars: 9, spent: 4, tracks: { horizon: 2, eclat: 1 }, count: 2 },
  ui: { introSeen: true, sounds: false, reducedMotion: false, highContrast: false, volume: 0.6 },
  stats: { clicks: 500_000, bestCombo: 1.75, prestigeCount: 14 },
};

// `--expose-gc` est indispensable: sans forcer le ramasse-miettes, le tas
// mesuré contient les déchets pas encore collectés, et toute session paraît
// fuir. Mesuré ainsi, 1 600 clics faisaient passer le tas de 5 à 22 Mo — un
// chiffre qui ne dit rien tant qu'on n'a pas nettoyé.
// Le chemin du navigateur est facultatif: Playwright trouve le sien tout seul.
// Il n'est forcé que si l'environnement en désigne un (image CI, conteneur).
const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--js-flags=--expose-gc"],
});
const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } });

const erreurs = [];
const avertissements = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
  if (m.type() === "warning") avertissements.push(m.text());
});
page.on("pageerror", (e) => erreurs.push(`pageerror: ${e.message}`));

await page.addInitScript((s) => localStorage.setItem("cookieCrazeSaveV6", s), JSON.stringify(SAUVEGARDE));
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const memoire = async () => {
  await page.evaluate(() => globalThis.gc?.());
  await page.waitForTimeout(300);
  return page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
};
const debut = await memoire();

// Une session: on clique, on achète, on change d'onglet, longuement.
const cookie = page.locator("[aria-label*='Cliquer le cookie']");
for (let tour = 0; tour < 40; tour++) {
  for (let i = 0; i < 40; i++) {
    await cookie.click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(20);
  }
  const acheter = page.locator("button", { hasText: /^Acheter/ }).first();
  if (await acheter.count()) await acheter.click({ timeout: 3000 }).catch(() => {});
  const onglets = ["Améliorations", "Quêtes", "CRMB", "Prestige", "Profil", "Boutique"];
  const cible = onglets[tour % onglets.length];
  await page.getByRole("tab", { name: new RegExp(cible, "i") }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2000);

const fin = await memoire();
const noeuds = await page.evaluate(() => document.querySelectorAll("*").length);

console.log(`clics simulés          : 1600`);
console.log(`nœuds du document      : ${noeuds}`);
if (debut > 0) {
  console.log(`mémoire avant / après  : ${(debut / 1e6).toFixed(1)} Mo → ${(fin / 1e6).toFixed(1)} Mo`);
  console.log(`croissance             : ${(((fin - debut) / debut) * 100).toFixed(1)} %`);
} else {
  console.log("mémoire                : non mesurable dans ce navigateur");
}
console.log(`erreurs console        : ${erreurs.length}`);
for (const e of erreurs.slice(0, 10)) console.log(`   ${e}`);
console.log(`avertissements console : ${avertissements.length}`);
for (const a of avertissements.slice(0, 10)) console.log(`   ${a}`);

await navigateur.close();
process.exit(erreurs.length ? 1 : 0);
