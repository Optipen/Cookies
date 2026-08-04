// Inspection des gabarits: ce qui tient au-dessus de la ligne de flottaison,
// les cibles trop petites, les textes trop petits, les débordements.
// Usage: npx vite-node scripts/mobile.mjs [url]
// Playwright n'est pas une dépendance du projet — c'est un outil de mesure
// lancé à la main. `npm i playwright && npx playwright install chromium`.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:4173/";
const GABARITS = [
  ["iPhone SE", 320, 568],
  ["iPhone 8", 375, 667],
  ["iPhone 14", 390, 844],
  ["iPhone 14 Pro Max", 430, 932],
  ["Tablette", 768, 1024],
  ["Ordinateur", 1440, 980],
];

const SAUVEGARDE = {
  version: 5,
  cookies: 24500,
  lifetime: 180000,
  cpcBase: 1,
  items: { oven: 14, bakery: 6, cursor: 16, grandma: 9 },
  upgrades: {},
  ui: { introSeen: true, sounds: false, reducedMotion: false, highContrast: false, volume: 0.6 },
  createdAt: 0,
  lastTs: 0,
  stats: { clicks: 400, bestCombo: 1.5 },
};

const audit = async (page, largeur, hauteur) =>
  page.evaluate(
    ({ largeur, hauteur }) => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && el.offsetParent !== null;
      };
      const petitesCibles = [];
      for (const el of document.querySelectorAll("button, a, [role='tab'], input, select")) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) {
          petitesCibles.push({
            t: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 34),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }
      const petitsTextes = [];
      for (const el of document.querySelectorAll("*")) {
        if (!el.children.length && el.textContent.trim() && visible(el)) {
          const px = parseFloat(getComputedStyle(el).fontSize);
          if (px < 11) petitsTextes.push({ t: el.textContent.trim().slice(0, 28), px });
        }
      }
      // Ce qu'on voit sans faire défiler.
      const dansLaVue = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.top < hauteur && r.bottom > 0;
      };
      const boutique = document.querySelector("[data-shop]");
      return {
        debordement: document.documentElement.scrollWidth > largeur + 1,
        largeurDoc: document.documentElement.scrollWidth,
        petitesCibles,
        petitsTextes,
        vue: {
          solde: dansLaVue("[data-testid='solde']"),
          parClic: dansLaVue("[data-testid='stat-par-clic']"),
          cadence: dansLaVue("[data-testid='stat-cadence']"),
          clics: dansLaVue("[data-testid='stat-clics']"),
          minage: dansLaVue("[data-testid='stat-minage']"),
          total: dansLaVue("[data-testid='stat-total']"),
          cookie: dansLaVue("[aria-label*='Cliquer le cookie']"),
          objectif: dansLaVue("[data-testid='objectif']"),
          boutique: boutique ? boutique.getBoundingClientRect().top < hauteur : null,
        },
        hautBoutique: boutique ? Math.round(boutique.getBoundingClientRect().top) : null,
      };
    },
    { largeur, hauteur }
  );

// Le chemin du navigateur est facultatif: Playwright trouve le sien tout seul.
// Il n'est forcé que si l'environnement en désigne un (image CI, conteneur).
const NAVIGATEUR = process.env.CHROMIUM_PATH || undefined;
const navigateur = await chromium.launch({ executablePath: NAVIGATEUR });
let echecs = 0;

for (const [nom, w, h] of GABARITS) {
  const page = await navigateur.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.addInitScript((s) => {
    localStorage.setItem("cookieCrazeSaveV5", s);
  }, JSON.stringify(SAUVEGARDE));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const r = await audit(page, w, h);
  const manquants = Object.entries(r.vue).filter(([, v]) => v === false).map(([k]) => k);
  const ok = !r.debordement && !r.petitesCibles.length && !r.petitsTextes.length && !manquants.length;
  if (!ok) echecs++;

  console.log(`\n=== ${nom} · ${w}×${h} === ${ok ? "OK" : "À CORRIGER"}`);
  console.log(`  débordement horizontal : ${r.debordement ? `OUI (${r.largeurDoc} px)` : "non"}`);
  console.log(`  haut de la boutique    : ${r.hautBoutique} px (écran ${h} px)`);
  if (manquants.length) console.log(`  hors de la vue         : ${manquants.join(", ")}`);
  if (r.petitesCibles.length) {
    console.log(`  cibles < 44 px         : ${r.petitesCibles.length}`);
    for (const c of r.petitesCibles.slice(0, 8)) console.log(`     ${c.w}×${c.h}  « ${c.t} »`);
  }
  if (r.petitsTextes.length) {
    console.log(`  textes < 11 px         : ${r.petitsTextes.length}`);
    for (const t of r.petitsTextes.slice(0, 8)) console.log(`     ${t.px}px  « ${t.t} »`);
  }

  await page.screenshot({ path: `/tmp/shot-${w}x${h}.png`, fullPage: false });
  await page.close();
}

await navigateur.close();
console.log(`\n${echecs === 0 ? "Tous les gabarits passent." : `${echecs} gabarit(s) à corriger.`}`);
