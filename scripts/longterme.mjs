// Diagnostic de la progression longue durée: production, achats marquants et
// contenu neuf, du premier jour au trois-cent-soixante-cinquième.
// Usage: npx vite-node scripts/longterme.mjs
import { play, ecartMedian, marquantsEntre } from "../src/sim/engine.js";

const JOUR = 24 * 3600e3;
const BORNES = [
  ["1 h", 3600e3],
  ["6 h", 6 * 3600e3],
  ["1 j", JOUR],
  ["3 j", 3 * JOUR],
  ["7 j", 7 * JOUR],
  ["30 j", 30 * JOUR],
  ["90 j", 90 * JOUR],
  ["365 j", 365 * JOUR],
];

const f = (n) => (n >= 1e5 ? n.toExponential(2) : n.toFixed(0));
const duree = (s) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : s >= 60 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(0)} s`);

const r = play({ clicksPerSecond: 5, durationMs: 365 * JOUR, strategy: "optimiser" });

console.log("période      total/s      achats  marquants  écart médian entre marquants");
let precedent = 0;
for (const [nom, ms] of BORNES) {
  const jusque = r.decisions.filter((d) => d.t <= ms);
  const marquants = marquantsEntre(r.decisions, precedent, ms);
  const ecart = ecartMedian(r.decisions, precedent, ms, true);
  console.log(
    `${nom.padEnd(12)} ${"".padStart(10)}  ${String(jusque.length).padStart(6)}  ${String(marquants).padStart(9)}  ${duree(ecart)}`
  );
  precedent = ms;
}

console.log("\nproduction à chaque borne (une partie par borne):");
console.log("borne     sommet atteint   bât.  paliers  prestiges  ascensions  étoiles  voies");
for (const [nom, ms] of BORNES) {
  const x = play({ clicksPerSecond: 5, durationMs: ms, strategy: "optimiser" });
  console.log(
    `${nom.padEnd(8)} ${f(x.sommet).padStart(14)}/s ${String(x.stats.batiments).padStart(5)} ` +
      `${String(x.stats.paliers).padStart(8)} ${String(x.prestiges).padStart(10)} ` +
      `${String(x.ascensions).padStart(11)} ${String(x.stats.etoiles).padStart(8)}  ${JSON.stringify(x.stats.voies)}`
  );
}

console.log("\nnouveautés découvertes (premier exemplaire de chaque contenu):");
const jalons = Object.entries(r.jalons).sort((a, b) => a[1] - b[1]);
for (const [nom, t] of jalons) console.log(`  ${duree(t / 1000).padStart(9)}  ${nom}`);
console.log(`\ndernière nouveauté à ${duree(jalons[jalons.length - 1][1] / 1000)} · horizon simulé 365 j`);
