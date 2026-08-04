import { ITEMS, BALANCE } from "./items.js";

// === Améliorations ===
//
// Générées à la demande plutôt que listées en dur: la réserve est infinie, il
// n'existe pas de « dernière amélioration ».
//
// Règle de lisibilité: les bonus sont toujours des valeurs propres. Les
// bâtiments apportent des additions nettes (+0,25 · +1 · +5 …) et les
// améliorations, réservées aux paliers, des multiplicateurs nets (×2 · ×3 · ×5)
// ou des points entiers de reversement (+1 %).
//
// Un identifiant encode tout ce qu'il faut pour reconstruire l'amélioration
// (`tier:oven:4`, `share:3`, `global:2`), ce qui garde les sauvegardes lisibles.

const NAMES = [
  "huilé", "renforcé", "optimisé", "industrialisé", "automatisé",
  "quantique", "transcendant", "cosmique", "divin", "absolu",
];

const ordinal = (n) => (n >= NAMES.length ? ` ${Math.floor(n / NAMES.length) + 1}` : "");

// --- Paliers de possession -------------------------------------------------

/** Seuil du n-ième palier: 10, 25, 50, 100, 200, 400, puis ×1,7. */
export function tierThreshold(n) {
  const early = [10, 25, 50, 100, 200, 400];
  if (n < early.length) return early[n];
  return Math.round(400 * Math.pow(1.7, n - early.length + 1));
}

/** Multiplicateur du n-ième palier: ×2 puis ×3 puis ×5. Toujours net. */
export function tierMultiplier(n) {
  if (n < 3) return 2;
  if (n < 5) return 3;
  return 5;
}

/** Coût d'un palier: environ quinze exemplaires du bâtiment au seuil atteint. */
const tierCost = (item, threshold) => Math.ceil(item.base * Math.pow(item.growth, threshold) * 15);

function makeTierUpgrade(item, n) {
  const threshold = tierThreshold(n);
  const value = tierMultiplier(n);
  const unit = item.mode === "click" ? "/clic" : "/s";
  return {
    id: `tier:${item.id}:${n}`,
    kind: "tier",
    family: item.mode,
    name: `${item.name} ${NAMES[n % NAMES.length]}${ordinal(n)}`,
    desc: `Chaque ${item.name} rapporte ${value} fois plus.`,
    emoji: item.emoji,
    target: item.id,
    type: "mult",
    value,
    badge: `×${value}`,
    unit,
    cost: tierCost(item, threshold),
    threshold,
    unlock: (s) => (s.items?.[item.id] || 0) >= threshold,
    progress: (s) => Math.min(1, (s.items?.[item.id] || 0) / threshold),
    hint: `${threshold} × ${item.name}`,
    remaining: (s) => Math.max(0, threshold - (s.items?.[item.id] || 0)),
  };
}

// --- Reversement du minage vers le clic ------------------------------------

/** Part fixe du minage reversée à chaque clic. Filet de sécurité, pas un axe. */
export const SHARE_BASE = BALANCE.click_share ?? 0.03;

// Il n'existe volontairement pas de famille qui multiplierait la seule
// puissance de clic. Une telle échelle ×2 sans équivalent côté minage faisait
// grimper le rapport actif/passif au-delà de 1 000× en six heures de jeu
// simulé. Les deux axes progressent par les mêmes leviers: paliers par bâtiment
// (×2 · ×3 · ×5) et bonus globaux.

// --- Bonus globaux ---------------------------------------------------------

const globalUnlockLifetime = (n) => 1_000_000 * Math.pow(60, n);

function makeGlobalUpgrade(n) {
  const required = globalUnlockLifetime(n);
  return {
    id: `global:${n}`,
    kind: "global",
    family: "all",
    name: `Levure ${NAMES[n % NAMES.length]}${ordinal(n)}`,
    desc: "Double le rendement de tous les bâtiments.",
    emoji: "🌟",
    target: "all",
    type: "mult",
    value: 2,
    badge: "×2",
    cost: Math.ceil(required * 4),
    unlock: (s) => (s.lifetime || 0) >= required,
    progress: (s) => Math.min(1, (s.lifetime || 0) / required),
    hint: `${required.toLocaleString("fr-FR")} cookies cuits`,
  };
}

// --- Résolution par identifiant -------------------------------------------

const cache = new Map();

/** Reconstruit une amélioration depuis son identifiant. `null` si inconnu. */
export function getUpgrade(id) {
  if (cache.has(id)) return cache.get(id);

  let upgrade = null;
  const [kind, a, b] = String(id).split(":");
  const idx = Number(kind === "tier" ? b : a);
  const valid = Number.isInteger(idx) && idx >= 0;

  if (kind === "tier" && valid) {
    const item = ITEMS.find((i) => i.id === a);
    if (item) upgrade = makeTierUpgrade(item, idx);
  } else if (kind === "global" && valid) {
    upgrade = makeGlobalUpgrade(idx);
  }

  cache.set(id, upgrade);
  return upgrade;
}

// --- Sélection pour l'interface -------------------------------------------

const firstUnowned = (owned, make, limit = 60) => {
  for (let n = 0; n < limit; n++) {
    const up = make(n);
    if (!owned[up.id]) return up;
  }
  return null;
};

/**
 * Améliorations à présenter maintenant: les achetables, plus le prochain palier
 * de chaque famille en guise d'objectif visible. La liste reste courte même si
 * le catalogue est infini.
 */
export function availableUpgrades(state) {
  const owned = state.upgrades || {};
  const list = [];

  for (const item of ITEMS) {
    const count = state.items?.[item.id] || 0;
    for (let n = 0; n < 80; n++) {
      const up = makeTierUpgrade(item, n);
      if (owned[up.id]) continue;
      list.push(up);
      if (up.threshold > count) break;
    }
  }

  for (const make of [makeGlobalUpgrade]) {
    const next = firstUnowned(owned, make);
    if (next) list.push(next);
  }

  return list;
}

/**
 * Prochain objectif à afficher en permanence: le palier le plus proche d'être
 * atteint, tous bâtiments confondus.
 */
export function nextMilestone(state) {
  let best = null;
  for (const item of ITEMS) {
    const count = state.items?.[item.id] || 0;
    for (let n = 0; n < 80; n++) {
      const up = makeTierUpgrade(item, n);
      if (state.upgrades?.[up.id]) continue;
      if (up.threshold <= count) continue; // déjà atteint, l'amélioration est en boutique
      const left = up.threshold - count;
      if (!best || left < best.left) best = { upgrade: up, item, owned: count, left };
      break;
    }
  }
  return best;
}
