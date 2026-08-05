// === Bibliothèque du harnais de campagne ===
//
// Vingt profils AUTOMATISÉS (des scripts Playwright, jamais des personnes)
// jouent chacun une session réelle de dix minutes ou plus dans un contexte de
// navigateur isolé: sauvegarde, vidéo et captures indépendantes.
//
// Ce fichier fournit ce que tous les profils partagent:
//   · un générateur pseudo-aléatoire SEMÉ — la campagne « après correction »
//     rejoue exactement les mêmes décisions que la campagne « avant »;
//   · l'auditeur de page, qui relève tout nombre affiché hors de la règle:
//     quarts sous 100, entiers dès 100, centièmes pour le CRMB, décimales
//     interdites dans les suffixes K/M/B;
//   · l'observateur de notifications (MutationObserver côté page);
//   · la boîte à outils d'une session: captures, chronologie 20 s, clics à
//     cadence contrôlée, achats, onglets, vérification humaine, cookies dorés.

import fs from "node:fs";
import path from "node:path";

export const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** PRNG mulberry32: même graine → même suite. C'est ce qui rend une campagne rejouable. */
export function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const aleaDe = (rnd) => (min, max) => min + rnd() * (max - min);

// ---------------------------------------------------------------------------
// L'auditeur — exécuté DANS la page. Règle des nombres auditée:
//   · valeur < 100        → multiple de 0,25 obligatoire (hors zones CRMB);
//   · valeur ≥ 100        → entier obligatoire (hors zones CRMB);
//   · zone CRMB           → deux décimales au plus;
//   · suffixe K/M/B/T…    → aucune décimale (« 1 910K », jamais « 1,91M »);
//   · multiplicateur ×N   → multiple de 0,25;
//   · point décimal       → faute de locale (le jeu est en français);
//   · NaN / undefined / Infinity / [object → texte cassé.
// Les pourcentages ne portent pas la grille des quarts (remises, tendances).
// ---------------------------------------------------------------------------
export function auditerLaPage() {
  const SUFFIXES = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud", "Dd"];
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
  // Zone CRMB: la section parle de CrumbCoin/Staking/Registre/Extraction, ou le
  // texte lui-même mentionne le CRMB. Les centièmes y sont permis, pas au-delà.
  const estZoneCrmb = (el, texte) => {
    if (/CRMB|CrumbCoin/i.test(texte)) return true;
    let n = el;
    while (n && n !== document.body) {
      if (n.tagName === "SECTION") {
        const h = n.querySelector("h3, h2");
        if (h && /CrumbCoin|Staking|Registre|Extraction/i.test(h.textContent)) return true;
      }
      if (n.dataset && n.dataset.testid === "crmb-solde") return true;
      n = n.parentElement;
    }
    return false;
  };

  const violations = [];
  const textes = [];
  const points = [];
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

    const crmb = estZoneCrmb(parent, t);
    const pousse = (cat, m, v) =>
      violations.push({ cat, texte: m, valeur: v, zone: zoneDe(parent), autour: t.trim().slice(0, 60) });

    // --- Nombres à virgule française -------------------------------------
    const reVirgule = /(\d{1,3}(?:[\s  ]\d{3})+|\d+),(\d+)/g;
    let m;
    while ((m = reVirgule.exec(t)) !== null) {
      const suite = t.slice(m.index + m[0].length, m.index + m[0].length + 4);
      const estPct = /^\s*%/.test(suite);
      const suffixe = SUFFIXES.find((s) => suite.startsWith(s) && !/^[a-z]/.test(suite.slice(s.length)));
      const v = parseFloat(m[1].replace(/[\s  ]/g, "") + "." + m[2]);
      const decimales = m[2].length;

      if (suffixe) {
        // Décimale dans un suffixe: le format « 1 910K » l'interdit.
        pousse("compact-decimales", m[0] + suffixe, v);
        continue;
      }
      if (estPct) {
        continue; // remises et tendances: pas de grille sur les pourcentages
      }
      if (crmb) {
        if (decimales > 2) pousse("crmb-centimes", m[0], v);
        continue;
      }
      if (v >= 100) {
        pousse("entier-requis", m[0], v);
      } else if (Math.round(v * 10000) % 2500 !== 0) {
        pousse("quart-requis", m[0], v);
      }
    }

    // --- Multiplicateurs « ×N » ------------------------------------------
    const reMult = /×\s?(\d+(?:,\d+)?)/g;
    while ((m = reMult.exec(t)) !== null) {
      const v = parseFloat(m[1].replace(",", "."));
      if (Number.isFinite(v) && Math.round(v * 10000) % 2500 !== 0) {
        pousse("mult-hors-grille", m[0], v);
      }
    }

    // --- Point décimal (faute de locale) ---------------------------------
    const rePoint = /(?<![\d,.:])(\d+)\.(\d+)(?![\d])/g;
    while ((m = rePoint.exec(t)) !== null) {
      points.push({ texte: m[0], zone: zoneDe(parent), autour: t.trim().slice(0, 50) });
    }
  }

  // --- Cibles tactiles trop petites (échantillon des boutons visibles) -----
  let ciblesPetites = 0;
  let pireCible = null;
  for (const b of document.querySelectorAll("button, [role='tab'], a, input")) {
    if (!visible(b)) continue;
    const r = b.getBoundingClientRect();
    const cote = Math.min(r.width, r.height);
    if (cote > 0 && cote < 44) {
      ciblesPetites += 1;
      if (!pireCible || cote < pireCible.cote) {
        pireCible = { cote: Math.round(cote), label: (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 40) };
      }
    }
  }

  const ongletActif = document.querySelector("[role='tab'][aria-selected='true']");
  const soldeEl = document.querySelector("[data-testid='solde']");
  const cadenceEl = document.querySelector("[data-testid='stat-cadence']");
  const notifs = window.__notifs ? window.__notifs.splice(0) : [];

  // Photographie de la sauvegarde (autosave ≤ 5 s de retard sur le vif)
  let etat = null;
  try {
    const brut = localStorage.getItem("cookieCrazeSaveV6");
    if (brut) {
      const s = JSON.parse(brut);
      const somme = (o) => Object.values(o || {}).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
      etat = {
        cookies: s.cookies,
        lifetime: s.lifetime,
        clics: s.stats && s.stats.clicks,
        batiments: somme(s.items),
        ameliorations: Object.keys(s.upgrades || {}).length,
        chips: s.prestige && s.prestige.chips,
        prestiges: s.stats && s.stats.prestigeCount,
        etoiles: s.ascension && s.ascension.stars,
        ascensions: s.ascension && s.ascension.count,
        crmb: s.crypto && s.crypto.balance,
        crmbGagne: s.crypto && s.crypto.totalEarned,
        registre: s.crypto && s.crypto.ledger,
        positions: s.crypto && s.crypto.positions && s.crypto.positions.length,
        machines: s.crypto && somme(s.crypto.miners),
        bestCombo: s.stats && s.stats.bestCombo,
        joueMs: s.stats && s.stats.playtimeMs,
      };
    }
  } catch {
    etat = { erreur: "sauvegarde illisible" };
  }

  return {
    violations,
    points,
    textes,
    deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    bandeaux: document.querySelectorAll("[role='status']").length,
    ciblesPetites,
    pireCible,
    onglet: ongletActif ? (ongletActif.getAttribute("aria-label") || ongletActif.textContent.trim()) : "?",
    solde: soldeEl ? soldeEl.textContent.trim().slice(0, 40) : "?",
    cadenceTexte: cadenceEl ? cadenceEl.textContent.trim().slice(0, 20) : null,
    notifs,
    memoire: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  };
}

/** Observateur de notifications, installé avant le chargement de la page. */
export const scriptObservateur = `
  window.__notifs = [];
  (function brancher() {
    if (!document.documentElement) {
      document.addEventListener("DOMContentLoaded", brancher, { once: true });
      return;
    }
    new MutationObserver(() => {
      document.querySelectorAll("[role='status']").forEach((el) => {
        const t = el.textContent.trim();
        const der = window.__notifs[window.__notifs.length - 1];
        if (t && (!der || der.texte !== t)) window.__notifs.push({ t: Date.now(), texte: t.slice(0, 120) });
      });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  })();
`;

// ---------------------------------------------------------------------------
// La boîte à outils d'une session.
// ---------------------------------------------------------------------------
export function outilsPour(nom, page, dossier, rnd) {
  const debut = Date.now();
  const evenements = [];
  const audits = [];
  const notifications = [];
  const erreursConsole = [];
  const alea = aleaDe(rnd);
  let compteurShots = 0;
  let shotsEvenement = 0;
  let clicsEnvoyes = 0;
  let verificationsVues = 0;

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
    notifications,
    erreursConsole,
    debut,
    get clicsEnvoyes() {
      return clicsEnvoyes;
    },
    get verificationsVues() {
      return verificationsVues;
    },
    note(type, detail) {
      evenements.push({ t: Math.round((Date.now() - debut) / 1000), type, detail });
    },
    async shot(etiquette) {
      compteurShots += 1;
      const t = Math.round((Date.now() - debut) / 1000);
      const fichier = path.join(
        dossier,
        `${String(compteurShots).padStart(2, "0")}-t${String(t).padStart(4, "0")}s-${etiquette}.png`
      );
      try {
        await page.screenshot({ path: fichier, timeout: 8000 });
        o.note("capture", `${etiquette} (t=${t}s)`);
      } catch (e) {
        o.note("capture-ratee", `${etiquette}: ${String(e).slice(0, 80)}`);
      }
    },
    /** Le relevé de la chronologie: audit complet + notifications fraîches. */
    async audit() {
      try {
        const r = await page.evaluate(auditerLaPage);
        r.t = Math.round((Date.now() - debut) / 1000);
        for (const n of r.notifs) notifications.push({ t: r.t, texte: n.texte });
        delete r.notifs;
        audits.push(r);
        if (r.textes.length) o.note("TEXTE-CASSE", JSON.stringify(r.textes.slice(0, 3)));
        if (r.deborde) {
          o.note("DEBORDEMENT", `onglet ${r.onglet}`);
          if (shotsEvenement < 10) {
            shotsEvenement += 1;
            await o.shot("anomalie-debordement");
          }
        }
      } catch {
        /* page en cours de navigation: on repassera */
      }
    },
    /** Répond à la vérification humaine si elle est à l'écran. */
    async verification(politique = "repondre") {
      const modal = page.locator("[data-testid='verification']");
      if (!(await modal.isVisible().catch(() => false))) return false;
      verificationsVues += 1;
      await o.shot("verification");
      if (politique === "ignorer") {
        o.note("verification", "affichée, laissée sans réponse");
        return true;
      }
      const question = await modal.locator("p").first().textContent().catch(() => "");
      const m = question && question.match(/nombre (\d+)/);
      if (m) {
        await modal.locator(`button:text-is("${m[1]}")`).first().click().catch(() => {});
        o.note("verification", `répondu « ${m[1]} »`);
      } else {
        o.note("VERIFICATION-ILLISIBLE", question || "(vide)");
      }
      await attendre(300);
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
    /**
     * Des clics à cadence contrôlée, gigue humaine comprise.
     * @param {number} cps cadence visée
     * @param {number} secondes durée
     * @param {object} opts { politiqueVerif, sansBonus, gigue }
     */
    async clics(cps, secondes, opts = {}) {
      const biscuit = page.locator("[aria-label^='Cliquer le cookie']");
      const boite = await biscuit.boundingBox().catch(() => null);
      if (!boite) {
        o.note("COOKIE-INTROUVABLE", "pas de bouton principal");
        return 0;
      }
      const gigue = opts.gigue ?? 0.35;
      const fin = Date.now() + secondes * 1000;
      let faits = 0;
      while (Date.now() < fin) {
        const x = boite.x + boite.width / 2 + alea(-boite.width / 5, boite.width / 5);
        const y = boite.y + boite.height / 2 + alea(-boite.height / 5, boite.height / 5);
        await page.mouse.click(x, y).catch(() => {});
        faits += 1;
        clicsEnvoyes += 1;
        if (faits % 12 === 0) {
          if (await o.verification(opts.politiqueVerif)) continue;
          if (!opts.sansBonus) await o.cookieDore();
        }
        await attendre(Math.max(15, (1000 / cps) * (1 - gigue + rnd() * 2 * gigue)));
      }
      o.note("clics", `${faits} clics à ~${Math.round(cps * 10) / 10}/s visés`);
      return faits;
    },
    /** Achète le premier bâtiment payable (le moins cher affiché en premier). */
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
    /** Choisit la quantité d'achat: "×1", "×10" ou "Max". */
    async quantite(q) {
      const b = page.locator("[aria-label=\"Quantité d'achat\"] button", { hasText: q }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {});
        await attendre(300);
        return true;
      }
      return false;
    },
    /** Choisit le filtre de boutique: "Tout", "Clic" ou "Minage". */
    async filtre(f) {
      const b = page.locator("[aria-label='Filtrer les bâtiments'] button", { hasText: f }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {});
        await attendre(300);
        return true;
      }
      return false;
    },
    /** Achète une amélioration payable, s'il y en a une. */
    async acheterAmelioration() {
      const up = page.locator("button[aria-label*='coût']:enabled").first();
      if (await up.isVisible().catch(() => false)) {
        await up.click().catch(() => {});
        o.note("achat", "amélioration");
        return true;
      }
      return false;
    },
    /** Cache l'onglet (visibilitychange), attend, le remontre. */
    async ongletCache(secondes) {
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      o.note("onglet-cache", `${secondes}s`);
      await attendre(secondes * 1000);
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      o.note("onglet-visible", "retour");
      await attendre(800);
    },
    resteMs(dureeS) {
      return debut + dureeS * 1000 - Date.now();
    },
    async passeIntro(lectureMs = 2500) {
      const commencer = page.locator("button", { hasText: "Commencer" }).first();
      if (await commencer.isVisible().catch(() => false)) {
        await o.shot("intro");
        await attendre(lectureMs);
        await commencer.click().catch(() => {});
        o.note("intro", "« Commencer à cuire »");
        await attendre(900);
        return true;
      }
      return false;
    },
  };
  return o;
}

/** Écrit le bilan JSON d'un profil et retourne son résumé agrégé. */
export function ecrireBilan(OUT, profil, o, etatFinal, extra = {}) {
  const parCle = {};
  for (const a of o.audits) {
    for (const g of a.violations || []) {
      const cle = `${g.cat} :: ${g.zone} :: ${g.texte}`;
      parCle[cle] = parCle[cle] || { ...g, vues: 0, onglets: new Set() };
      parCle[cle].vues += 1;
      parCle[cle].onglets.add(a.onglet);
    }
  }
  const memoire = o.audits.map((a) => a.memoire).filter((m) => m != null);
  const bilan = {
    profil: profil.nom,
    description: profil.description,
    graine: profil.graine,
    vue: profil.vue,
    dureeS: Math.round((Date.now() - o.debut) / 1000),
    clicsEnvoyes: o.clicsEnvoyes,
    verificationsVues: o.verificationsVues,
    etatFinal,
    erreursConsole: o.erreursConsole,
    horsRegle: Object.values(parCle).map((g) => ({ ...g, onglets: [...g.onglets] })),
    pointsDecimaux: o.audits.flatMap((a) => a.points).slice(0, 20),
    textesCasses: o.audits.flatMap((a) => a.textes).slice(0, 20),
    debordements: [...new Set(o.audits.filter((a) => a.deborde).map((a) => a.onglet))],
    ciblesPetitesMax: Math.max(0, ...o.audits.map((a) => a.ciblesPetites || 0)),
    pireCible: o.audits.map((a) => a.pireCible).filter(Boolean).sort((a, b) => a.cote - b.cote)[0] || null,
    notifications: o.notifications,
    memoireMoDebut: memoire[0] ?? null,
    memoireMoFin: memoire[memoire.length - 1] ?? null,
    chronologie: o.audits.map((a) => ({
      t: a.t,
      onglet: a.onglet,
      solde: a.solde,
      cadence: a.cadenceTexte,
      etat: a.etat,
      violations: (a.violations || []).length,
      bandeaux: a.bandeaux,
      memoire: a.memoire,
    })),
    evenements: o.evenements,
    ...extra,
  };
  fs.writeFileSync(path.join(OUT, `${profil.nom}.json`), JSON.stringify(bilan, null, 2));
  return bilan;
}
