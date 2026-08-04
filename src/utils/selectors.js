// === Valeurs dérivées ===
//
// Un seul endroit calcule la puissance de clic, le minage et les prix. Les
// noms internes gardent parfois « cpc » / « cps »; l'interface, elle, ne parle
// que de « puissance de clic » et de « minage ».

import { ITEMS, ITEM_BY_ID } from "../data/items.js";
import { getUpgrade, SHARE_BASE } from "../data/upgrades.js";
import { miningFrom, clickPowerFrom, computePerItemMult } from "./calc.js";
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

/** Multiplicateurs propres ciblant explicitement la puissance de clic. */
export function clickUpgradeMult(upgrades = {}) {
  let m = 1;
  for (const id in upgrades) {
    if (!upgrades[id]) continue;
    const up = getUpgrade(id);
    if (up && up.target === "click" && up.type === "mult") m *= up.value;
  }
  return m;
}

// === Combo ===
// Cliquer sans interruption fait monter un multiplicateur qui retombe vite.
// C'est ce qui récompense la présence du joueur.

export const COMBO = {
  max: 3,
  clicksToMax: 30,
  windowMs: 1400,
  decayPerSecond: 12,
};

export const comboMultiplier = (streak = 0) =>
  1 + (COMBO.max - 1) * Math.min(1, Math.max(0, streak) / COMBO.clicksToMax);

// === Reversement du minage vers le clic ===
//
// Filet de sécurité, à valeur fixe: même un joueur qui n'achèterait aucun
// Cliqueur garde un clic proportionnel à son empire. Ce n'est pas un axe de
// progression — le faire monter par améliorations faisait grimper le rapport
// actif/passif jusqu'à 8×.
export const shareOf = () => SHARE_BASE;

/**
 * Toutes les valeurs dérivées d'un état, en un seul passage.
 *
 * Formule complète:
 *   minage      = Σ(mineurs × valeur × palier) × (1 + 0,02·chips) × staking × céleste
 *   clicPropre  = (base + Σ(cliqueurs × valeur × palier)) × multiplicateurs × céleste
 *   parClic     = (clicPropre + minage × part) × combo × buff
 *
 * Les deux sommes sont linéaires et sans plafond: le millionième Cliqueur
 * ajoute exactement autant que le premier. L'équilibre entre les deux axes est
 * tenu par les prix, pas par un amortissement.
 */
export function deriveStats(state, now = Date.now(), comboStreak = 0) {
  const prestige = prestigeEffects(state);
  const positions = state.crypto?.positions || [];
  const stakeMult = stakingBoost(positions);

  const buffActive = (state.buffs?.until || 0) > now;
  const buffMine = buffActive ? state.buffs.cpsMulti || 1 : 1;
  const buffClick = buffActive ? state.buffs.cpcMulti || 1 : 1;

  const baseMining =
    miningFrom(state.items || {}, state.upgrades || {}, state.prestige?.chips || 0, stakeMult) * prestige.cpsMult;
  const mining = baseMining * buffMine;

  const earlyMult = isEarlyWindow(state, now) ? earlyCfg().click_base_mult || 1 : 1;
  const chips = state.prestige?.chips || 0;
  const buildingsPower = clickPowerFrom(state.items || {}, state.upgrades || {}, chips, stakeMult);
  const ownPower = (state.cpcBase || 1) + buildingsPower;
  const flatClick = ownPower * earlyMult * clickUpgradeMult(state.upgrades) * prestige.cpcMult;

  const share = shareOf();
  const sharedClick = baseMining * share;

  const combo = comboMultiplier(comboStreak);
  const perClickNoCombo = (flatClick + sharedClick) * buffClick;
  const perClick = perClickNoCombo * combo;

  return {
    // Noms « métier »
    mining,
    baseMining,
    perClick,
    perClickNoCombo,
    flatClick,
    sharedClick,
    ownPower,
    buildingsPower,
    share,
    combo,

    // Alias historiques, encore lus par quelques modules
    cps: mining,
    baseCps: baseMining,
    cpc: perClick,
    cpcBase: perClickNoCombo,

    stakeMult,
    prestige,
    buffActive,
    buffCps: buffMine,
    buffCpc: buffClick,
    perItemMult: computePerItemMult(state.items || {}, state.upgrades || {}),
    // Matériel d'extraction CRMB — sans rapport avec le minage de cookies
    crmbRate: miningRate(state.crypto?.miners) * prestige.cryptoMult,
    stakingYield: stakingYieldPerSecond(positions) * prestige.cryptoMult,
  };
}

/** Revenu par seconde d'un joueur actif, pour comparer au mode passif. */
export function activeIncome(state, clicksPerSecond = 7, now = Date.now()) {
  const stats = deriveStats(state, now, COMBO.clicksToMax);
  return stats.mining + stats.perClick * clicksPerSecond;
}

/**
 * Rapport entre jeu actif et jeu passif. Sert au diagnostic d'équilibrage.
 * `combo` par défaut: le combo moyen réellement tenu, pas son maximum.
 */
export function activeRatio(state, clicksPerSecond = 7, now = Date.now(), combo = 2.2) {
  const stats = deriveStats(state, now);
  if (stats.mining <= 0) return Infinity;
  return (stats.mining + stats.perClickNoCombo * combo * clicksPerSecond) / stats.mining;
}

// === Prix ===

const MAX_BULK = 1000;

/**
 * Prix de `count` exemplaires à partir de `owned` — somme géométrique exacte.
 *
 * Il n'y a plus de renchérissement par paliers: il compliquait la formule,
 * créait des murs de progression, et son application au lot entier rendait
 * l'achat groupé 15,8 fois moins cher que les achats unitaires.
 */
export function bulkCost(item, owned, count) {
  const n = Math.min(MAX_BULK, Math.max(0, Math.floor(count)));
  if (n === 0) return 0;
  const g = item.growth;
  const total = item.base * Math.pow(g, owned) * ((Math.pow(g, n) - 1) / (g - 1));
  return isFinite(total) ? total : Infinity;
}

/** Prix final d'un achat, remises comprises. Entier ≥ 1, sauf gratuité explicite. */
export function costOf(state, itemId, count = 1, now = Date.now()) {
  const item = ITEM_BY_ID[itemId];
  if (!item) return Infinity;

  const owned = state.items?.[itemId] || 0;
  let price = bulkCost(item, owned, count);
  if (!isFinite(price)) return Infinity;

  price *= prestigeEffects(state).costMult;

  const ecfg = earlyCfg();
  const early = isEarlyWindow(state, now);

  if (early && item.mode === "mine") {
    const ownedMiners = ITEMS.filter((x) => x.mode === "mine").reduce((a, x) => a + (state.items?.[x.id] || 0), 0);
    const candidateId = state.flags?.freeFirstAutoItemId || ITEMS.find((x) => x.mode === "mine")?.id;
    const freeFirst =
      ecfg.free_first_miner &&
      ownedMiners === 0 &&
      state.ui?.introSeen &&
      !state.flags?.freeFirstAutoGiven &&
      itemId === candidateId &&
      count === 1;
    if (freeFirst) return 0;
    price *= 1 - (ecfg.miner_discount || 0);
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

/** Temps estimé avant de pouvoir s'offrir `price`, en millisecondes. */
export function timeToAfford(state, price, stats, clicksPerSecond = 0) {
  const missing = price - (state.cookies || 0);
  if (missing <= 0) return 0;
  const income = stats.mining + stats.perClickNoCombo * clicksPerSecond;
  if (income <= 0) return Infinity;
  return (missing / income) * 1000;
}
