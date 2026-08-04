// Rapport de simulation complet: deux familles de profils, onze horizons.
// Usage: npx vite-node scripts/simulations.mjs
//
// Ce n'est PAS un test humain. Il ne dit rien du plaisir, de la lisibilité ni
// du ressenti. Il mesure des nombres, avec les vraies formules du jeu.
import { play, ratioMedian, ecartMedian, marquantsEntre, premierAchatPaye } from "../src/sim/engine.js";

const MIN = 60e3;
const H = 3600e3;
const J = 24 * H;

const HORIZONS = [
  ["1 min", MIN],
  ["5 min", 5 * MIN],
  ["15 min", 15 * MIN],
  ["1 h", H],
  ["6 h", 6 * H],
  ["1 j", J],
  ["3 j", 3 * J],
  ["7 j", 7 * J],
  ["30 j", 30 * J],
  ["90 j", 90 * J],
  ["365 j", 365 * J],
];

// --- Famille 1: mécanique continue -----------------------------------------
// Une cadence tenue en permanence. Sert à isoler l'effet d'un paramètre.
const MECANIQUES = [
  { nom: "3 clics/s", cps: 3, strategy: "optimiser" },
  { nom: "5 clics/s", cps: 5, strategy: "optimiser" },
  { nom: "7 clics/s", cps: 7, strategy: "optimiser" },
  { nom: "15 clics/s", cps: 15, strategy: "optimiser" },
  { nom: "autoclicker 50/s", cps: 50, strategy: "optimiser" },
  { nom: "minage surtout", cps: 5, strategy: "mineur" },
  { nom: "achats au hasard", cps: 5, strategy: "aleatoire" },
  { nom: "optimiseur", cps: 7, strategy: "optimiser" },
  { nom: "mauvaise répartition", cps: 5, strategy: "mauvaise" },
];

// --- Famille 2: vraies sessions ---------------------------------------------
// `activeFraction` est la part du temps réellement passée à cliquer: c'est elle
// qui distingue un joueur d'une machine. Le reste du temps, le minage tourne.
const SESSIONS = [
  { nom: "occasionnel · 10 min/j", cps: 4, fraction: 10 / 1440, strategy: "equilibre", burst: 20 },
  { nom: "normal · 3×10 min/j", cps: 5, fraction: 30 / 1440, strategy: "equilibre", burst: 30 },
  { nom: "engagé · 1 h/j", cps: 5, fraction: 60 / 1440, strategy: "optimiser", burst: 60 },
  { nom: "très engagé · 2 h/j", cps: 6, fraction: 120 / 1440, strategy: "optimiser", burst: 90 },
  { nom: "surtout inactif · matin+soir", cps: 4, fraction: 12 / 1440, strategy: "mineur", burst: 20 },
  { nom: "économe (épargne)", cps: 5, fraction: 45 / 1440, strategy: "gourmand", burst: 45 },
  { nom: "acheteur immédiat", cps: 5, fraction: 45 / 1440, strategy: "mauvaise", burst: 45 },
  { nom: "revient après 3 jours", cps: 5, fraction: 20 / 1440, strategy: "equilibre", burst: 30 },
];

const f = (n) => {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (Math.abs(n) >= 1e5) return n.toExponential(2);
  return n.toFixed(n < 10 ? 2 : 0);
};
const duree = (s) =>
  !Number.isFinite(s) ? "—" : s >= 86400 ? `${(s / 86400).toFixed(1)} j` : s >= 3600 ? `${(s / 3600).toFixed(1)} h` : s >= 60 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(0)} s`;

function ligne(r, ms) {
  const s = r.stats;
  return [
    f(s.lifetime).padStart(9),
    f(s.cookies).padStart(9),
    f(s.parClic).padStart(9),
    f(s.cadence).padStart(6),
    f(s.prodClics).padStart(9),
    f(s.minage).padStart(9),
    f(s.total).padStart(9),
    ratioMedian(r.releves, ms).toFixed(2).padStart(6),
    String(r.achats).padStart(6),
    String(s.batiments).padStart(5),
    String(s.paliers).padStart(6),
    String(r.prestiges).padStart(4),
    String(r.ascensions).padStart(4),
    String(s.chips).padStart(7),
    String(s.etoiles).padStart(5),
    String(r.crmb).padStart(5),
    duree(ecartMedian(r.decisions, 0, ms, true)).padStart(9),
  ].join(" ");
}

const ENTETE =
  "horizon    cuits total   dispo. par clic cadence prod.clics    minage     total  ratio achats bât. paliers prst asc.   chips étoil. CRMB  décision";

function famille(titre, profils, fabrique) {
  console.log(`\n\n${"=".repeat(110)}\n${titre}\n${"=".repeat(110)}`);
  for (const p of profils) {
    console.log(`\n--- ${p.nom} ---`);
    console.log(ENTETE);
    for (const [nom, ms] of HORIZONS) {
      const r = play({ ...fabrique(p), durationMs: ms });
      console.log(`${nom.padEnd(7)} ${ligne(r, ms)}`);
    }
  }
}

famille("FAMILLE 1 — MÉCANIQUE CONTINUE (cadence tenue en permanence)", MECANIQUES, (p) => ({
  clicksPerSecond: p.cps,
  strategy: p.strategy,
}));

famille("FAMILLE 2 — VRAIES SESSIONS (le reste du temps, seul le minage tourne)", SESSIONS, (p) => ({
  clicksPerSecond: p.cps,
  activeFraction: p.fraction,
  strategy: p.strategy,
  burstS: p.burst,
}));

// --- Objectifs de rythme ----------------------------------------------------
console.log(`\n\n${"=".repeat(110)}\nOBJECTIFS DE RYTHME (joueur normal, 5 clics/s)\n${"=".repeat(110)}`);
const ref = play({ clicksPerSecond: 5, durationMs: 30 * J, strategy: "optimiser" });
const cible = (nom, valeur, bas, haut, unite = "") => {
  const ok = valeur >= bas && valeur <= haut;
  console.log(`${ok ? "  OK " : "  !! "} ${nom.padEnd(46)} ${String(valeur).padStart(10)}${unite}   cible ${bas}–${haut}${unite}`);
};
cible("premier achat payé (s)", +(premierAchatPaye(ref.decisions) / 1000).toFixed(1), 5, 15, " s");
cible("achats marquants dans la 1re minute", marquantsEntre(ref.decisions, 0, MIN), 2, 6);
cible("écart médian entre marquants, 0–5 min (s)", +ecartMedian(ref.decisions, 0, 5 * MIN, true).toFixed(1), 20, 40, " s");
cible("premier vrai palier (min)", +((ref.jalons["amélioration:tier"] ?? Infinity) / MIN).toFixed(1), 10, 20, " min");
cible("premier prestige (min)", +((ref.jalons.prestige ?? Infinity) / MIN).toFixed(1), 60, 120, " min");
cible("première ascension (j)", +((ref.jalons.ascension ?? Infinity) / J).toFixed(1), 5, 20, " j");
const derniere = Math.max(...Object.values(ref.jalons));
cible("dernière nouveauté du jeu (j)", +(derniere / J).toFixed(1), 7, 60, " j");

console.log("\nvagues de contenu (première apparition de chaque nouveauté):");
for (const [nom, t] of Object.entries(ref.jalons).sort((a, b) => a[1] - b[1])) {
  console.log(`  ${duree(t / 1000).padStart(9)}  ${nom}`);
}
