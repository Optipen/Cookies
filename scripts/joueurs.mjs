// Cinq joueurs simulés, cinq sessions réelles en parallèle.
//
// Chaque joueur est un contexte de navigateur séparé (sauvegarde, vidéo,
// captures indépendantes) et joue AU MOINS cinq minutes réelles: il clique,
// achète, explore les onglets, attrape les cookies dorés, répond à la
// vérification humaine. Pendant ce temps, un auditeur passe toutes les
// vingt secondes et relève:
//   - tout nombre décimal affiché hors de la grille des quarts (0,25),
//     avec sa zone d'origine — sauf le solde de cookies, seule exception;
//   - tout NaN / undefined / Infinity / [object dans le texte;
//   - tout nombre écrit avec un point au lieu d'une virgule;
//   - les débordements horizontaux et le nombre de bandeaux visibles.
//
// Usage: node scripts/joueurs.mjs [url] [dossier-de-sortie]
// Playwright n'est pas une dépendance du projet — outil lancé à la main.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const URL = process.argv[2] || "http://127.0.0.1:4173/";
const OUT = process.argv[3] || "/tmp/joueurs";
fs.mkdirSync(OUT, { recursive: true });

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const alea = (min, max) => min + Math.random() * (max - min);

// ---------------------------------------------------------------------------
// L'auditeur: exécuté DANS la page, sans dépendance au reste du script.
// ---------------------------------------------------------------------------
function auditerLaPage() {
  const zoneDe = (el) => {
    let n = el;
    while (n && n !== document.body) {
      if (n.dataset && n.dataset.testid) return n.dataset.testid;
      const al = n.getAttribute && n.getAttribute("aria-label");
      if (al) return al.slice(0, 40);
      if (n.tagName === "SECTION") {
        const h = n.querySelector("h3, h2");
        if (h) return h.textContent.trim().slice(0, 40);
      }
      n = n.parentElement;
    }
    return "?";
  };
  const visible = (el) => {
    if (!el) return false;
    const r = el.getClientRects();
    return r.length > 0 && r[0].width > 0;
  };
  const grille = [];
  const points = [];
  const textes = [];
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let noeud;
  while ((noeud = marcheur.nextNode())) {
    const t = noeud.textContent;
    if (!t || !t.trim()) continue;
    const parent = noeud.parentElement;
    if (!parent || !visible(parent)) continue;
    if (/\bNaN\b|\bundefined\b|\bInfinity\b|\[object /.test(t)) {
      textes.push({ texte: t.trim().slice(0, 60), zone: zoneDe(parent) });
    }
    // Nombre à virgule française — la grille des quarts s'applique partout,
    // sauf au solde de cookies (la seule exception voulue).
    const solde = parent.closest("[data-testid='solde']") !== null;
    let m;
    const reVirgule = /(\d{1,3}(?:[\s  ]\d{3})+|\d+),(\d+)/g;
    while ((m = reVirgule.exec(t)) !== null) {
      const v = parseFloat(m[1].replace(/[\s  ]/g, "") + "." + m[2]);
      // multiple de 0,25 ? — ×10000 pour rester en entiers jusqu'à 4 décimales
      const hors = Math.round(v * 10000) % 2500 !== 0;
      if (hors && !solde) {
        grille.push({ texte: m[0], valeur: v, zone: zoneDe(parent), autour: t.trim().slice(0, 50) });
      }
    }
    // Un point décimal affiché est une faute de locale (le jeu est en français).
    const rePoint = /(?<![\d,.])(\d+)\.(\d+)(?![\d])/g;
    while ((m = rePoint.exec(t)) !== null) {
      points.push({ texte: m[0], zone: zoneDe(parent), autour: t.trim().slice(0, 50) });
    }
  }
  const ongletActif = document.querySelector("[role='tab'][aria-selected='true']");
  const soldeEl = document.querySelector("[data-testid='solde']");
  return {
    grille,
    points,
    textes,
    deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    bandeaux: document.querySelectorAll("[role='status']").length,
    onglet: ongletActif ? (ongletActif.getAttribute("aria-label") || ongletActif.textContent.trim()) : "?",
    solde: soldeEl ? soldeEl.textContent.trim().slice(0, 40) : "?",
  };
}

// ---------------------------------------------------------------------------
// La boîte à outils d'un joueur.
// ---------------------------------------------------------------------------
function outilsPour(nom, page, dossier) {
  const debut = Date.now();
  const evenements = [];
  const audits = [];
  const erreursConsole = [];
  let compteurShots = 0;

  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      erreursConsole.push({ t: Date.now() - debut, type, texte: msg.text().slice(0, 300) });
    }
  });
  page.on("pageerror", (err) => {
    erreursConsole.push({ t: Date.now() - debut, type: "pageerror", texte: String(err).slice(0, 300) });
  });
  page.on("requestfailed", (req) => {
    erreursConsole.push({ t: Date.now() - debut, type: "requestfailed", texte: req.url().slice(0, 200) });
  });

  const o = {
    evenements,
    audits,
    erreursConsole,
    debut,
    note(type, detail) {
      evenements.push({ t: Math.round((Date.now() - debut) / 1000), type, detail });
    },
    async shot(etiquette) {
      compteurShots += 1;
      const t = Math.round((Date.now() - debut) / 1000);
      const fichier = path.join(dossier, `${String(compteurShots).padStart(2, "0")}-t${String(t).padStart(3, "0")}s-${etiquette}.png`);
      try {
        await page.screenshot({ path: fichier, timeout: 8000 });
        o.note("capture", `${etiquette} (t=${t}s)`);
      } catch (e) {
        o.note("capture-ratee", `${etiquette}: ${String(e).slice(0, 80)}`);
      }
    },
    async audit() {
      try {
        const r = await page.evaluate(auditerLaPage);
        r.t = Math.round((Date.now() - debut) / 1000);
        audits.push(r);
        if (r.textes.length) o.note("TEXTE-CASSE", JSON.stringify(r.textes.slice(0, 3)));
        if (r.deborde) o.note("DEBORDEMENT", `onglet ${r.onglet}`);
      } catch {
        /* page en cours de navigation: on repassera */
      }
    },
    // Répond à la vérification humaine comme un humain: on lit le nombre
    // demandé dans la question et on appuie dessus.
    async verification() {
      const modal = page.locator("[data-testid='verification']");
      if (!(await modal.isVisible().catch(() => false))) return false;
      await o.shot("verification");
      const question = await modal.locator("p").first().textContent();
      const m = question && question.match(/nombre (\d+)/);
      if (m) {
        await modal.locator(`button:text-is("${m[1]}")`).first().click().catch(() => {});
        o.note("verification", `répondu « ${m[1]} » à: ${question.trim()}`);
      } else {
        o.note("VERIFICATION-ILLISIBLE", question || "(vide)");
      }
      return true;
    },
    async cookieDore() {
      const dore = page.locator("[aria-label^='Attraper']").first();
      if (await dore.isVisible().catch(() => false)) {
        const label = await dore.getAttribute("aria-label").catch(() => "?");
        await dore.click({ timeout: 1500 }).catch(() => {});
        o.note("bonus-attrape", label);
        return true;
      }
      return false;
    },
    async onglet(label) {
      const t = page.locator(`[role='tab'][aria-label='${label}']`).first();
      if (await t.isVisible().catch(() => false)) {
        await t.click().catch(() => {});
        await attendre(400);
        o.note("onglet", label);
        return true;
      }
      o.note("ONGLET-ABSENT", label);
      return false;
    },
    // Des clics humains: cadence bruitée, position légèrement variable.
    async clics(cps, secondes) {
      const biscuit = page.locator("[aria-label^='Cliquer le cookie']");
      const boite = await biscuit.boundingBox().catch(() => null);
      if (!boite) {
        o.note("COOKIE-INTROUVABLE", "pas de bouton principal");
        return 0;
      }
      const fin = Date.now() + secondes * 1000;
      let faits = 0;
      while (Date.now() < fin) {
        const x = boite.x + boite.width / 2 + alea(-boite.width / 5, boite.width / 5);
        const y = boite.y + boite.height / 2 + alea(-boite.height / 5, boite.height / 5);
        await page.mouse.click(x, y).catch(() => {});
        faits += 1;
        if (faits % 12 === 0) {
          if (await o.verification()) continue;
          await o.cookieDore();
        }
        await attendre(Math.max(20, (1000 / cps) * alea(0.65, 1.35)));
      }
      o.note("clics", `${faits} clics à ~${cps}/s`);
      return faits;
    },
    async acheterMoinsCher() {
      const bouton = page.locator("[data-shop] button[aria-label^='Acheter']:enabled").first();
      if (await bouton.isVisible().catch(() => false)) {
        const label = await bouton.getAttribute("aria-label").catch(() => "?");
        await bouton.click().catch(() => {});
        o.note("achat", label);
        return true;
      }
      return false;
    },
    resteMs(dureeS) {
      return debut + dureeS * 1000 - Date.now();
    },
  };
  return o;
}

// ---------------------------------------------------------------------------
// Les sauvegardes de départ.
// ---------------------------------------------------------------------------
const SAVE_MAX = { version: 6, ui: { introSeen: true } };
const SAVE_IRIS = {
  version: 6,
  cookies: 75_000,
  lifetime: 300_000,
  items: { cursor: 12, grandma: 8, oven: 10, bakery: 4 },
  crypto: { balance: 3 },
  stats: { clicks: 900, bestCombo: 1.5 },
  ui: { introSeen: true },
};
const SAVE_SAM = {
  version: 6,
  cookies: 20_000,
  lifetime: 400_000,
  items: { cursor: 10, grandma: 6, oven: 12, bakery: 6 },
  stats: { clicks: 1200, bestCombo: 1.75 },
  ui: { introSeen: true },
};
// Léa arrive d'une VIEILLE sauvegarde (V5): la migration fait partie du test.
const SAVE_LEA = {
  version: 5,
  cookies: 5e12,
  lifetime: 2e14,
  cpcBase: 1,
  items: { cursor: 60, grandma: 45, oven: 40, bakery: 30, temple: 3 },
  upgrades: {},
  crypto: { balance: 60, miners: { cpu: 3, gpu: 1 }, totalMined: 20, positions: [], ledger: 0 },
  stats: { clicks: 120_000, bestCombo: 1.75 },
  ui: { introSeen: true, sounds: false },
};

// ---------------------------------------------------------------------------
// Les cinq joueurs.
// ---------------------------------------------------------------------------

// Nora découvre le jeu: elle lit, clique doucement, achète ce qu'elle peut.
async function nora(page, o) {
  const DUREE = 300;
  await o.shot("arrivee-intro");
  const commencer = page.locator("button", { hasText: "Commencer" }).first();
  if (await commencer.isVisible().catch(() => false)) {
    await attendre(2500); // elle lit l'écran d'intro
    await commencer.click();
    o.note("intro", "a cliqué « Commencer à cuire »");
  } else {
    o.note("INTRO-ABSENTE", "aucun écran d'intro pour une nouvelle joueuse");
  }
  await attendre(1200);
  await o.shot("premier-ecran");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(1, 2), Math.min(15, o.resteMs(DUREE) / 1000));
    await attendre(alea(2000, 6000)); // elle regarde l'écran
    await o.acheterMoinsCher();
    if (Math.random() < 0.25) {
      await o.onglet("Améliorations");
      await attendre(2500);
      const up = page.locator("button[aria-label*='coût']:enabled").first();
      if (await up.isVisible().catch(() => false)) {
        await up.click().catch(() => {});
        o.note("achat", "une amélioration");
      }
      await o.onglet("Boutique");
    }
    if (Math.random() < 0.15) await o.shot("en-jeu");
  }
  await o.shot("fin-de-session");
}

// Max mitraille: rafales à 8-11 clics/s, il vise le combo et achète des cliqueurs.
async function max_(page, o) {
  const DUREE = 300;
  await attendre(1000);
  await o.shot("depart");
  let rafales = 0;
  while (o.resteMs(DUREE) > 0) {
    rafales += 1;
    await o.clics(alea(8, 11), Math.min(20, Math.max(1, o.resteMs(DUREE) / 1000)));
    if (rafales === 2) await o.shot("combo-en-rafale");
    await o.verification();
    await o.acheterMoinsCher();
    await attendre(alea(800, 2500));
    if (rafales % 5 === 0) await o.shot("rafale-" + rafales);
  }
  await o.shot("fin-de-session");
}

// Iris explore TOUT sur mobile: onglets, réglages, filtres, quantités, succès.
async function iris(page, o) {
  const DUREE = 330;
  await attendre(1200);
  await o.shot("accueil-mobile");
  // Le tour des onglets, une capture par écran.
  for (const t of ["Boutique", "Améliorations", "Quêtes", "CRMB", "Prestige", "Profil"]) {
    if (await o.onglet(t)) {
      await attendre(1500);
      await o.shot("onglet-" + t.toLowerCase().replace(/[^a-z]/gi, ""));
    }
  }
  // Les réglages: elle touche à tout, puis remet.
  const reglages = page.locator("[aria-label='Réglages']").first();
  if (await reglages.isVisible().catch(() => false)) {
    await reglages.click();
    await attendre(600);
    await o.shot("reglages-ouverts");
    for (const motif of [/Sons/i, /contraste/i, /animation/i]) {
      const b = page.locator("button", { hasText: motif }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {});
        o.note("reglage", String(motif));
        await attendre(400);
      }
    }
    await o.shot("reglages-modifies");
    await page.keyboard.press("Escape").catch(() => {});
    await page.mouse.click(10, 300); // referme la popover
    await attendre(400);
  } else {
    o.note("REGLAGES-ABSENTS", "bouton Réglages introuvable");
  }
  // La boutique: filtres, quantités ×1 / ×10 / Max, détail d'un bâtiment.
  await o.onglet("Boutique");
  for (const q of ["×10", "Max", "×1"]) {
    const b = page.locator("[aria-label=\"Quantité d'achat\"] button", { hasText: q }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click();
      await attendre(700);
      await o.shot("quantite-" + q.replace("×", "x"));
    } else o.note("QUANTITE-ABSENTE", q);
  }
  const filtres = page.locator("[aria-label='Filtrer les bâtiments'] button");
  const nbFiltres = await filtres.count().catch(() => 0);
  for (let i = 0; i < nbFiltres; i++) {
    await filtres.nth(i).click().catch(() => {});
    await attendre(500);
  }
  const detail = page.locator("[aria-label^='Détail de']").first();
  if (await detail.isVisible().catch(() => false)) {
    await detail.click();
    await attendre(800);
    await o.shot("detail-batiment");
  }
  // Les quêtes: elle en remplace une.
  await o.onglet("Quêtes");
  const remplacer = page.locator("[aria-label^='Remplacer la quête']").first();
  if (await remplacer.isVisible().catch(() => false)) {
    await remplacer.click();
    o.note("quete", "quête remplacée");
    await attendre(700);
    await o.shot("quete-remplacee");
  }
  // Les succès et leurs filtres.
  await o.onglet("Profil");
  const succes = page.locator("[aria-label='Filtrer les succès'] [role='tab']");
  const nbSucces = await succes.count().catch(() => 0);
  for (let i = 0; i < Math.min(nbSucces, 4); i++) {
    await succes.nth(i).click().catch(() => {});
    await attendre(500);
  }
  await o.shot("succes-filtres");
  // Le reste du temps: elle joue normalement.
  await o.onglet("Boutique");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(2, 4), Math.min(12, Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await attendre(alea(1500, 4000));
  }
  await o.shot("fin-de-session");
}

// Sam s'absente: il joue, cache l'onglet 2 min 30, revient, puis recharge la page.
async function sam(page, o) {
  const DUREE = 300;
  await attendre(1500);
  await o.shot("retour-apres-2h"); // sa sauvegarde date d'il y a deux heures
  await o.audit();
  await o.clics(3, 30);
  await o.acheterMoinsCher();
  const soldeAvant = await page.locator("[data-testid='solde']").textContent().catch(() => "?");
  o.note("avant-absence", `solde ${soldeAvant.trim()}`);
  // L'onglet passe en arrière-plan.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  o.note("absence", "onglet caché 150 s");
  await attendre(150_000);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  o.note("retour", "onglet de nouveau visible");
  await attendre(1200);
  await o.shot("apres-absence");
  await o.audit();
  await o.clics(3, 20);
  // Il recharge la page: la sauvegarde doit suivre sans accroc.
  const soldeAvantReload = await page.locator("[data-testid='solde']").textContent().catch(() => "?");
  o.note("avant-reload", `solde ${soldeAvantReload.trim()}`);
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await attendre(1500);
  const soldeApresReload = await page.locator("[data-testid='solde']").textContent().catch(() => "?");
  o.note("apres-reload", `solde ${soldeApresReload.trim()}`);
  await o.shot("apres-reload");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(2, Math.min(15, Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await attendre(1500);
  }
  await o.shot("fin-de-session");
}

// Léa, joueuse avancée: marché CRMB sous toutes les coutures, staking,
// Registre, mineurs, achats ×10/Max, renaissance, puis ascension.
async function lea(page, o) {
  const DUREE = 460;
  await attendre(1500);
  await o.shot("arrivee-migration-v5");
  o.note("cles-localstorage", await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("ookie")).join(", ")));

  // --- Le marché CRMB, méthodiquement -------------------------------------
  await o.onglet("CRMB");
  await attendre(1000);
  await o.shot("crmb-marche");
  const soldeCrmb = async () => (await page.locator("[data-testid='crmb-solde']").textContent().catch(() => "?")).trim();
  o.note("crmb-solde-initial", await soldeCrmb());
  for (const quantite of ["1", "5", "10", "25"]) {
    const q = page.locator("[aria-label='Quantité à échanger'] button", { hasText: new RegExp(`^${quantite}$`) }).first();
    if (await q.isVisible().catch(() => false)) {
      await q.click();
      await attendre(300);
      const acheter = page.locator("button", { hasText: /^Acheter/ }).first();
      if (await acheter.isEnabled().catch(() => false)) {
        await acheter.click();
        await attendre(400);
        o.note("crmb-achat", `${quantite} CRMB → solde ${await soldeCrmb()}`);
      } else o.note("crmb-achat-refuse", quantite);
    }
  }
  const vendre = page.locator("button", { hasText: /^Vendre/ }).first();
  if (await vendre.isEnabled().catch(() => false)) {
    await vendre.click();
    await attendre(400);
    o.note("crmb-vente", `25 CRMB → solde ${await soldeCrmb()}`);
  }
  await o.shot("crmb-apres-echanges");

  // --- Staking: flexible (retirable) puis verrouillé 1 h -------------------
  const montant = page.locator("[aria-label='Montant à bloquer']");
  if (await montant.isVisible().catch(() => false)) {
    await montant.fill("5");
    await page.locator("button", { hasText: /^Bloquer$/ }).first().click().catch(() => {});
    await attendre(500);
    o.note("staking", `5 CRMB en flexible → solde ${await soldeCrmb()}`);
    const retirer = page.locator("button", { hasText: /^Retirer$/ }).first();
    if (await retirer.isVisible().catch(() => false)) {
      await retirer.click();
      await attendre(500);
      o.note("staking-retrait", `flexible retiré → solde ${await soldeCrmb()}`);
    } else o.note("STAKING-RETRAIT-ABSENT", "pas de bouton Retirer sur une position flexible");
    await page.locator("button", { hasText: "1 heure" }).first().click().catch(() => {});
    await montant.fill("5");
    await page.locator("button", { hasText: /^Bloquer$/ }).first().click().catch(() => {});
    await attendre(500);
    const verrou = await page.locator("button", { hasText: /^Verrouillé$/ }).first().isVisible().catch(() => false);
    o.note(verrou ? "staking-verrou" : "STAKING-VERROU-MANQUANT", `position 1 h ${verrou ? "bien verrouillée" : "SANS verrou visible"}`);
    await o.shot("crmb-staking");
  } else o.note("STAKING-ABSENT", "champ « Montant à bloquer » introuvable");

  // --- Le Registre: deux contrats ------------------------------------------
  for (let i = 0; i < 2; i++) {
    const signer = page.locator("button", { hasText: /^Signer un contrat/ }).first();
    if (await signer.isEnabled().catch(() => false)) {
      await signer.click();
      await attendre(500);
      o.note("registre", `contrat ${i + 1} signé → solde ${await soldeCrmb()}`);
    } else {
      o.note("registre-refuse", `contrat ${i + 1}: bouton indisponible`);
      break;
    }
  }
  // --- Les mineurs ----------------------------------------------------------
  const mineurs = page.locator("section:has-text('Extraction') button:enabled");
  const nbMineurs = await mineurs.count().catch(() => 0);
  for (let i = 0; i < Math.min(nbMineurs, 3); i++) {
    await mineurs.first().click().catch(() => {});
    await attendre(400);
    o.note("mineur", `achat ${i + 1}`);
  }
  await o.shot("crmb-final");

  // --- La boutique en gros: ×10 puis Max -----------------------------------
  await o.onglet("Boutique");
  for (const q of ["×10", "Max"]) {
    const b = page.locator("[aria-label=\"Quantité d'achat\"] button", { hasText: q }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click();
      await attendre(500);
      for (let i = 0; i < 3; i++) await o.acheterMoinsCher();
      o.note("achat-gros", q);
    }
  }
  await o.shot("boutique-apres-gros-achats");
  await o.clics(5, 20);

  // --- Renaissance ----------------------------------------------------------
  await o.onglet("Prestige");
  await attendre(1000);
  await o.shot("prestige-avant");
  const renaitre = page.locator("button", { hasText: /^Renaître/ }).first();
  if (await renaitre.isEnabled().catch(() => false)) {
    const texte = (await renaitre.textContent().catch(() => "")).trim();
    await renaitre.click();
    await attendre(1500);
    o.note("renaissance", texte);
    await o.shot("prestige-apres-renaissance");
    // Un ou deux nœuds célestes si disponibles.
    const noeuds = page.locator("[role='tabpanel'] button:enabled, main button:enabled");
    void noeuds; // les nœuds précis dépendent du panneau: on capture plutôt l'écran
  } else {
    o.note("RENAISSANCE-INDISPONIBLE", (await renaitre.textContent().catch(() => "bouton absent")) || "?");
  }

  // --- Ascension ------------------------------------------------------------
  const ascendre = page.locator("button", { hasText: /^Ascendre/ }).first();
  if (await ascendre.isEnabled().catch(() => false)) {
    const texte = (await ascendre.textContent().catch(() => "")).trim();
    await ascendre.click();
    await attendre(1500);
    o.note("ascension", texte);
    await o.shot("prestige-apres-ascension");
  } else {
    const t = await ascendre.textContent().catch(() => "bouton absent");
    o.note("ascension-indisponible", (t || "?").trim());
    await o.shot("ascension-verrouillee");
  }

  // --- Le reste du temps: jeu normal après le grand saut --------------------
  await o.onglet("Boutique");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(3, 5), Math.min(15, Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await attendre(alea(1000, 3000));
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// L'orchestre.
// ---------------------------------------------------------------------------
const JOUEURS = [
  { nom: "nora", vue: { width: 1366, height: 768 }, save: null, joue: nora, duree: 300 },
  { nom: "max", vue: { width: 1440, height: 900 }, save: SAVE_MAX, joue: max_, duree: 300 },
  { nom: "iris", vue: { width: 390, height: 844 }, save: SAVE_IRIS, joue: iris, duree: 330 },
  { nom: "sam", vue: { width: 1280, height: 800 }, save: SAVE_SAM, joue: sam, duree: 300, ilYA2h: true },
  { nom: "lea", vue: { width: 1536, height: 960 }, save: SAVE_LEA, joue: lea, duree: 460, cleV5: true },
];

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function session(j) {
  const dossier = path.join(OUT, j.nom);
  fs.mkdirSync(dossier, { recursive: true });
  const contexte = await navigateur.newContext({
    viewport: j.vue,
    deviceScaleFactor: j.vue.width < 500 ? 2 : 1,
    recordVideo: { dir: path.join(OUT, "videos", j.nom), size: j.vue },
  });
  const page = await contexte.newPage();
  if (j.save) {
    await page.addInitScript(
      ({ save, cle, decalage }) => {
        const s = { ...save };
        const maintenant = Date.now();
        s.createdAt = maintenant - 3 * 86_400_000;
        s.lastTs = maintenant - decalage;
        localStorage.setItem(cle, JSON.stringify(s));
      },
      {
        save: j.save,
        cle: j.cleV5 ? "cookieCrazeSaveV5" : "cookieCrazeSaveV6",
        decalage: j.ilYA2h ? 7_200_000 : 5_000,
      }
    );
  }
  const o = outilsPour(j.nom, page, dossier);
  const cadence = setInterval(() => {
    o.audit();
  }, 20_000);
  const photos = setInterval(() => {
    o.shot("periodique");
  }, 45_000);

  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });
    await j.joue(page, o);
  } catch (e) {
    o.note("SESSION-CASSEE", String(e).slice(0, 200));
    await o.shot("crash").catch(() => {});
  } finally {
    clearInterval(cadence);
    clearInterval(photos);
    await o.audit().catch(() => {});
    // L'état final, tel que le stockage le garde.
    const etatFinal = await page
      .evaluate(() => {
        const brut = localStorage.getItem("cookieCrazeSaveV6");
        if (!brut) return null;
        const s = JSON.parse(brut);
        return {
          version: s.version,
          cookies: s.cookies,
          lifetime: s.lifetime,
          clics: s.stats && s.stats.clicks,
          bestCombo: s.stats && s.stats.bestCombo,
          crmb: s.crypto && s.crypto.balance,
          registre: s.crypto && s.crypto.ledger,
          chips: s.prestige && s.prestige.chips,
          ascensions: s.ascension && s.ascension.count,
          migreDepuis: s.migratedFrom,
        };
      })
      .catch(() => null);
    await contexte.close(); // finalise la vidéo

    // Le bilan brut du joueur.
    const grilleParZone = {};
    for (const a of o.audits) {
      for (const g of a.grille) {
        const cle = `${g.zone} :: ${g.texte}`;
        grilleParZone[cle] = grilleParZone[cle] || { ...g, vues: 0, onglets: new Set() };
        grilleParZone[cle].vues += 1;
        grilleParZone[cle].onglets.add(a.onglet);
      }
    }
    const bilan = {
      joueur: j.nom,
      dureeS: Math.round((Date.now() - o.debut) / 1000),
      etatFinal,
      erreursConsole: o.erreursConsole,
      horsGrille: Object.values(grilleParZone).map((g) => ({ ...g, onglets: [...g.onglets] })),
      pointsDecimaux: o.audits.flatMap((a) => a.points).slice(0, 20),
      textesCasses: o.audits.flatMap((a) => a.textes).slice(0, 20),
      debordements: o.audits.filter((a) => a.deborde).map((a) => a.onglet),
      bandeauxMax: Math.max(0, ...o.audits.map((a) => a.bandeaux)),
      evenements: o.evenements,
    };
    fs.writeFileSync(path.join(OUT, `${j.nom}.json`), JSON.stringify(bilan, null, 2));
    console.log(`[${j.nom}] terminé: ${bilan.dureeS}s, ${o.erreursConsole.length} erreur(s) console, ${bilan.horsGrille.length} nombre(s) hors grille`);
  }
}

await Promise.allSettled(JOUEURS.map(session));
await navigateur.close();
console.log("\nLes cinq sessions sont terminées. Bilans dans " + OUT);
