// Essai de fumée du harnais: une page, une minute, tous les instruments.
// Vérifie que les sélecteurs, l'auditeur, la vidéo et le bilan fonctionnent
// avant d'engager les vingt profils pour trois heures.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { prng, outilsPour, ecrireBilan, scriptObservateur } from "./lib.mjs";
import { SAVE_MOYEN } from "./fixtures.mjs";

const URL = process.argv[2] || "http://127.0.0.1:4173/";
const OUT = process.argv[3] || path.join(process.cwd(), "qa-artifacts", "fumee");
fs.mkdirSync(OUT, { recursive: true });

const profil = { nom: "fumee", description: "essai de fumée", vue: { width: 1280, height: 800 }, graine: 1, dureeS: 60 };
const rnd = prng(1);
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const contexte = await navigateur.newContext({
  viewport: profil.vue,
  recordVideo: { dir: path.join(OUT, "videos", "fumee"), size: { width: 640, height: 400 } },
});
const page = await contexte.newPage();
await page.addInitScript(scriptObservateur);
await page.addInitScript((save) => {
  const s = { ...save, createdAt: Date.now() - 86_400_000, lastTs: Date.now() - 5_000 };
  localStorage.setItem("cookieCrazeSaveV6", JSON.stringify(s));
}, SAVE_MOYEN);

const o = outilsPour("fumee", page, OUT, rnd);
await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });
await o.audit();
await o.shot("depart");
await o.clics(5, 12);
await o.acheterMoinsCher();
await o.quantite("×10");
await o.filtre("Minage");
await o.filtre("Tout");
await o.onglet("CRMB");
await o.audit();
await o.onglet("Quêtes");
await o.onglet("Boutique");
await o.clics(14, 5, { gigue: 0.3 });
await o.audit();
await o.shot("fin");
const cadenceTexte = await page.locator("[data-testid='stat-cadence']").textContent().catch(() => "?");
console.log("cadence affichée pendant les clics:", JSON.stringify(cadenceTexte));
await contexte.close();
await navigateur.close();
const bilan = ecrireBilan(OUT, profil, o, null);
console.log(
  `fumée: ${bilan.dureeS}s · ${bilan.clicsEnvoyes} clics · ${bilan.erreursConsole.length} erreurs console · ` +
    `${bilan.horsRegle.length} hors règle · notifications: ${bilan.notifications.length}`
);
for (const v of bilan.horsRegle.slice(0, 12)) console.log("  hors-règle:", v.cat, v.texte, "→", v.zone);
for (const e of bilan.erreursConsole.slice(0, 5)) console.log("  console:", e.type, e.texte.slice(0, 120));
const videos = fs.readdirSync(path.join(OUT, "videos", "fumee")).filter((f) => f.endsWith(".webm"));
console.log("vidéo:", videos.length ? videos[0] : "ABSENTE");
