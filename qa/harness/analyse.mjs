// === Analyse des campagnes ===
//
// Agrège les bilans JSON d'une campagne en une synthèse lisible, et compare
// deux campagnes profil par profil — mêmes graines, mêmes scénarios: tout
// écart vient du code, pas du hasard.
//
// Usage:
//   node qa/harness/analyse.mjs qa-artifacts/campagne-1
//   node qa/harness/analyse.mjs qa-artifacts/campagne-1 qa-artifacts/campagne-2

import fs from "node:fs";
import path from "node:path";

const DOSSIER_1 = process.argv[2];
const DOSSIER_2 = process.argv[3] || null;
if (!DOSSIER_1) {
  console.error("usage: node qa/harness/analyse.mjs <campagne-1> [campagne-2]");
  process.exit(1);
}

const lire = (dossier) => {
  const bilans = {};
  for (const f of fs.readdirSync(dossier)) {
    if (!f.endsWith(".json")) continue;
    try {
      const b = JSON.parse(fs.readFileSync(path.join(dossier, f), "utf8"));
      if (b.profil) bilans[b.profil] = b;
    } catch {
      /* fichier illisible: il apparaîtra comme absent */
    }
  }
  return bilans;
};

const fmtN = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return n.toExponential(2);
  return String(Math.round(n * 100) / 100);
};

function synthese(nom, bilans) {
  const lignes = [`\n## Synthèse ${nom}\n`];
  const profils = Object.values(bilans).sort((a, b) => a.profil.localeCompare(b.profil));

  lignes.push("| Profil | Durée | Clics envoyés | Clics crédités | Erreurs console | Hors règle | Vérif. | Débord. | Notifs | Mémoire Mo |");
  lignes.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const b of profils) {
    lignes.push(
      `| ${b.profil} | ${b.dureeS}s | ${b.clicsEnvoyes} | ${fmtN(b.etatFinal?.clics)} | ${b.erreursConsole.length} | ` +
        `${b.horsRegle.length} | ${b.verificationsVues} | ${b.debordements.length ? b.debordements.join("/") : "0"} | ` +
        `${b.notifications.length} | ${b.memoireMoDebut ?? "?"}→${b.memoireMoFin ?? "?"} |`
    );
  }

  // Les violations de la règle des nombres, par catégorie et par zone.
  const parCat = {};
  for (const b of profils) {
    for (const v of b.horsRegle) {
      parCat[v.cat] = parCat[v.cat] || new Map();
      const cle = `${v.zone} :: ${v.texte}`;
      parCat[v.cat].set(cle, (parCat[v.cat].get(cle) || 0) + v.vues);
    }
  }
  lignes.push("\n### Nombres hors règle, par catégorie\n");
  for (const [cat, zones] of Object.entries(parCat).sort((a, b) => b[1].size - a[1].size)) {
    lignes.push(`- **${cat}** — ${zones.size} texte(s) distinct(s):`);
    const tri = [...zones.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    for (const [cle, vues] of tri) lignes.push(`    - ${cle} (vu ${vues}×)`);
    if (zones.size > 12) lignes.push(`    - … et ${zones.size - 12} autres`);
  }
  if (!Object.keys(parCat).length) lignes.push("- aucun ✓");

  // Erreurs console, textes cassés, points décimaux.
  const erreurs = profils.flatMap((b) => b.erreursConsole.map((e) => `${b.profil}: [${e.type}] ${e.texte.slice(0, 110)}`));
  lignes.push(`\n### Erreurs console (${erreurs.length})\n`);
  for (const e of [...new Set(erreurs)].slice(0, 15)) lignes.push(`- ${e}`);
  if (!erreurs.length) lignes.push("- aucune ✓");

  const casses = profils.flatMap((b) => b.textesCasses.map((t) => `${b.profil}: ${t.texte} (${t.zone})`));
  lignes.push(`\n### Textes cassés — NaN, undefined, Infinity (${casses.length})\n`);
  for (const t of [...new Set(casses)].slice(0, 10)) lignes.push(`- ${t}`);
  if (!casses.length) lignes.push("- aucun ✓");

  const points = profils.flatMap((b) => b.pointsDecimaux.map((t) => `${b.profil}: ${t.texte} (${t.zone})`));
  lignes.push(`\n### Points décimaux anglais (${points.length})\n`);
  for (const t of [...new Set(points)].slice(0, 10)) lignes.push(`- ${t}`);
  if (!points.length) lignes.push("- aucun ✓");

  // Cibles tactiles.
  const petites = profils.filter((b) => b.ciblesPetitesMax > 0);
  lignes.push(`\n### Cibles tactiles sous 44 px\n`);
  for (const b of petites)
    lignes.push(`- ${b.profil}: jusqu'à ${b.ciblesPetitesMax} cible(s), pire: ${b.pireCible ? `${b.pireCible.cote}px « ${b.pireCible.label} »` : "?"}`);
  if (!petites.length) lignes.push("- aucune ✓");

  // Les alertes notées par les scénarios (préfixe MAJUSCULE).
  const alertes = profils.flatMap((b) =>
    b.evenements.filter((e) => /^[A-Z]/.test(e.type) && e.type === e.type.toUpperCase()).map((e) => `${b.profil} t${e.t}s ${e.type}: ${String(e.detail).slice(0, 90)}`)
  );
  lignes.push(`\n### Alertes de scénario (${alertes.length})\n`);
  for (const a of alertes.slice(0, 20)) lignes.push(`- ${a}`);
  if (!alertes.length) lignes.push("- aucune ✓");

  return lignes.join("\n");
}

function comparaison(avant, apres) {
  const lignes = ["\n## Comparaison avant → après\n"];
  lignes.push("| Profil | Lifetime | Bâtiments | CRMB | Hors règle | Erreurs | Notifs | Vérif. | Mémoire fin |");
  lignes.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  const noms = [...new Set([...Object.keys(avant), ...Object.keys(apres)])].sort();
  for (const nom of noms) {
    const a = avant[nom];
    const b = apres[nom];
    if (!a || !b) {
      lignes.push(`| ${nom} | ${!a ? "ABSENT avant" : "ABSENT après"} | | | | | | | |`);
      continue;
    }
    const c = (av, ap) => `${fmtN(av)} → ${fmtN(ap)}`;
    lignes.push(
      `| ${nom} | ${c(a.etatFinal?.lifetime, b.etatFinal?.lifetime)} | ${c(a.etatFinal?.batiments, b.etatFinal?.batiments)} | ` +
        `${c(a.etatFinal?.crmb, b.etatFinal?.crmb)} | ${a.horsRegle.length} → ${b.horsRegle.length} | ` +
        `${a.erreursConsole.length} → ${b.erreursConsole.length} | ${a.notifications.length} → ${b.notifications.length} | ` +
        `${a.verificationsVues} → ${b.verificationsVues} | ${fmtN(a.memoireMoFin)} → ${fmtN(b.memoireMoFin)} |`
    );
  }

  const totalAvant = Object.values(avant).reduce((s, b) => s + b.horsRegle.length, 0);
  const totalApres = Object.values(apres).reduce((s, b) => s + b.horsRegle.length, 0);
  lignes.push(`\n**Nombres hors règle, toutes campagnes confondues: ${totalAvant} → ${totalApres}**`);
  const regressions = [];
  for (const nom of noms) {
    const a = avant[nom];
    const b = apres[nom];
    if (!a || !b) continue;
    if (b.erreursConsole.length > a.erreursConsole.length) regressions.push(`${nom}: erreurs console ${a.erreursConsole.length} → ${b.erreursConsole.length}`);
    if (b.horsRegle.length > a.horsRegle.length) regressions.push(`${nom}: hors règle ${a.horsRegle.length} → ${b.horsRegle.length}`);
    if (b.debordements.length > a.debordements.length) regressions.push(`${nom}: débordements ${a.debordements.length} → ${b.debordements.length}`);
  }
  lignes.push(`\n### Régressions détectées (${regressions.length})\n`);
  for (const r of regressions) lignes.push(`- ${r}`);
  if (!regressions.length) lignes.push("- aucune ✓");
  return lignes.join("\n");
}

const bilans1 = lire(DOSSIER_1);
let sortie = synthese(path.basename(DOSSIER_1), bilans1);
if (DOSSIER_2) {
  const bilans2 = lire(DOSSIER_2);
  sortie += "\n" + synthese(path.basename(DOSSIER_2), bilans2);
  sortie += "\n" + comparaison(bilans1, bilans2);
}
const fichier = path.join(DOSSIER_2 || DOSSIER_1, "analyse.md");
fs.writeFileSync(fichier, sortie + "\n");
console.log(sortie);
console.log(`\n→ écrit dans ${fichier}`);
