// === Orchestrateur de campagne ===
//
// Fait jouer les vingt profils automatisés par lots (la machine n'a que
// quatre cœurs: les profils à forte cadence de clic jouent dans des lots
// allégés pour que la latence d'injection ne fausse pas leur cadence).
//
// Chaque profil reçoit: un contexte de navigateur isolé, sa sauvegarde de
// départ, sa vidéo, ses captures, sa chronologie (un relevé toutes les 20 s),
// ses erreurs console et son bilan JSON.
//
// Usage:
//   node qa/harness/campagne.mjs [url] [dossier] [--profils=p01,p07] [--graine-offset=0]
//
// La campagne 2 relance le même script avec le même dossier de base et les
// mêmes graines: seule la version du jeu change.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { prng, outilsPour, ecrireBilan, scriptObservateur, attendre } from "./lib.mjs";
import { PROFILS } from "./profils.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const URL = args[0] || "http://127.0.0.1:4173/";
const OUT = args[1] || path.join(process.cwd(), "qa-artifacts", "campagne");
const filtreArg = process.argv.find((a) => a.startsWith("--profils="));
const seulement = filtreArg ? filtreArg.split("=")[1].split(",") : null;

fs.mkdirSync(OUT, { recursive: true });

// Les lots: trois ou quatre contextes à la fois, les gros cliqueurs isolés.
const LOTS = [
  ["p01-tres-lent-mobile", "p02-nouveau-mobile", "p09-minage-seul", "p16-sauvegarde-v3"],
  ["p03-nouveau-desktop", "p04-occasionnel-3cps", "p10-alternance", "p17-sauvegardes-v4-v5"],
  ["p05-normal-5cps", "p11-achats-hasard", "p13-mauvaise-strategie"],
  ["p06-rapide-8-11cps", "p12-optimiseur"],
  ["p07-tres-rapide-12-15cps", "p08-autoclicker-50cps"],
  ["p14-crmb-specialiste", "p15-queteur", "p20-accessibilite"],
  ["p18-prestige-arbre", "p19-ascension-voies"],
];

const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function session(profil) {
  const dossier = path.join(OUT, profil.nom);
  fs.mkdirSync(dossier, { recursive: true });
  const rnd = prng(profil.graine);

  // La vidéo des grands écrans est réduite de moitié: même contenu, moitié
  // moins de travail d'encodage pour la machine à quatre cœurs.
  const videoSize =
    profil.vue.width > 800
      ? { width: Math.round(profil.vue.width / 2), height: Math.round(profil.vue.height / 2) }
      : profil.vue;

  const contexte = await navigateur.newContext({
    viewport: profil.vue,
    deviceScaleFactor: 1,
    recordVideo: { dir: path.join(OUT, "videos", profil.nom), size: videoSize },
  });
  const page = await contexte.newPage();
  await page.addInitScript(scriptObservateur);
  if (profil.save) {
    await page.addInitScript(
      ({ save, cle, decalage }) => {
        // Un rechargement en cours de session NE remet PAS la sauvegarde de
        // départ: la continuité fait partie de ce qu'on mesure.
        if (localStorage.getItem(cle) || localStorage.getItem("cookieCrazeSaveV6")) return;
        const s = { ...save };
        const maintenant = Date.now();
        s.createdAt = maintenant - 3 * 86_400_000;
        s.lastTs = maintenant - (decalage || 5_000);
        localStorage.setItem(cle, JSON.stringify(s));
      },
      { save: profil.save, cle: profil.cle || "cookieCrazeSaveV6", decalage: profil.decalageMs }
    );
  }

  const o = outilsPour(profil.nom, page, dossier, rnd);
  const cadence = setInterval(() => o.audit(), 20_000);
  const photos = setInterval(() => o.shot("periodique"), 45_000);

  let etatFinal = null;
  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });
    await o.audit();
    await profil.joue(page, o, rnd);
  } catch (e) {
    o.note("SESSION-CASSEE", String(e).slice(0, 200));
    await o.shot("crash").catch(() => {});
  } finally {
    clearInterval(cadence);
    clearInterval(photos);
    await o.audit().catch(() => {});
    etatFinal = await page
      .evaluate(() => {
        const brut = localStorage.getItem("cookieCrazeSaveV6");
        if (!brut) return null;
        const s = JSON.parse(brut);
        const somme = (obj) => Object.values(obj || {}).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
        return {
          version: s.version,
          migreDepuis: s.migratedFrom,
          cookies: s.cookies,
          lifetime: s.lifetime,
          clics: s.stats && s.stats.clicks,
          batiments: somme(s.items),
          ameliorations: Object.keys(s.upgrades || {}).length,
          bestCombo: s.stats && s.stats.bestCombo,
          crmb: s.crypto && s.crypto.balance,
          crmbGagne: s.crypto && s.crypto.totalEarned,
          registre: s.crypto && s.crypto.ledger,
          machines: s.crypto && somme(s.crypto.miners),
          positions: s.crypto && s.crypto.positions && s.crypto.positions.length,
          chips: s.prestige && s.prestige.chips,
          prestiges: s.stats && s.stats.prestigeCount,
          etoiles: s.ascension && s.ascension.stars,
          ascensions: s.ascension && s.ascension.count,
          joueMs: s.stats && s.stats.playtimeMs,
        };
      })
      .catch(() => null);
    await contexte.close(); // finalise la vidéo
    const bilan = ecrireBilan(OUT, profil, o, etatFinal);
    console.log(
      `[${profil.nom}] ${bilan.dureeS}s · ${bilan.clicsEnvoyes} clics envoyés · ` +
        `${bilan.erreursConsole.length} erreur(s) console · ${bilan.horsRegle.length} nombre(s) hors règle · ` +
        `${bilan.verificationsVues} vérification(s)`
    );
  }
}

const profilsActifs = seulement ? PROFILS.filter((p) => seulement.includes(p.nom)) : PROFILS;
const parNom = Object.fromEntries(profilsActifs.map((p) => [p.nom, p]));

console.log(`Campagne: ${profilsActifs.length} profil(s) → ${OUT}`);
const departCampagne = Date.now();
for (const lot of LOTS) {
  const membres = lot.map((n) => parNom[n]).filter(Boolean);
  if (!membres.length) continue;
  console.log(`— lot: ${membres.map((m) => m.nom).join(" · ")}`);
  await Promise.allSettled(membres.map(session));
  await attendre(1500);
}
await navigateur.close();

// L'index des vidéos: nom, taille, durée approx (durée de session), chemin.
const lignes = ["| Profil | Vidéo | Taille | Durée session | Chemin |", "| --- | --- | --- | --- | --- |"];
for (const p of profilsActifs) {
  const dossierVideo = path.join(OUT, "videos", p.nom);
  let fichier = null;
  try {
    fichier = fs.readdirSync(dossierVideo).find((f) => f.endsWith(".webm"));
  } catch {
    /* pas de vidéo */
  }
  if (fichier) {
    const complet = path.join(dossierVideo, fichier);
    const taille = (fs.statSync(complet).size / 1048576).toFixed(1);
    let duree = "?";
    try {
      duree = `${JSON.parse(fs.readFileSync(path.join(OUT, `${p.nom}.json`), "utf8")).dureeS}s`;
    } catch {
      /* bilan absent */
    }
    lignes.push(`| ${p.nom} | ${fichier} | ${taille} Mo | ${duree} | ${path.relative(process.cwd(), complet)} |`);
  } else {
    lignes.push(`| ${p.nom} | — absente — | | | |`);
  }
}
fs.writeFileSync(path.join(OUT, "index-videos.md"), lignes.join("\n") + "\n");
console.log(`\nCampagne terminée en ${Math.round((Date.now() - departCampagne) / 60000)} min. Index: ${path.join(OUT, "index-videos.md")}`);
