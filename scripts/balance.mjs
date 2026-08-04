// Mesure du rapport actif / passif pour plusieurs cadences et horizons.
// Usage: npx vite-node scripts/balance.mjs
import { play, comboMoyen, ecartMedian } from "../src/sim/engine.js";

const H = [
  ["10 min", 600e3],
  ["1 h", 3600e3],
  ["6 h", 6 * 3600e3],
  ["1 j", 24 * 3600e3],
  ["30 j", 30 * 24 * 3600e3],
  ["90 j", 90 * 24 * 3600e3],
  ["365 j", 365 * 24 * 3600e3],
];

const f = (n) => (n >= 1e6 ? n.toExponential(2) : n.toFixed(2));

console.log("combo moyen tenu (rafale de 60 s) :");
for (const c of [1, 3, 5, 7, 10, 15, 30]) console.log(`  ${c} clics/s → ×${comboMoyen(c, 60).toFixed(3)}`);

// Sans prestige: on mesure ici le rapport actif/passif seul. Une renaissance
// juste avant l'horizon vide le parc et rendrait la mesure illisible.
for (const cps of [3, 5, 7, 15]) {
  console.log(`\n=== ${cps} clics/s, « optimiser », sans prestige ===`);
  console.log("horizon    ratio   minage        prodClics     parClic     achats  paliers");
  for (const [nom, ms] of H) {
    const r = play({ clicksPerSecond: cps, durationMs: ms, strategy: "optimiser", prestige: false });
    console.log(
      `${nom.padEnd(9)} ${r.stats.ratio.toFixed(2).padStart(6)}  ${f(r.stats.minage).padStart(12)}  ` +
        `${f(r.stats.prodClics).padStart(12)}  ${f(r.stats.parClic).padStart(10)}  ` +
        `${String(r.achats).padStart(6)}  ${String(r.stats.paliers).padStart(6)}`
    );
  }
}

console.log("\n=== rythme des premières minutes (5 clics/s) ===");
const r = play({ clicksPerSecond: 5, durationMs: 600e3, strategy: "optimiser" });
console.log("premier achat à", (r.decisions[0] / 1000).toFixed(1), "s");
console.log("achats en 60 s :", r.decisions.filter((t) => t <= 60e3).length);
console.log("écart médian 0–5 min :", ecartMedian(r.decisions, 0, 300e3).toFixed(1), "s");
console.log("écart médian 5–10 min :", ecartMedian(r.decisions, 300e3, 600e3).toFixed(1), "s");

console.log("\n=== stratégies comparées à 5 clics/s sur 1 h (sans prestige) ===");
for (const s of ["optimiser", "gourmand", "equilibre", "mineur", "cliqueur", "mauvaise", "aleatoire"]) {
  const x = play({ clicksPerSecond: 5, durationMs: 3600e3, strategy: s, prestige: false });
  console.log(
    `${s.padEnd(10)} total ${f(x.stats.total).padStart(12)}  ratio ${x.stats.ratio.toFixed(2).padStart(6)}  achats ${String(x.achats).padStart(4)}  bât. ${x.stats.batiments}`
  );
}

console.log("\n=== rythme du prestige (5 clics/s, 24 h) ===");
const p = play({ clicksPerSecond: 5, durationMs: 24 * 3600e3, strategy: "optimiser" });
console.log("premier prestige à", p.jalons.prestige != null ? (p.jalons.prestige / 60e3).toFixed(1) + " min" : "jamais");
console.log("prestiges en 24 h :", p.prestiges, "· chips :", p.stats.chips);
