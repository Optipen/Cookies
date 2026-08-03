// === Valeurs dérivées ===
// Un seul endroit calcule CPS, CPC et coûts. Avant, la même formule était
// dupliquée dans le composant, les hooks et le moteur de missions, avec des
// résultats qui divergeaient.

import { ITEMS } from "../data/items.js";
import { getUpgrade, shareUpgradeBonus, SHARE_BASE, SHARE_PER_DECADE } from "../data/upgrades.js";
import { cpsFrom, computePerItemMult, clickWeightFrom } from "./calc.js";
import { prestigeEffects } from "../data/prestige.js";
import { stakingBoost, miningRate, stakingYieldPerSecond } from "./crypto.js";
import tuning from "../data/tuning.json";

export const modeCfg = () => {
  const mode = tuning?.mode || "standard";
  return tuning?.[mode] || {};
};

const earlyCfg = () => modeCfg().early || {};

export const isEarlyWindow = (state, now = Date.now()) => {
  const windowS = earlyCfg().window_s || 0;
  return !!state.createdAt && (now - state.createdAt) / 1000 < windowS;
};

/** Multiplicateur de clic issu des améliorations ciblant `cpc`. */
export function cpcUpgradeMult(upgrades = {}) {
  let m = 1;
  for (const id in upgrades) {
    if (!upgrades[id]) continue;
    const up = getUpgrade(id);
    if (up && up.target === "cpc" && up.type === "mult") m *= up.value;
  }
  return m;
}

// === Part de production par clic ===
//
// C'est la pièce maîtresse de l'équilibrage. Chaque clic reverse une fraction
// de la production automatique, ce qui rend le clic proportionnel à l'empire du
// joueur: il ne peut plus jamais décrocher, quel que soit le niveau atteint.
//
// Deux axes complémentaires, tous deux sans fin:
//  · les bâtiments de clic font monter la part vers son plafond;
//  · les améliorations « Doigté » relèvent ce plafond.
// Aucun des deux ne devient inutile.

export function clickShare(state) {
  const weight = clickWeightFrom(state.items || {}, state.upgrades || {});
  // Croissance logarithmique: chaque décuplement du parc de clic ajoute un
  // palier fixe. Sans plafond, mais assez lent pour que le clic reste
  // meilleur que l'idle sans jamais le rendre inutile.
  const fromBuildings = weight > 0 ? SHARE_PER_DECADE * Math.log10(1 + weight) : 0;
  return SHARE_BASE + fromBuildings + shareUpgradeBonus(state.upgrades);
}

// === Combo ===
// Cliquer sans interruption fait monter un multiplicateur qui retombe vite.
// C'est le mécanisme qui rend le jeu actif plus rentable que le jeu passif.

export const COMBO = {
  max: 3, // multiplicateur maximal
  clicksToMax: 30, // clics consécutifs pour l'atteindre
  windowMs: 1400, // délai au-delà duquel la chaîne casse
  decayPerSecond: 12, // clics perdus par seconde d'inactivité
};

/** Multiplicateur de combo pour un compteur de clics enchaînés. */
export const comboMultiplier = (streak = 0) =>
  1 + (COMBO.max - 1) * Math.min(1, Math.max(0, streak) / COMBO.clicksToMax);

/**
 * Toutes les stats dérivées d'un état, en un seul passage.
 * `now` est injectable pour que les tests ne dépendent pas de l'horloge.
 */
export function deriveStats(state, now = Date.now(), comboStreak = 0) {
  const prestige = prestigeEffects(state);
  const positions = state.crypto?.positions || [];
  const stakeMult = stakingBoost(positions);

  const buffActive = (state.buffs?.until || 0) > now;
  const buffCps = buffActive ? state.buffs.cpsMulti || 1 : 1;
  const buffCpc = buffActive ? state.buffs.cpcMulti || 1 : 1;

  const baseCps = cpsFrom(state.items || {}, state.upgrades || {}, state.prestige?.chips || 0, stakeMult) * prestige.cpsMult;
  const cps = baseCps * buffCps;

  // --- Puissance de clic ---
  // Deux composantes complémentaires:
  //  · une part « à plat », qui porte tout le début de partie;
  //  · une part indexée sur la production automatique, qui garantit que le clic
  //    ne décroche jamais, même avec des milliards de cookies par seconde.
  const earlyMult = isEarlyWindow(state, now) ? earlyCfg().cpc_base_mult || 1 : 1;
  const clickWeight = clickWeightFrom(state.items || {}, state.upgrades || {});
  // Terme « à plat »: porté par les bâtiments de clic, sans plafond. Il domine
  // le début de partie, puis s'efface de lui-même car la production automatique
  // croît bien plus vite que le parc de clic.
  const flatCpc = (state.cpcBase || 1) * (1 + clickWeight) * earlyMult * cpcUpgradeMult(state.upgrades) * prestige.cpcMult;

  const share = clickShare(state);
  const sharedCpc = baseCps * share;

  const combo = comboMultiplier(comboStreak);
  const cpc = (flatCpc + sharedCpc) * buffCpc * combo;

  return {
    cps,
    baseCps,
    cpc,
    // CPC sans combo: sert aux comparaisons avant/après achat
    cpcBase: (flatCpc + sharedCpc) * buffCpc,
    flatCpc,
    sharedCpc,
    clickShare: share,
    clickWeight,
    combo,
    stakeMult,
    prestige,
    buffActive,
    buffCps,
    buffCpc,
    perItemMult: computePerItemMult(state.items || {}, state.upgrades || {}),
    miningRate: miningRate(state.crypto?.miners) * prestige.cryptoMult,
    stakingYield: stakingYieldPerSecond(positions) * prestige.cryptoMult,
  };
}

/**
 * Revenu par seconde d'un joueur actif, pour comparer au mode passif.
 * `clicksPerSecond` par défaut correspond à un rythme soutenu confortable.
 */
export function activeIncome(state, clicksPerSecond = 7, now = Date.now()) {
  // À ce rythme la chaîne de combo reste pleine
  const stats = deriveStats(state, now, COMBO.clicksToMax);
  return stats.cps + stats.cpc * clicksPerSecond;
}

// === Coûts ===

/** Renchérissement par paliers de possession. */
export function milestoneFactor(owned) {
  const cfg = modeCfg().milestones || {};
  const thresholds = cfg.thresholds || [10, 25, 50, 100, 200];
  const multipliers = cfg.multipliers || [1.15, 1.4, 2.0, 3.5, 5.0];
  let m = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (owned >= thresholds[i]) m *= multipliers[i] || 1;
  }
  return m;
}

const MAX_BULK = 1000;

/**
 * Prix de `count` exemplaires à partir de `owned`.
 *
 * Le renchérissement est appliqué exemplaire par exemplaire. L'ancienne version
 * appliquait `milestoneFactor(owned)` — la valeur de départ — à toute la série:
 * acheter 200 fours d'un coup coûtait 15,8 fois moins cher que 200 achats
 * successifs, ce qui rendait le bouton ×100 strictement optimal.
 */
export function bulkCost(item, owned, count) {
  const n = Math.min(MAX_BULK, Math.max(0, Math.floor(count)));
  let total = 0;
  for (let k = 0; k < n; k++) {
    const at = owned + k;
    total += item.base * Math.pow(item.growth, at) * milestoneFactor(at);
    if (!isFinite(total)) return Infinity;
  }
  return total;
}

/**
 * Prix final d'un achat, remises comprises.
 * Retourne un entier ≥ 1, sauf gratuité explicite (tutoriel, premier auto offert).
 */
export function costOf(state, itemId, count = 1, now = Date.now()) {
  const item = ITEMS.find((x) => x.id === itemId);
  if (!item) return Infinity;

  const owned = state.items?.[itemId] || 0;
  let price = bulkCost(item, owned, count);
  if (!isFinite(price)) return Infinity;

  price *= prestigeEffects(state).costMult;

  const ecfg = earlyCfg();
  const early = isEarlyWindow(state, now);

  if (early && item.mode === "cps") {
    const ownedCps = ITEMS.filter((x) => x.mode === "cps").reduce((a, x) => a + (state.items?.[x.id] || 0), 0);
    const candidateId = state.flags?.freeFirstAutoItemId || ITEMS.find((x) => x.mode === "cps")?.id;
    const freeFirst =
      ecfg.free_first_auto &&
      ownedCps === 0 &&
      state.ui?.introSeen &&
      !state.flags?.freeFirstAutoGiven &&
      itemId === candidateId &&
      count === 1;
    if (freeFirst) return 0;
    price *= 1 - (ecfg.cps_discount || 0);
  }

  if (!state.ui?.introSeen && itemId === "cursor" && owned === 0 && count === 1) return 0;

  const discount = state.flags?.discountAll;
  if (discount && now < discount.until) price *= 1 - (discount.value || 0);

  const flash = state.flags?.flash;
  if (flash && flash.itemId === itemId && now < flash.until) price *= 1 - flash.discount;

  return Math.max(1, Math.ceil(price));
}

/** Quantité d'achat selon les modificateurs clavier. */
export const buyQuantity = (event) => (event?.shiftKey ? 10 : event?.ctrlKey || event?.metaKey ? 100 : 1);

/** Nombre maximal d'exemplaires achetables avec la banque actuelle. */
export function maxAffordable(state, itemId, cap = MAX_BULK, now = Date.now()) {
  let lo = 0;
  let hi = cap;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (costOf(state, itemId, mid, now) <= state.cookies) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
