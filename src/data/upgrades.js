import { ITEMS } from "./items.js";

// === Améliorations ===
//
// Elles sont générées à la demande, pas listées en dur. L'ancienne version en
// comptait dix au total: le joueur les avait toutes achetées en une vingtaine
// de minutes et cet axe de progression était définitivement épuisé.
//
// Un identifiant encode tout ce qu'il faut pour reconstruire l'amélioration
// (`tier:oven:50`, `share:3`, `global:2`), ce qui permet de les fabriquer à
// l'infini tout en gardant des sauvegardes lisibles.

// --- Paliers de possession ------------------------------------------------

/** Seuil de la n-ième amélioration d'un bâtiment: 10, 25, 50, 100, 200, puis ×1,6. */
export function tierThreshold(n) {
  const early = [10, 25, 50, 100, 200];
  if (n < early.length) return early[n];
  return Math.round(200 * Math.pow(1.6, n - early.length + 1));
}

/** Index du prochain palier strictement supérieur à `owned`. */
export function nextTierIndex(owned) {
  let n = 0;
  while (tierThreshold(n) <= owned) n++;
  return n;
}

const NAMES = [
  "huilé", "renforcé", "optimisé", "industrialisé", "automatisé",
  "quantique", "transcendant", "cosmique", "divin", "absolu",
];
const tierName = (item, n) => `${item.name} ${NAMES[n % NAMES.length]}${n >= NAMES.length ? ` ${Math.floor(n / NAMES.length) + 1}` : ""}`;

/** Coût d'une amélioration de palier: environ 12 exemplaires du bâtiment au seuil. */
function tierCost(item, threshold) {
  return Math.ceil(item.base * Math.pow(item.growth, threshold) * 12);
}

function makeTierUpgrade(item, n) {
  const threshold = tierThreshold(n);
  return {
    id: `tier:${item.id}:${n}`,
    kind: "tier",
    name: tierName(item, n),
    desc: `Double la production de ${item.name}.`,
    emoji: item.emoji,
    target: item.id,
    type: "mult",
    value: 2,
    cost: tierCost(item, threshold),
    threshold,
    unlock: (s) => (s.items?.[item.id] || 0) >= threshold,
    progress: (s) => Math.min(1, (s.items?.[item.id] || 0) / threshold),
    hint: `Nécessite ${threshold} × ${item.name}`,
  };
}

// --- Part de clic ----------------------------------------------------------
// C'est l'axe qui garde le clic pertinent en fin de partie: chaque niveau
// augmente la fraction de la production automatique reversée à chaque clic.

// Part de production reversée par clic.
//
// La part de base croît de façon logarithmique avec les bâtiments de clic:
// jamais plafonnée — donc ces bâtiments gardent une valeur à l'infini — mais
// assez lente pour que le clic reste 2,5 à 3 fois meilleur que l'idle, sans
// jamais l'écraser.
export const SHARE_BASE = 0.04;
export const SHARE_PER_DECADE = 0.005;

// Les améliorations « Doigté » ajoutent des paliers décroissants: elles restent
// gratifiantes sans faire diverger le ratio actif/passif.
export const shareUpgradeValue = (n) => 0.005 * Math.pow(0.8, n);

const shareUnlockLifetime = (n) => 5_000 * Math.pow(6, n);

function makeShareUpgrade(n) {
  const required = shareUnlockLifetime(n);
  return {
    id: `share:${n}`,
    kind: "share",
    name: `Doigté ${NAMES[n % NAMES.length]}`,
    desc: `+${(shareUpgradeValue(n) * 100).toFixed(2)} point de production reversée à chaque clic.`,
    emoji: "👆",
    target: "share",
    type: "share",
    value: shareUpgradeValue(n),
    cost: Math.ceil(required * 1.5),
    unlock: (s) => (s.lifetime || 0) >= required,
    progress: (s) => Math.min(1, (s.lifetime || 0) / required),
    hint: `Nécessite ${required.toExponential(0)} cookies cuits`,
  };
}

// --- Bonus globaux ---------------------------------------------------------

const globalUnlockLifetime = (n) => 250_000 * Math.pow(25, n);

function makeGlobalUpgrade(n) {
  const required = globalUnlockLifetime(n);
  return {
    id: `global:${n}`,
    kind: "global",
    name: `Levure ${NAMES[n % NAMES.length]}`,
    desc: "+25 % sur tous les bâtiments.",
    emoji: "🌟",
    target: "all",
    type: "mult",
    value: 1.25,
    cost: Math.ceil(required * 2),
    unlock: (s) => (s.lifetime || 0) >= required,
    progress: (s) => Math.min(1, (s.lifetime || 0) / required),
    hint: `Nécessite ${required.toExponential(0)} cookies cuits`,
  };
}

// --- Résolution par identifiant -------------------------------------------

const cache = new Map();

/** Reconstruit une amélioration depuis son identifiant. Rend `null` si inconnu. */
export function getUpgrade(id) {
  if (cache.has(id)) return cache.get(id);

  let upgrade = null;
  const [kind, a, b] = String(id).split(":");

  if (kind === "tier") {
    const item = ITEMS.find((i) => i.id === a);
    const n = Number(b);
    if (item && Number.isInteger(n) && n >= 0) upgrade = makeTierUpgrade(item, n);
  } else if (kind === "share") {
    const n = Number(a);
    if (Number.isInteger(n) && n >= 0) upgrade = makeShareUpgrade(n);
  } else if (kind === "global") {
    const n = Number(a);
    if (Number.isInteger(n) && n >= 0) upgrade = makeGlobalUpgrade(n);
  }

  cache.set(id, upgrade);
  return upgrade;
}

// --- Sélection pour l'interface -------------------------------------------

/** Index de la première amélioration non achetée d'une famille. */
const firstUnowned = (owned, make, limit = 40) => {
  for (let n = 0; n < limit; n++) {
    const up = make(n);
    if (!owned[up.id]) return up;
  }
  return null;
};

/**
 * Améliorations à présenter maintenant: celles qui sont achetables, plus le
 * palier suivant de chaque famille en guise d'objectif. La liste reste courte
 * même si le catalogue est infini.
 */
export function availableUpgrades(state) {
  const owned = state.upgrades || {};
  const list = [];

  for (const item of ITEMS) {
    const ownedCount = state.items?.[item.id] || 0;
    // Le premier palier non acheté, même s'il n'est pas encore atteint:
    // il sert de jalon visible « encore N bâtiments ».
    for (let n = 0; n < 60; n++) {
      const up = makeTierUpgrade(item, n);
      if (owned[up.id]) continue;
      list.push(up);
      // Un seul palier d'avance par bâtiment, sauf si plusieurs sont déjà atteints
      if (up.threshold > ownedCount) break;
    }
  }

  for (const make of [makeShareUpgrade, makeGlobalUpgrade]) {
    const next = firstUnowned(owned, make);
    if (next) list.push(next);
  }

  return list;
}

/** Nombre d'améliorations achetées, pour les succès et les statistiques. */
export const ownedUpgradeCount = (state) => Object.keys(state.upgrades || {}).length;

/** Bonus de part apporté par les améliorations « Doigté ». */
export function shareUpgradeBonus(upgrades = {}) {
  let bonus = 0;
  for (const id in upgrades) {
    if (!upgrades[id]) continue;
    const up = getUpgrade(id);
    if (up?.type === "share") bonus += up.value;
  }
  return bonus;
}

// Compat: certains modules importaient une liste. On expose la fenêtre courante
// via `availableUpgrades`, et ce tableau reste vide pour éviter tout usage erroné.
export const UPGRADES = [];
