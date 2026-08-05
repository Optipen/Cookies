// === Les vingt profils automatisés ===
//
// Chaque profil est un SCRIPT — une persona simulée, jamais une personne. Sa
// graine fixe ses décisions: la campagne « après correction » rejoue les mêmes
// scénarios avec les mêmes graines, les mêmes fenêtres et les mêmes durées.
//
// Les états tardifs (prestige, Ascension, portefeuille CRMB) viennent de
// fixtures: aucun profil n'a réellement attendu dix jours, et le rapport
// le dit explicitement.

import { attendre, aleaDe } from "./lib.mjs";
import {
  SAVE_V3, SAVE_V4, SAVE_V5,
  SAVE_PETIT, SAVE_MOYEN, SAVE_CRMB, SAVE_QUETES,
  SAVE_PRESTIGE, SAVE_ASCENSION, SAVE_ACCESSIBILITE,
} from "./fixtures.mjs";

// Boucle de jeu « ordinaire »: clics à cadence donnée, achats, dorés, pauses.
async function boucleOrdinaire(page, o, rnd, { cps, dureeS, rafaleS = [10, 20], pauseS = [1.5, 4], acheter = true }) {
  const alea = aleaDe(rnd);
  while (o.resteMs(dureeS) > 0) {
    const reste = Math.max(1, o.resteMs(dureeS) / 1000);
    await o.clics(alea(cps[0], cps[1]), Math.min(alea(rafaleS[0], rafaleS[1]), reste));
    if (acheter) await o.acheterMoinsCher();
    await o.cookieDore();
    await attendre(alea(pauseS[0], pauseS[1]) * 1000);
  }
}

// Lit les cartes de la boutique et rend { label, prix, gain, ratio } triés.
async function lireBoutique(page) {
  return page.evaluate(() => {
    const parseFr = (txt) => {
      if (!txt) return NaN;
      const m = txt.replaceAll(/[\s  ]/g, "").match(/([\d]+(?:,\d+)?)(K|M|B|T|Qa|Qi|Sx|Sp|Oc|No|Dc)?/);
      if (!m) return NaN;
      const v = parseFloat(m[1].replace(",", "."));
      const exp = { K: 3, M: 6, B: 9, T: 12, Qa: 15, Qi: 18, Sx: 21, Sp: 24, Oc: 27, No: 30, Dc: 33 }[m[2]] || 0;
      return v * Math.pow(10, exp);
    };
    const lignes = [];
    for (const carte of document.querySelectorAll("[data-shop] > * > *")) {
      const achat = carte.querySelector("button[aria-label^='Acheter']");
      const info = carte.querySelector("button[aria-label^='Détail']");
      if (!achat || !info) continue;
      const label = achat.getAttribute("aria-label") || "";
      const gainTxt = (info.querySelector("span.block") || {}).textContent || "";
      const prixM = label.match(/pour (.+) cookies/);
      const prix = prixM ? parseFr(prixM[1]) : NaN;
      const gain = parseFr(gainTxt.replace("+", ""));
      lignes.push({ label, prix, gain, actif: !achat.disabled, ratio: gain > 0 && prix > 0 ? gain / prix : 0 });
    }
    return lignes;
  });
}

async function acheterParLabel(page, o, label) {
  const b = page.locator(`[data-shop] button[aria-label="${label}"]:enabled`).first();
  if (await b.isVisible().catch(() => false)) {
    await b.click().catch(() => {});
    o.note("achat", label);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 1 · Nouveau joueur très lent — mobile 320×568
// ---------------------------------------------------------------------------
async function tresLentMobile(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.passeIntro(8000); // il lit tout l'écran d'accueil
  await o.shot("premier-ecran");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(0.6, 1.3), Math.min(alea(8, 16), Math.max(1, o.resteMs(DUREE) / 1000)));
    await attendre(alea(6, 14) * 1000); // il regarde, il hésite
    await o.acheterMoinsCher();
    if (rnd() < 0.2) {
      const detail = page.locator("[aria-label^='Détail de']").first();
      if (await detail.isVisible().catch(() => false)) {
        await detail.click().catch(() => {});
        await attendre(3000);
        await o.shot("detail-ouvert");
        await detail.click().catch(() => {});
      }
    }
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 2 · Nouveau joueur normal — mobile 390×844
// ---------------------------------------------------------------------------
async function nouveauMobile(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.passeIntro(4000);
  await o.shot("premier-ecran");
  let toursQuetes = 0;
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(2, 3.2), Math.min(alea(12, 22), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await attendre(alea(2, 5) * 1000);
    if (rnd() < 0.25 && toursQuetes < 3) {
      toursQuetes += 1;
      await o.onglet("Quêtes");
      await attendre(2500);
      if (toursQuetes === 1) await o.shot("quetes");
      await o.onglet("Boutique");
    }
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 3 · Nouveau joueur — ordinateur
// ---------------------------------------------------------------------------
async function nouveauDesktop(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.passeIntro(3000);
  await o.shot("premier-ecran");
  let vuAmeliorations = false;
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(3, 4.5), Math.min(alea(15, 25), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    if (rnd() < 0.3) {
      await o.onglet("Améliorations");
      await attendre(1800);
      if (!vuAmeliorations) {
        vuAmeliorations = true;
        await o.shot("ameliorations");
      }
      await o.acheterAmelioration();
      await o.onglet("Boutique");
    }
    await attendre(alea(1.5, 4) * 1000);
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 4 · Joueur occasionnel ~3 clics/s
// ---------------------------------------------------------------------------
async function occasionnel(page, o, rnd) {
  await o.shot("depart");
  await boucleOrdinaire(page, o, rnd, { cps: [2.6, 3.4], dureeS: 620, rafaleS: [15, 25], pauseS: [4, 9] });
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 5 · Joueur normal ~5 clics/s — la référence de calibration
// ---------------------------------------------------------------------------
async function normal5(page, o, rnd) {
  const DUREE = 620;
  await o.shot("depart");
  let miParcours = false;
  while (o.resteMs(DUREE) > 0) {
    if (!miParcours && o.resteMs(DUREE) < DUREE * 500) {
      miParcours = true;
      await o.shot("mi-session");
    }
    await boucleOrdinaire(page, o, rnd, { cps: [4.5, 5.5], dureeS: DUREE, rafaleS: [12, 20], pauseS: [1.5, 3.5] });
  }
  for (const t of ["Améliorations", "Quêtes", "Profil", "Boutique"]) await o.onglet(t);
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 6 · Joueur rapide 8–11 clics/s
// ---------------------------------------------------------------------------
async function rapide(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  let rafales = 0;
  while (o.resteMs(DUREE) > 0) {
    rafales += 1;
    await o.clics(alea(8, 11), Math.min(alea(15, 25), Math.max(1, o.resteMs(DUREE) / 1000)));
    if (rafales === 2) await o.shot("combo-plein");
    await o.acheterMoinsCher();
    if (rafales % 4 === 0) {
      await o.quantite("×10");
      await o.acheterMoinsCher();
      await o.quantite("×1");
    }
    await attendre(alea(0.8, 2.2) * 1000);
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 7 · Très rapide humain 12–15 clics/s en rafales — ne doit JAMAIS voir de
//     vérification. Si elle apparaît, c'est un faux positif à corriger.
// ---------------------------------------------------------------------------
async function tresRapide(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  let bornee = false;
  while (o.resteMs(DUREE) > 0) {
    // Rafales courtes très rapides, micro-pauses: le geste d'un humain énervé.
    await o.clics(alea(12, 15), alea(2, 4.5), { gigue: 0.3, politiqueVerif: "repondre" });
    await attendre(alea(0.25, 0.7) * 1000);
    if (rnd() < 0.3) await o.acheterMoinsCher();
    if (!bornee) {
      const msg = page.locator("text=Cadence créditée limitée");
      if (await msg.isVisible().catch(() => false)) {
        bornee = true;
        o.note("cadence-bornee-visible", "le bandeau de borne s'affiche");
        await o.shot("cadence-bornee");
      }
    }
  }
  if (o.verificationsVues > 0) o.note("VERIF-INJUSTIFIEE", `${o.verificationsVues} vérification(s) pour un humain rapide`);
  else o.note("verif-ok", "aucune vérification sur 12-15 clics/s humains");
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 8 · Autoclicker tenté à 50 clics/s — synthétique puis matériel régulier.
//     On ATTEND: crédit borné à 15/s, vérification déclenchée.
// ---------------------------------------------------------------------------
async function autoclicker(page, o, rnd) {
  const DUREE = 620;
  await o.shot("depart");

  // Phase A: autoclicker logiciel (extension) — événements synthétiques,
  // intervalle parfaitement régulier de 20 ms.
  await page.evaluate(() => {
    const b = document.querySelector("[aria-label^='Cliquer le cookie']");
    window.__autoFaits = 0;
    window.__auto = setInterval(() => {
      if (b) {
        b.click();
        window.__autoFaits += 1;
      }
    }, 20);
  });
  o.note("autoclicker", "phase A: synthétique 50/s démarré");
  const finA = Date.now() + 150_000;
  let verifieA = false;
  while (Date.now() < finA) {
    await attendre(2500);
    const modal = page.locator("[data-testid='verification']");
    if (await modal.isVisible().catch(() => false)) {
      if (!verifieA) {
        verifieA = true;
        o.note("verification-attendue", "déclenchée pendant l'autoclick synthétique");
        await o.shot("verification-autoclicker");
        // L'humain derrière l'autoclicker répond, puis relance sa machine.
        await o.verification();
      }
    }
  }
  const faitsA = await page.evaluate(() => {
    clearInterval(window.__auto);
    return window.__autoFaits;
  });
  o.note("autoclicker", `phase A finie: ${faitsA} clics synthétiques envoyés`);
  await o.verification();
  await o.shot("apres-phase-A");

  // Phase B: autoclicker « matériel » — vrais événements (CDP), intervalle
  // quasi régulier, aussi vite que la machine le permet.
  const biscuit = page.locator("[aria-label^='Cliquer le cookie']");
  const boite = await biscuit.boundingBox().catch(() => null);
  const finB = Date.now() + 150_000;
  let faitsB = 0;
  while (Date.now() < finB && boite) {
    await page.mouse.click(boite.x + boite.width / 2, boite.y + boite.height / 2).catch(() => {});
    faitsB += 1;
    if (faitsB % 40 === 0) await o.verification();
    await attendre(20);
  }
  o.note("autoclicker", `phase B finie: ${faitsB} clics matériels réguliers`);
  await o.verification();
  await o.shot("apres-phase-B");

  // Phase C: il abandonne l'autoclicker et joue comme un humain.
  await boucleOrdinaire(page, o, rnd, { cps: [4, 6], dureeS: DUREE, rafaleS: [10, 18], pauseS: [1.5, 3] });
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 9 · Minage seul — presque aucun clic; l'inactivité ne doit JAMAIS
//     déclencher de vérification, et le minage doit continuer onglet caché.
// ---------------------------------------------------------------------------
async function minageSeul(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  await o.filtre("Minage");
  await o.shot("filtre-minage");
  await o.clics(1, 2); // deux clics de découverte, puis plus rien
  while (o.resteMs(DUREE) > 0) {
    await o.acheterMoinsCher();
    await attendre(alea(8, 15) * 1000);
    await o.cookieDore();
    if (o.resteMs(DUREE) < 480_000 && o.resteMs(DUREE) > 420_000) {
      const avant = await page.evaluate(() => JSON.parse(localStorage.getItem("cookieCrazeSaveV6") || "{}").cookies || 0);
      await o.ongletCache(120);
      const apres = await page.evaluate(() => JSON.parse(localStorage.getItem("cookieCrazeSaveV6") || "{}").cookies || 0);
      o.note("minage-onglet-cache", `solde ${Math.round(avant)} → ${Math.round(apres)} pendant 120 s caché`);
      await o.shot("apres-onglet-cache");
    }
  }
  if (o.verificationsVues > 0) o.note("VERIF-SUR-INACTIF", "une vérification est apparue sans clics — interdit");
  else o.note("verif-ok", "aucune vérification pour un joueur inactif");
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 10 · Alternance clics / pauses / minage
// ---------------------------------------------------------------------------
async function alternance(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  let cache = false;
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(4, 6), Math.min(alea(25, 50), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await o.acheterMoinsCher();
    const pause = alea(30, 80);
    o.note("pause", `${Math.round(pause)}s sans toucher`);
    await attendre(Math.min(pause * 1000, Math.max(0, o.resteMs(DUREE))));
    if (!cache && o.resteMs(DUREE) < DUREE * 500) {
      cache = true;
      await o.ongletCache(60);
      await o.shot("apres-onglet-cache");
    }
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 11 · Achats au hasard
// ---------------------------------------------------------------------------
async function hasard(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  const onglets = ["Boutique", "Améliorations", "Quêtes", "CRMB", "Prestige", "Profil"];
  while (o.resteMs(DUREE) > 0) {
    const de = rnd();
    if (de < 0.35) {
      await o.clics(alea(1, 6), alea(4, 12));
    } else if (de < 0.6) {
      await o.quantite(rnd() < 0.5 ? "×1" : rnd() < 0.5 ? "×10" : "Max");
      const lignes = (await lireBoutique(page).catch(() => [])).filter((l) => l.actif);
      if (lignes.length) await acheterParLabel(page, o, lignes[Math.floor(rnd() * lignes.length)].label);
    } else if (de < 0.75) {
      await o.onglet(onglets[Math.floor(rnd() * onglets.length)]);
      await attendre(alea(1, 3) * 1000);
      await o.onglet("Boutique");
    } else if (de < 0.85) {
      await o.onglet("Améliorations");
      await o.acheterAmelioration();
      await o.onglet("Boutique");
    } else {
      await attendre(alea(3, 8) * 1000);
    }
    await o.cookieDore();
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 12 · Optimiseur — toujours le meilleur rendement/prix
// ---------------------------------------------------------------------------
async function optimiseur(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  await o.quantite("×1");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(4.5, 5.5), Math.min(alea(8, 14), Math.max(1, o.resteMs(DUREE) / 1000)));
    // Une amélioration payable passe toujours devant (×2 pour ~20 exemplaires).
    await o.onglet("Améliorations");
    const prise = await o.acheterAmelioration();
    await o.onglet("Boutique");
    if (!prise) {
      const lignes = (await lireBoutique(page).catch(() => [])).filter((l) => l.actif && l.ratio > 0);
      lignes.sort((a, b) => b.ratio - a.ratio);
      if (lignes.length) await acheterParLabel(page, o, lignes[0].label);
    }
    await o.cookieDore();
    await attendre(alea(0.8, 2) * 1000);
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 13 · Mauvaise stratégie puis réorientation — tout en Cliqueurs d'abord,
//      puis bascule complète vers le Minage à mi-session.
// ---------------------------------------------------------------------------
async function mauvaiseStrategie(page, o, rnd) {
  const DUREE = 620;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  await o.filtre("Clic");
  while (o.resteMs(DUREE) > DUREE * 500) {
    await o.clics(alea(3.5, 5), Math.min(alea(12, 20), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await attendre(alea(1, 3) * 1000);
  }
  o.note("pivot", "il réalise son erreur: bascule vers le Minage");
  await o.shot("avant-pivot");
  await o.filtre("Minage");
  await o.quantite("×10");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(2, 4), Math.min(alea(8, 15), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await attendre(alea(1, 3) * 1000);
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 14 · Spécialiste CRMB — marché, extraction, staking, Registre
// ---------------------------------------------------------------------------
async function crmbSpecialiste(page, o, rnd) {
  const DUREE = 780;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  await o.onglet("CRMB");
  await o.shot("crmb-marche");
  const soldeCrmb = async () =>
    (await page.locator("[data-testid='crmb-solde']").textContent().catch(() => "?")).trim();
  o.note("crmb-initial", await soldeCrmb());

  // Marché: chaque quantité, achat puis vente, en notant le solde à chaque pas.
  for (const q of ["1", "5", "10", "25"]) {
    const b = page.locator("[aria-label='Quantité à échanger'] button", { hasText: new RegExp(`^${q}$`) }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click().catch(() => {});
      await attendre(300);
      const acheter = page.locator("button", { hasText: /^Acheter/ }).first();
      if (await acheter.isEnabled().catch(() => false)) {
        await acheter.click().catch(() => {});
        await attendre(400);
        o.note("crmb-achat", `${q} → solde ${await soldeCrmb()}`);
      }
    }
  }
  const vendre = page.locator("button", { hasText: /^Vendre/ }).first();
  if (await vendre.isEnabled().catch(() => false)) {
    await vendre.click().catch(() => {});
    await attendre(400);
    o.note("crmb-vente", `25 → solde ${await soldeCrmb()}`);
  }
  await o.shot("crmb-apres-echanges");

  // Staking: flexible (retiré ensuite), 1 h (verrouillé), 6 h.
  const montant = page.locator("[aria-label='Montant à bloquer']");
  if (await montant.isVisible().catch(() => false)) {
    await montant.fill("7,5").catch(async () => montant.fill("7.5"));
    await page.locator("button", { hasText: /^Bloquer$/ }).first().click().catch(() => {});
    await attendre(500);
    o.note("staking", `7,5 flexible → ${await soldeCrmb()}`);
    const retirer = page.locator("button", { hasText: /^Retirer$/ }).first();
    if (await retirer.isVisible().catch(() => false)) {
      await retirer.click().catch(() => {});
      await attendre(500);
      o.note("staking-retrait", `flexible retiré → ${await soldeCrmb()}`);
    }
    for (const [palier, somme] of [["1 heure", "5"], ["6 heures", "10"]]) {
      await page.locator("button", { hasText: palier }).first().click().catch(() => {});
      await montant.fill(somme).catch(() => {});
      await page.locator("button", { hasText: /^Bloquer$/ }).first().click().catch(() => {});
      await attendre(500);
      o.note("staking", `${somme} en ${palier} → ${await soldeCrmb()}`);
    }
    await o.shot("crmb-staking");
  }

  // Registre: deux contrats.
  for (let i = 0; i < 2; i++) {
    const signer = page.locator("button", { hasText: /^Signer un contrat/ }).first();
    if (await signer.isEnabled().catch(() => false)) {
      await signer.click().catch(() => {});
      await attendre(500);
      o.note("registre", `contrat ${i + 1} → ${await soldeCrmb()}`);
    }
  }
  await o.shot("crmb-registre");

  // Extraction: trois machines.
  for (let i = 0; i < 3; i++) {
    const m = page.locator("section:has-text('Extraction') button:enabled").first();
    if (await m.isVisible().catch(() => false)) {
      await m.click().catch(() => {});
      await attendre(400);
      o.note("extraction", `machine ${i + 1}`);
    }
  }
  await o.shot("crmb-extraction");

  // Le reste: il surveille le cours et fait tourner la partie.
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(2, 4), Math.min(alea(10, 18), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    if (rnd() < 0.4) {
      await o.onglet("CRMB");
      await attendre(alea(3, 6) * 1000);
      // Achète quand la tendance est rouge, vend quand elle est verte.
      const tendance = await page.locator("section:has-text('CrumbCoin') .text-red-600, section:has-text('CrumbCoin') .text-emerald-600").first().textContent().catch(() => "");
      if (tendance.includes("▼")) {
        const acheter = page.locator("button", { hasText: /^Acheter/ }).first();
        if (await acheter.isEnabled().catch(() => false)) {
          await acheter.click().catch(() => {});
          o.note("crmb-achat-creux", `tendance ${tendance.trim().slice(0, 12)} → ${await soldeCrmb()}`);
        }
      } else if (tendance.includes("▲")) {
        const v = page.locator("button", { hasText: /^Vendre/ }).first();
        if (await v.isEnabled().catch(() => false)) {
          await v.click().catch(() => {});
          o.note("crmb-vente-sommet", `tendance ${tendance.trim().slice(0, 12)} → ${await soldeCrmb()}`);
        }
      }
      await o.onglet("Boutique");
    }
    await attendre(alea(2, 5) * 1000);
  }
  await o.onglet("CRMB");
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 15 · Chasseur de quêtes, succès et événements
// ---------------------------------------------------------------------------
async function queteur(page, o, rnd) {
  const DUREE = 780;
  const alea = aleaDe(rnd);
  await o.shot("depart");
  await o.onglet("Quêtes");
  await o.shot("quetes-depart");
  const remplacer = page.locator("[aria-label^='Remplacer la quête']").first();
  if (await remplacer.isVisible().catch(() => false)) {
    await remplacer.click().catch(() => {});
    o.note("quete", "une quête remplacée");
    await attendre(700);
    await o.shot("quete-remplacee");
  }
  await o.onglet("Boutique");
  let derniereLecture = 0;
  while (o.resteMs(DUREE) > 0) {
    // Il joue vite et court, pour nourrir les quêtes de clics et d'achats.
    await o.clics(alea(3.5, 5.5), Math.min(alea(10, 20), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await o.cookieDore();
    // Les miettes de la pluie: il les attrape toutes.
    for (let i = 0; i < 6; i++) {
      const miette = page.locator("[aria-label='Attraper une miette']").first();
      if (!(await miette.isVisible().catch(() => false))) break;
      await miette.click().catch(() => {});
      o.note("miette", "attrapée");
      await attendre(250);
    }
    // Toutes les ~90 s, il relit ses quêtes.
    if (Date.now() - derniereLecture > 90_000) {
      derniereLecture = Date.now();
      await o.onglet("Quêtes");
      await attendre(alea(2, 4) * 1000);
      await o.onglet("Boutique");
    }
    await attendre(alea(0.8, 2) * 1000);
  }
  await o.onglet("Quêtes");
  await o.shot("quetes-fin");
  await o.onglet("Profil");
  await o.shot("succes-fin");
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 16 · Ancienne sauvegarde v3
// ---------------------------------------------------------------------------
async function sauvegardeV3(page, o, rnd) {
  const DUREE = 620;
  await attendre(1500);
  await o.shot("arrivee-v3");
  const cles = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.includes("ookie")).join(", ")
  );
  o.note("cles-localstorage", cles);
  if (!cles.includes("cookieCrazeSaveV3")) o.note("CLE-V3-PERDUE", "l'ancienne clé a disparu — interdit");
  const migre = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("cookieCrazeSaveV6") || "null");
    return s && { version: s.version, migreDepuis: s.migratedFrom, cookies: s.cookies, batiments: Object.keys(s.items || {}).length, bestCombo: s.stats && s.stats.bestCombo };
  });
  o.note("migration-v3", JSON.stringify(migre));
  if (migre && migre.bestCombo > 1.75) o.note("COMBO-NON-BORNE", `bestCombo ${migre.bestCombo} > 1,75`);
  await boucleOrdinaire(page, o, rnd, { cps: [3.5, 4.5], dureeS: DUREE, rafaleS: [12, 20], pauseS: [1.5, 4] });
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 17 · Anciennes sauvegardes v4 puis v5 — deux migrations dans la même session
// ---------------------------------------------------------------------------
async function sauvegardesV4V5(page, o, rnd) {
  const DUREE = 660;
  await attendre(1500);
  await o.shot("arrivee-v4");
  o.note("migration-v4", JSON.stringify(await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("cookieCrazeSaveV6") || "null");
    return s && { migreDepuis: s.migratedFrom, positions: s.crypto && s.crypto.positions, bestCombo: s.stats && s.stats.bestCombo };
  })));
  // Le staking « à plat » de la v4 doit être devenu une position flexible.
  await o.onglet("CRMB");
  await attendre(1000);
  const flexible = await page.locator("li:has-text('Flexible')").first().isVisible().catch(() => false);
  o.note(flexible ? "staking-migre" : "STAKING-V4-PERDU", flexible ? "position flexible visible" : "l'ancien staking n'apparaît pas");
  await o.shot("v4-staking-migre");
  await o.onglet("Boutique");
  await boucleOrdinaire(page, o, rnd, { cps: [3.5, 4.5], dureeS: 300, rafaleS: [10, 18], pauseS: [1.5, 3.5] });

  // Deuxième vie: il repart d'une sauvegarde v5. La bascule doit se faire AU
  // PROCHAIN CHARGEMENT, avant le code du jeu: un simple clear() + reload ne
  // suffit pas, l'autosauvegarde de `pagehide` réécrit la clé V6 après le
  // clear et le jeu — correctement — reprend la partie en cours. (C'est
  // exactement ce que la campagne 1 a mesuré.)
  o.note("bascule", "on repart d'une sauvegarde v5 (bascule one-shot au chargement)");
  await page.context().addInitScript(() => {
    const demande = localStorage.getItem("__basculeV5");
    if (!demande) return;
    localStorage.clear();
    localStorage.setItem("cookieCrazeSaveV5", demande);
  });
  await page.evaluate((sauvegarde) => {
    localStorage.setItem("__basculeV5", JSON.stringify(sauvegarde));
  }, SAVE_V5);
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await attendre(1800);
  await o.shot("arrivee-v5");
  o.note("migration-v5", JSON.stringify(await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("cookieCrazeSaveV6") || "null");
    return s && { migreDepuis: s.migratedFrom, chips: s.prestige && s.prestige.chips, crmb: s.crypto && s.crypto.balance, ledger: s.crypto && s.crypto.ledger };
  })));
  await boucleOrdinaire(page, o, rnd, { cps: [3.5, 4.5], dureeS: DUREE, rafaleS: [10, 18], pauseS: [1.5, 3.5] });
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 18 · Prestige et arbre céleste
// ---------------------------------------------------------------------------
async function prestigeArbre(page, o, rnd) {
  const DUREE = 720;
  const alea = aleaDe(rnd);
  await attendre(1200);
  await o.shot("depart");
  await o.onglet("Prestige");
  await o.shot("prestige-avant");
  const renaitre = page.locator("button", { hasText: /^Renaître/ }).first();
  if (await renaitre.isEnabled().catch(() => false)) {
    await renaitre.click().catch(() => {});
    await attendre(600);
    const dialogue = page.locator("[data-testid='confirmation']");
    if (await dialogue.isVisible().catch(() => false)) {
      await o.shot("confirmation-renaissance");
      await dialogue.locator("button", { hasText: /^Renaître$/ }).click().catch(() => {});
    } else o.note("CONFIRMATION-ABSENTE", "renaissance sans dialogue");
    await attendre(1500);
    o.note("renaissance", "faite");
    await o.shot("apres-renaissance");
  } else o.note("RENAISSANCE-INDISPONIBLE", await renaitre.textContent().catch(() => "?"));

  // L'arbre céleste: il dépense ses chips fraîches, nœud par nœud.
  for (let i = 0; i < 6; i++) {
    const noeud = page.locator("button", { hasText: /^Améliorer ·/ }).first();
    if (await noeud.isEnabled().catch(() => false)) {
      const texte = (await noeud.textContent().catch(() => "")).trim();
      await noeud.click().catch(() => {});
      o.note("arbre", texte);
      await attendre(500);
    } else break;
  }
  await o.shot("arbre-apres-achats");

  // Puis il rejoue: le « départ lancé » et les bonus doivent se sentir.
  await o.onglet("Boutique");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(4.5, 5.5), Math.min(alea(12, 20), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await o.cookieDore();
    await attendre(alea(1, 3) * 1000);
  }
  await o.onglet("Prestige");
  await o.shot("prestige-fin");
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 19 · Ascension: Horizon, Éclat, Écho, bâtiments tardifs, seconde ascension
// ---------------------------------------------------------------------------
async function ascensionVoies(page, o, rnd) {
  const DUREE = 720;
  const alea = aleaDe(rnd);
  await attendre(1200);
  await o.shot("depart");
  await o.onglet("Prestige");
  await o.shot("voute-avant");

  // La Voûte: il monte chaque voie une fois.
  for (let i = 0; i < 3; i++) {
    const monter = page.locator("button", { hasText: /^Monter ·/ }).nth(i);
    if (await monter.isEnabled().catch(() => false)) {
      const texte = (await monter.textContent().catch(() => "")).trim();
      await monter.click().catch(() => {});
      o.note("voute", texte);
      await attendre(500);
    }
  }
  await o.shot("voute-apres-achats");

  // Les bâtiments tardifs ouverts par Horizon.
  await o.onglet("Boutique");
  await o.quantite("×10");
  for (let i = 0; i < 6; i++) await o.acheterMoinsCher();
  await o.shot("batiments-tardifs");

  await o.clics(alea(4, 5), 20);

  // Seconde ascension.
  await o.onglet("Prestige");
  const ascendre = page.locator("button", { hasText: /^Ascendre/ }).first();
  if (await ascendre.isEnabled().catch(() => false)) {
    await ascendre.click().catch(() => {});
    await attendre(600);
    const dialogue = page.locator("[data-testid='confirmation']");
    if (await dialogue.isVisible().catch(() => false)) {
      await o.shot("confirmation-ascension");
      await dialogue.locator("button", { hasText: /^Ascendre$/ }).click().catch(() => {});
    } else o.note("CONFIRMATION-ABSENTE", "ascension sans dialogue");
    await attendre(1500);
    o.note("ascension", "seconde ascension faite");
    await o.shot("apres-ascension");
    const survit = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("cookieCrazeSaveV6") || "{}");
      return { crmb: s.crypto && s.crypto.balance, registre: s.crypto && s.crypto.ledger, skin: s.skin, etoiles: s.ascension && s.ascension.stars, chips: s.prestige && s.prestige.chips, cookies: s.cookies };
    });
    o.note("apres-ascension-etat", JSON.stringify(survit));
  } else o.note("ASCENSION-INDISPONIBLE", await ascendre.textContent().catch(() => "?"));

  // Il redémarre sa partie post-ascension et redépense ses étoiles.
  for (let i = 0; i < 3; i++) {
    const monter = page.locator("button", { hasText: /^Monter ·/ }).nth(i);
    if (await monter.isEnabled().catch(() => false)) {
      await monter.click().catch(() => {});
      o.note("voute", `re-achat voie ${i + 1}`);
      await attendre(400);
    }
  }
  await o.onglet("Boutique");
  while (o.resteMs(DUREE) > 0) {
    await o.clics(alea(4, 5.5), Math.min(alea(12, 20), Math.max(1, o.resteMs(DUREE) / 1000)));
    await o.acheterMoinsCher();
    await attendre(alea(1, 2.5) * 1000);
  }
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// 20 · Accessibilité: retour hors-ligne, clavier, sons, animations réduites,
//      contraste, onglet caché, rechargement
// ---------------------------------------------------------------------------
async function accessibilite(page, o, rnd) {
  const DUREE = 720;
  await attendre(1800);
  // Retour après deux heures: le rapport hors-ligne doit être là.
  const modal = page.locator("[role='dialog']:has-text('Bon retour')");
  if (await modal.isVisible().catch(() => false)) {
    await o.shot("retour-hors-ligne");
    o.note("hors-ligne", (await modal.textContent().catch(() => "")).replace(/\s+/g, " ").slice(0, 120));
    await page.keyboard.press("Enter"); // « Encaisser » a le focus
    o.note("hors-ligne", "encaissé au clavier");
    await attendre(600);
  } else o.note("HORS-LIGNE-ABSENT", "aucun rapport après 2 h d'absence");
  await o.shot("apres-encaissement");

  // Clavier seul: onglets par Ctrl+chiffre, cookie par Entrée.
  for (const n of ["2", "3", "4", "5", "6", "1"]) {
    await page.keyboard.press(`Control+${n}`);
    await attendre(700);
  }
  o.note("clavier", "six onglets parcourus par Ctrl+1..6");
  await o.shot("apres-navigation-clavier");
  const biscuit = page.locator("[aria-label^='Cliquer le cookie']");
  await biscuit.focus().catch(() => {});
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Enter");
    await attendre(180);
  }
  o.note("clavier", "25 clics du cookie à la touche Entrée");

  // Réglages: sons coupés puis remis, volume, animations réduites, contraste.
  const reglages = page.locator("[aria-label='Réglages']").first();
  if (await reglages.isVisible().catch(() => false)) {
    await reglages.click();
    await attendre(500);
    await o.shot("reglages");
    const son = page.locator("button", { hasText: /Sons/ }).first();
    await son.click().catch(() => {});
    o.note("reglage", "sons coupés");
    await attendre(300);
    await son.click().catch(() => {});
    o.note("reglage", "sons remis");
    const volume = page.locator("#volume");
    if (await volume.isVisible().catch(() => false)) {
      await volume.focus();
      for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
      o.note("reglage", "volume baissé au clavier");
    }
    await page.locator("button", { hasText: /animation/i }).first().click().catch(() => {});
    o.note("reglage", "animations réduites");
    await attendre(300);
    await page.locator("button", { hasText: /contraste/i }).first().click().catch(() => {});
    o.note("reglage", "contraste élevé");
    await attendre(300);
    await page.keyboard.press("Escape");
    await attendre(400);
  }
  await o.shot("animations-reduites-contraste");

  // Il joue en mouvement réduit (en gardant 150 s pour l'absence et le rechargement).
  await boucleOrdinaire(page, o, rnd, { cps: [2.5, 4], dureeS: DUREE - 150, rafaleS: [10, 18], pauseS: [2, 5], acheter: true });
  await o.ongletCache(90);
  await o.shot("apres-onglet-cache");
  const avant = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("cookieCrazeSaveV6") || "{}");
    return { reducedMotion: s.ui && s.ui.reducedMotion, highContrast: s.ui && s.ui.highContrast, cookies: Math.round(s.cookies || 0) };
  });
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await attendre(1500);
  const apres = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("cookieCrazeSaveV6") || "{}");
    return { reducedMotion: s.ui && s.ui.reducedMotion, highContrast: s.ui && s.ui.highContrast, cookies: Math.round(s.cookies || 0) };
  });
  o.note("rechargement", `avant ${JSON.stringify(avant)} → après ${JSON.stringify(apres)}`);
  if (avant.reducedMotion !== apres.reducedMotion || avant.highContrast !== apres.highContrast) {
    o.note("REGLAGES-PERDUS", "les réglages d'accessibilité n'ont pas survécu au rechargement");
  }
  await o.shot("apres-rechargement");
  await o.shot("fin-de-session");
}

// ---------------------------------------------------------------------------
// Le catalogue des vingt profils.
// ---------------------------------------------------------------------------
export const PROFILS = [
  { nom: "p01-tres-lent-mobile", description: "Nouveau joueur très lent, mobile 320×568", vue: { width: 320, height: 568 }, graine: 101, dureeS: 620, save: null, joue: tresLentMobile },
  { nom: "p02-nouveau-mobile", description: "Nouveau joueur normal, mobile 390×844", vue: { width: 390, height: 844 }, graine: 102, dureeS: 620, save: null, joue: nouveauMobile },
  { nom: "p03-nouveau-desktop", description: "Nouveau joueur, ordinateur", vue: { width: 1366, height: 768 }, graine: 103, dureeS: 620, save: null, joue: nouveauDesktop },
  { nom: "p04-occasionnel-3cps", description: "Occasionnel ~3 clics/s", vue: { width: 1280, height: 800 }, graine: 104, dureeS: 620, save: SAVE_PETIT, joue: occasionnel },
  { nom: "p05-normal-5cps", description: "Normal ~5 clics/s", vue: { width: 1440, height: 900 }, graine: 105, dureeS: 620, save: SAVE_PETIT, joue: normal5 },
  { nom: "p06-rapide-8-11cps", description: "Rapide 8–11 clics/s", vue: { width: 1440, height: 900 }, graine: 106, dureeS: 620, save: SAVE_PETIT, joue: rapide },
  { nom: "p07-tres-rapide-12-15cps", description: "Très rapide humain 12–15 clics/s en rafales", vue: { width: 1440, height: 900 }, graine: 107, dureeS: 620, save: SAVE_PETIT, joue: tresRapide },
  { nom: "p08-autoclicker-50cps", description: "Autoclicker tenté à 50 clics/s", vue: { width: 1366, height: 768 }, graine: 108, dureeS: 620, save: SAVE_PETIT, joue: autoclicker },
  { nom: "p09-minage-seul", description: "Minage seul, presque sans clic", vue: { width: 1280, height: 800 }, graine: 109, dureeS: 620, save: SAVE_MOYEN, joue: minageSeul },
  { nom: "p10-alternance", description: "Alternance clics / pauses / minage", vue: { width: 1366, height: 768 }, graine: 110, dureeS: 620, save: SAVE_PETIT, joue: alternance },
  { nom: "p11-achats-hasard", description: "Achats au hasard", vue: { width: 1366, height: 768 }, graine: 111, dureeS: 620, save: SAVE_MOYEN, joue: hasard },
  { nom: "p12-optimiseur", description: "Optimise le meilleur achat en continu", vue: { width: 1440, height: 900 }, graine: 112, dureeS: 620, save: SAVE_PETIT, joue: optimiseur },
  { nom: "p13-mauvaise-strategie", description: "Mauvaise stratégie puis réorientation", vue: { width: 1366, height: 768 }, graine: 113, dureeS: 620, save: SAVE_PETIT, joue: mauvaiseStrategie },
  { nom: "p14-crmb-specialiste", description: "Spécialiste CRMB: marché, extraction, staking, Registre", vue: { width: 1440, height: 900 }, graine: 114, dureeS: 780, save: SAVE_CRMB, joue: crmbSpecialiste },
  { nom: "p15-queteur", description: "Chasse quêtes, succès et événements", vue: { width: 1366, height: 768 }, graine: 115, dureeS: 780, save: SAVE_QUETES, joue: queteur },
  { nom: "p16-sauvegarde-v3", description: "Ancienne sauvegarde v3", vue: { width: 1280, height: 800 }, graine: 116, dureeS: 620, save: SAVE_V3, cle: "cookieCrazeSaveV3", joue: sauvegardeV3 },
  { nom: "p17-sauvegardes-v4-v5", description: "Anciennes sauvegardes v4 puis v5", vue: { width: 1280, height: 800 }, graine: 117, dureeS: 660, save: SAVE_V4, cle: "cookieCrazeSaveV4", joue: sauvegardesV4V5 },
  { nom: "p18-prestige-arbre", description: "Prestige et arbre céleste (fixture au seuil)", vue: { width: 1440, height: 900 }, graine: 118, dureeS: 720, save: SAVE_PRESTIGE, joue: prestigeArbre },
  { nom: "p19-ascension-voies", description: "Ascension: Horizon, Éclat, Écho (fixture)", vue: { width: 1440, height: 900 }, graine: 119, dureeS: 720, save: SAVE_ASCENSION, joue: ascensionVoies },
  { nom: "p20-accessibilite", description: "Accessibilité: clavier, sons, animations réduites, hors-ligne, rechargement", vue: { width: 390, height: 844 }, graine: 120, dureeS: 720, save: SAVE_ACCESSIBILITE, decalageMs: 7_200_000, joue: accessibilite },
];
