// Balayage: ratio actif/passif par cadence et par horizon.
// Utilisé pour caler `click_price_factor` et `click_share`.
// Usage: npx vite-node scripts/sweep.mjs
import { play, ratioMedian } from "../src/sim/engine.js";
import { CLICK_PRICE_FACTOR } from "../src/data/items.js";
import { SHARE_BASE } from "../src/data/upgrades.js";

const H = [
  ["10 min", 600e3],
  ["1 h", 3600e3],
  ["6 h", 6 * 3600e3],
  ["1 j", 24 * 3600e3],
  ["30 j", 30 * 24 * 3600e3],
  ["365 j", 365 * 24 * 3600e3],
];
const CIBLES = { 3: [1.5, 2.2], 5: [2.5, 2.8], 7: [3, 4] };

console.log(`facteur prix clic = ${CLICK_PRICE_FACTOR} · part reversée = ${SHARE_BASE}`);
console.log("cps  " + H.map(([n]) => n.padStart(7)).join("") + "   cible");
for (const cps of [3, 5, 7, 15]) {
  // Une seule partie, relevée à chaque horizon: c'est la même partie qui vieillit.
  const r = play({ clicksPerSecond: cps, durationMs: H[H.length - 1][1], strategy: "optimiser", prestige: false });
  const cells = H.map(([, ms]) => {
    const v = ratioMedian(r.releves, ms);
    const c = CIBLES[cps];
    const ok = !c || (v >= c[0] && v <= c[1]);
    return (v.toFixed(2) + (ok ? " " : "!")).padStart(7);
  });
  console.log(String(cps).padEnd(5) + cells.join("") + "   " + (CIBLES[cps] ? CIBLES[cps].join("–") : "borne autoclicker"));
}
