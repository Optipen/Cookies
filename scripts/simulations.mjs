// Rapport de simulation complet: quatre familles de profils, onze horizons.
// Usage: npx vite-node scripts/simulations.mjs [mecanique|sessions|complet|fermetures]
//
// Ce n'est PAS un test humain. Il ne dit rien du plaisir, de la lisibilité ni
// du ressenti. Il mesure des nombres, avec les vraies formules du jeu.
import {
  play,
  playFermetures,
  ratioMedian,
  ecartMedian,
  ecartMomentsInteressants,
  marquantsEntre,
  premierAchatPaye,
} from "../src/sim/engine.js";

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

// Un profil peut être sélectionné en argument pour paralléliser la mesure:
// `npx vite-node scripts/simulations.mjs mecanique` ou `sessions`.
const SEULEMENT = process.argv[2] || "";

function famille(titre, cle, profils, fabrique) {
  if (SEULEMENT && SEULEMENT !== cle) return;
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

famille("FAMILLE 1 — MÉCANIQUE CONTINUE (cadence tenue en permanence)", "mecanique", MECANIQUES, (p) => ({
  clicksPerSecond: p.cps,
  strategy: p.strategy,
}));

famille("FAMILLE 2 — VRAIES SESSIONS (le reste du temps, seul le minage tourne)", "sessions", SESSIONS, (p) => ({
  clicksPerSecond: p.cps,
  activeFraction: p.fraction,
  strategy: p.strategy,
  burstS: p.burst,
}));

// --- Famille 3: partie complète — quêtes, dorés, pluie, succès, CRMB --------
// Ce que le simulateur précédent ne voyait pas. Les quêtes et les succès
// tournent sur leur VRAI moteur; les événements aléatoires passent en
// espérance, avec un taux d'attrapage par profil. Les quêtes chronométrées
// échouent souvent ici (les tranches dépassent leur chrono): un joueur simulé
// qui les ignore. Le trading CRMB n'est pas modélisé: marche centrée et 2 % de
// frais par sens, l'espérance de tout aller-retour est négative.
const COMPLETS = [
  { nom: "normal + événements", cps: 5, strategy: "equilibre", dores: 0.6, pluie: 0.5 },
  { nom: "chasseur d'événements", cps: 5, strategy: "equilibre", dores: 0.95, pluie: 0.9 },
  { nom: "ignore les événements", cps: 5, strategy: "equilibre", dores: 0.05, pluie: 0 },
  { nom: "optimiseur + événements", cps: 5, strategy: "optimiser", dores: 0.6, pluie: 0.5 },
];
famille("FAMILLE 3 — PARTIE COMPLÈTE (quêtes réelles, événements en espérance, CRMB)", "complet", COMPLETS, (p) => ({
  clicksPerSecond: p.cps,
  strategy: p.strategy,
  decisionS: 10,
  evenements: { graine: 7, dores: p.dores, pluie: p.pluie },
}));

// --- Famille 4: l'onglet FERMÉ — sessions + vrais gains hors-ligne ----------
if (!SEULEMENT || SEULEMENT === "fermetures") {
  console.log(`\n\n${"=".repeat(110)}\nFAMILLE 4 — ONGLET FERMÉ (sessions réelles, puis la vraie fonction hors-ligne entre elles)\n${"=".repeat(110)}`);
  const FERMETURES = [
    { nom: "2 × 15 min/j", sessionsParJour: 2, sessionMin: 15 },
    { nom: "3 × 10 min/j", sessionsParJour: 3, sessionMin: 10 },
    { nom: "1 × 30 min/j", sessionsParJour: 1, sessionMin: 30 },
  ];
  for (const p of FERMETURES) {
    console.log(`\n--- ${p.nom} ---`);
    console.log("horizon    cuits total   hors-ligne   part h-l   sessions   CRMB   prestiges");
    for (const [nom, ms] of HORIZONS.filter(([, m]) => m >= J)) {
      const r = playFermetures({ durationMs: ms, sessionsParJour: p.sessionsParJour, sessionMin: p.sessionMin, decisionS: 10, evenements: { graine: 11 } });
      const part = r.produitTotal > 0 ? ((r.horsLigneCookies / r.produitTotal) * 100).toFixed(1) + " %" : "—";
      console.log(
        `${nom.padEnd(9)} ${f(r.produitTotal).padStart(11)} ${f(r.horsLigneCookies).padStart(12)} ${part.padStart(9)} ` +
          `${String(r.sessions).padStart(9)} ${f(r.crmbDetail.solde).padStart(6)} ${String(r.prestiges).padStart(9)}`
      );
    }
  }
}

// --- Économie CRMB par horizon (§ demandé: gains ET dépenses par profil) ----
if (!SEULEMENT || SEULEMENT === "complet") {
  console.log(`\n\n${"=".repeat(110)}\nÉCONOMIE CRMB — gains par source et par horizon (joueur normal + événements, 5 clics/s)\n${"=".repeat(110)}`);
  console.log("horizon    prestige   quêtes   succès   extraction    solde");
  for (const [nom, ms] of [["10 min", 600e3], ["30 min", 1800e3], ["1 h", H], ["1 j", J], ["7 j", 7 * J], ["30 j", 30 * J]]) {
    const r = play({ clicksPerSecond: 5, strategy: "equilibre", durationMs: ms, decisionS: 10, evenements: { graine: 7 } });
    const c = r.crmbDetail;
    console.log(
      `${nom.padEnd(9)} ${String(c.prestige).padStart(8)} ${String(c.quetes).padStart(8)} ${String(c.succes).padStart(8)} ` +
        `${String(c.extraction).padStart(11)} ${String(Math.round(c.solde * 100) / 100).padStart(8)}`
    );
  }
}

// --- Objectifs de rythme ----------------------------------------------------
//
// Le rythme se mesure DEUX fois: sur les seuls achats marquants — l'ancienne
// mesure, aveugle aux quêtes et aux dorés — et sur tous les MOMENTS
// INTÉRESSANTS (achat marquant, quête rendue, doré attrapé, succès), qui est
// ce que le joueur vit réellement. La stratégie est « equilibre »: un humain,
// pas un optimiseur parfait.
if (SEULEMENT === "mecanique") process.exit(0);
console.log(`\n\n${"=".repeat(110)}\nOBJECTIFS DE RYTHME (joueur normal, 5 clics/s, équilibre, événements réels)\n${"=".repeat(110)}`);
const ref = play({ clicksPerSecond: 5, durationMs: 30 * J, strategy: "equilibre", decisionS: 10, evenements: { graine: 7 } });
const refSans = play({ clicksPerSecond: 5, durationMs: 5 * MIN, strategy: "equilibre", decisionS: 10 });
const cible = (nom, valeur, bas, haut, unite = "") => {
  const ok = valeur >= bas && valeur <= haut;
  console.log(`${ok ? "  OK " : "  !! "} ${nom.padEnd(52)} ${String(valeur).padStart(10)}${unite}   cible ${bas}–${haut}${unite}`);
};
cible("premier achat payé (s)", +(premierAchatPaye(ref.decisions) / 1000).toFixed(1), 5, 15, " s");
cible("achats marquants dans la 1re minute", marquantsEntre(ref.decisions, 0, MIN), 2, 4);
cible("écart médian entre MOMENTS intéressants, 0–5 min (s)", +ecartMomentsInteressants(ref, 0, 5 * MIN).toFixed(1), 20, 45, " s");
console.log(
  `       (mémoire: le même écart sur les seuls achats marquants, sans événements: ${ecartMedian(refSans.decisions, 0, 5 * MIN, true).toFixed(1)} s — l'ancienne mesure du défaut connu)`
);
cible("premier vrai palier (min)", +((ref.jalons["amélioration:tier"] ?? Infinity) / MIN).toFixed(1), 10, 20, " min");
cible("premier prestige (min)", +((ref.jalons.prestige ?? Infinity) / MIN).toFixed(1), 60, 120, " min");
cible("première ascension (j)", +((ref.jalons.ascension ?? Infinity) / J).toFixed(1), 5, 20, " j");
const derniere = Math.max(...Object.values(ref.jalons));
cible("dernière nouveauté du jeu (j)", +(derniere / J).toFixed(1), 7, 60, " j");

console.log("\nvagues de contenu (première apparition de chaque nouveauté):");
for (const [nom, t] of Object.entries(ref.jalons).sort((a, b) => a[1] - b[1])) {
  console.log(`  ${duree(t / 1000).padStart(9)}  ${nom}`);
}
