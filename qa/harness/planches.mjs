// === Planches de captures systématiques ===
//
// Des scènes DÉTERMINISTES — sauvegardes injectées, pas de hasard — pour
// comparer avant/après correction pixel pour pixel:
//   · les six gabarits d'écran, boutique ouverte;
//   · chaque onglet;
//   · chaque dialogue (confirmation, vérification humaine, retour hors-ligne);
//   · les cinq statistiques au repos, en clic lent, en clic rapide, au combo plein;
//   · les systèmes CRMB, le prestige, l'Ascension;
//   · les nombres limites: 99,75 puis 100, grands milliers, millions.
//
// Usage: node qa/harness/planches.mjs [url] [dossier]

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { attendre } from "./lib.mjs";
import { SAVE_CRMB, SAVE_PRESTIGE, SAVE_ASCENSION } from "./fixtures.mjs";

const URL = process.argv[2] || "http://127.0.0.1:4173/";
const OUT = process.argv[3] || path.join(process.cwd(), "qa-artifacts", "planches");
fs.mkdirSync(OUT, { recursive: true });

const GABARITS = [
  ["iphone-se-320x568", { width: 320, height: 568 }],
  ["iphone-8-375x667", { width: 375, height: 667 }],
  ["iphone-14-390x844", { width: 390, height: 844 }],
  ["iphone-14promax-430x932", { width: 430, height: 932 }],
  ["tablette-768x1024", { width: 768, height: 1024 }],
  ["ordinateur-1440x980", { width: 1440, height: 980 }],
];

// La partie témoin: un parc qui montre des nombres à tous les ordres de
// grandeur (par clic au-delà de cent, minage en milliers, banque en millions).
const SAVE_TEMOIN = {
  version: 6,
  cookies: 1_912_384,
  lifetime: 20_141_337,
  items: { cursor: 1610, grandma: 40, farm: 8, oven: 120, bakery: 45, farm_cps: 12, factory_cps: 3 },
  upgrades: { "tier:cursor:0": true, "tier:oven:0": true, "tier:oven:1": true },
  crypto: { balance: 12.5 },
  prestige: { chips: 30, spent: 5, upgrades: { celestial_dough: 2 } },
  stats: { clicks: 42_000, bestCombo: 1.75 },
  ui: { introSeen: true },
};

// La frontière de la règle: par clic à 99,75 — un Curseur de plus et la barre
// passe en entiers.
const SAVE_9975 = {
  version: 6,
  cookies: 2_412,
  lifetime: 60_000,
  items: { cursor: 395 },
  stats: { clicks: 9_000, bestCombo: 1.75 },
  ui: { introSeen: true },
};

const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function scene(nom, vue, save, action, decalageMs = 5_000) {
  const contexte = await navigateur.newContext({ viewport: vue, deviceScaleFactor: 1 });
  const page = await contexte.newPage();
  if (save) {
    await page.addInitScript(
      ({ s, decalage }) => {
        const copie = { ...s };
        copie.createdAt = Date.now() - 3 * 86_400_000;
        copie.lastTs = Date.now() - decalage;
        localStorage.setItem("cookieCrazeSaveV6", JSON.stringify(copie));
      },
      { s: save, decalage: decalageMs }
    );
  }
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });
  await attendre(1200);
  try {
    await action(page, async (etiquette) => {
      await page.screenshot({ path: path.join(OUT, `${nom}--${etiquette}.png`), timeout: 8000 });
      console.log(`  ${nom}--${etiquette}`);
    });
  } catch (e) {
    console.log(`  !! ${nom}: ${String(e).slice(0, 120)}`);
  }
  await contexte.close();
}

const clicRegulier = async (page, cps, secondes) => {
  const boite = await page.locator("[aria-label^='Cliquer le cookie']").boundingBox();
  if (!boite) return;
  const fin = Date.now() + secondes * 1000;
  while (Date.now() < fin) {
    await page.mouse.click(boite.x + boite.width / 2, boite.y + boite.height / 2).catch(() => {});
    await attendre(1000 / cps);
  }
};

console.log("— six gabarits, boutique ouverte —");
for (const [nom, vue] of GABARITS) {
  await scene(`gabarit-${nom}`, vue, SAVE_TEMOIN, async (page, shot) => {
    await shot("boutique");
  });
}

console.log("— chaque onglet (ordinateur + mobile) —");
for (const [taille, vue] of [["ordinateur", { width: 1440, height: 980 }], ["mobile", { width: 390, height: 844 }]]) {
  await scene(`onglets-${taille}`, vue, SAVE_TEMOIN, async (page, shot) => {
    for (const onglet of ["Boutique", "Améliorations", "Quêtes", "CRMB", "Prestige", "Profil"]) {
      const t = page.locator(`[role='tab'][aria-label='${onglet}']`).first();
      if (await t.isVisible().catch(() => false)) {
        await t.click();
        await attendre(900);
        await shot(onglet.toLowerCase().normalize("NFD").replace(/[^a-z]/g, ""));
      }
    }
  });
}

console.log("— les cinq statistiques: repos, clic lent, clic rapide, combo plein —");
await scene("statistiques", { width: 1440, height: 980 }, SAVE_TEMOIN, async (page, shot) => {
  await attendre(1500);
  await shot("repos");
  await clicRegulier(page, 2, 3.5);
  await shot("clic-lent-2cps");
  await attendre(2500);
  await clicRegulier(page, 9, 4);
  await shot("clic-rapide-9cps");
  await attendre(2500);
  await clicRegulier(page, 10, 4.5); // 36 clics: combo plein
  await shot("combo-plein");
});

console.log("— dialogues —");
await scene("dialogue-confirmation", { width: 1440, height: 980 }, SAVE_PRESTIGE, async (page, shot) => {
  await page.locator("[role='tab'][aria-label='Prestige']").click();
  await attendre(900);
  await shot("prestige-panneau");
  const renaitre = page.locator("button", { hasText: /^Renaître/ }).first();
  if (await renaitre.isEnabled().catch(() => false)) {
    await renaitre.click();
    await attendre(700);
    await shot("confirmation-renaissance");
  }
});
await scene("dialogue-verification", { width: 1440, height: 980 }, SAVE_TEMOIN, async (page, shot) => {
  // Un autoclicker synthétique force la vérification humaine, pour la capture.
  await page.evaluate(() => {
    const b = document.querySelector("[aria-label^='Cliquer le cookie']");
    window.__auto = setInterval(() => b && b.click(), 18);
  });
  await page.waitForSelector("[data-testid='verification']", { timeout: 150_000 });
  await page.evaluate(() => clearInterval(window.__auto));
  await shot("verification-humaine");
});
await scene(
  "dialogue-hors-ligne",
  { width: 1440, height: 980 },
  SAVE_TEMOIN,
  async (page, shot) => {
    await shot("retour-hors-ligne");
  },
  2 * 3600 * 1000
);
await scene("dialogue-reglages", { width: 390, height: 844 }, SAVE_TEMOIN, async (page, shot) => {
  await page.locator("[aria-label='Réglages']").click();
  await attendre(600);
  await shot("menu-reglages");
});

console.log("— systèmes CRMB —");
await scene("crmb", { width: 1440, height: 980 }, SAVE_CRMB, async (page, shot) => {
  await page.locator("[role='tab'][aria-label='CRMB']").click();
  await attendre(1200);
  await shot("marche-et-portefeuille");
  const montant = page.locator("[aria-label='Montant à bloquer']");
  if (await montant.isVisible().catch(() => false)) {
    await montant.fill("7,5").catch(async () => montant.fill("7.5"));
    await page.locator("button", { hasText: /^Bloquer$/ }).first().click().catch(() => {});
    await attendre(600);
  }
  await shot("staking-position");
  const signer = page.locator("button", { hasText: /^Signer un contrat/ }).first();
  if (await signer.isEnabled().catch(() => false)) {
    await signer.click();
    await attendre(600);
  }
  await shot("registre-apres-contrat");
});

console.log("— prestige et Ascension —");
await scene("ascension", { width: 1440, height: 980 }, SAVE_ASCENSION, async (page, shot) => {
  await page.locator("[role='tab'][aria-label='Prestige']").click();
  await attendre(1000);
  await shot("voute-et-voies");
  await page.locator("[role='tab'][aria-label='Boutique']").click();
  await attendre(800);
  await shot("batiments-tardifs-boutique");
});

console.log("— nombres limites —");
await scene("limite-9975", { width: 1440, height: 980 }, SAVE_9975, async (page, shot) => {
  await attendre(800);
  await shot("par-clic-99-75");
  // Un Curseur de plus: le par-clic franchit cent.
  const acheter = page.locator("[data-shop] button[aria-label^='Acheter Curseur']:enabled").first();
  if (await acheter.isVisible().catch(() => false)) {
    await acheter.click();
    await attendre(600);
    await shot("par-clic-passe-100");
  }
});
await scene(
  "limite-grands-nombres",
  { width: 1440, height: 980 },
  { ...SAVE_TEMOIN, cookies: 20_141_337_000, lifetime: 1.2e13 },
  async (page, shot) => {
    await attendre(800);
    await shot("milliards");
  }
);

await navigateur.close();
console.log(`Planches écrites dans ${OUT}`);
