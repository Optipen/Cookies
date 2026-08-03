// === Valeurs dérivées ===
// Un seul endroit calcule CPS, CPC et coûts. Avant, la même formule était
// dupliquée dans le composant, les hooks et le moteur de missions, avec des
// résultats qui divergeaient (le bandeau d'achat n'affichait pas le vrai gain).

import { ITEMS } from "../data/items.js";
import { UPGRADES } from "../data/upgrades.js";
import { cpsFrom, computePerItemMult, clickMultiplierFrom } from "./calc.js";
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
    const up = UPGRADES.find((u) => u.id === id);
    if (up && up.target === "cpc" && up.type === "mult") m *= up.value;
  }
  return m;
}

/**
 * Toutes les stats dérivées d'un état, en un seul passage.
 * `now` est injectable pour que les tests ne dépendent pas de l'horloge.
 */
export function deriveStats(state, now = Date.now()) {
  const prestige = prestigeEffects(state);
  const positions = state.crypto?.positions || [];
  const stakeMult = stakingBoost(positions);

  const buffActive = (state.buffs?.until || 0) > now;
  const buffCps = buffActive ? state.buffs.cpsMulti || 1 : 1;
  const buffCpc = buffActive ? state.buffs.cpcMulti || 1 : 1;

  const baseCps = cpsFrom(state.items || {}, state.upgrades || {}, state.prestige?.chips || 0, stakeMult) * prestige.cpsMult;
  const cps = baseCps * buffCps;

  const clickMult = clickMultiplierFrom(state.items || {}, state.upgrades || {});
  const earlyMult = isEarlyWindow(state, now) ? earlyCfg().cpc_base_mult || 1 : 1;
  const cpc =
    (state.cpcBase || 1) * earlyMult * clickMult * cpcUpgradeMult(state.upgrades) * prestige.cpcMult * buffCpc;

  return {
    cps,
    baseCps,
    cpc,
    clickMult,
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

// === Coûts ===

/** Renchérissement par paliers de possession — récompense visible des gros achats. */
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

/** Somme géométrique du prix de `count` exemplaires à partir de `owned`. */
export function bulkCost(item, owned, count) {
  const g = item.growth;
  const series = (Math.pow(g, count) - 1) / (g - 1);
  return item.base * Math.pow(g, owned) * series * milestoneFactor(owned);
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

  // Réduction permanente de l'arbre céleste
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

  // Premier curseur offert pendant le tutoriel
  if (!state.ui?.introSeen && itemId === "cursor" && owned === 0 && count === 1) return 0;

  // Remise globale temporaire (récompense de quête)
  const discount = state.flags?.discountAll;
  if (discount && now < discount.until) price *= 1 - (discount.value || 0);

  // Vente flash sur un bâtiment précis
  const flash = state.flags?.flash;
  if (flash && flash.itemId === itemId && now < flash.until) price *= 1 - flash.discount;

  return Math.max(1, Math.ceil(price));
}

/** Quantité d'achat selon les modificateurs clavier. */
export const buyQuantity = (event) => (event?.shiftKey ? 10 : event?.ctrlKey || event?.metaKey ? 100 : 1);

/** Nombre maximal d'exemplaires achetables avec la banque actuelle (borné). */
export function maxAffordable(state, itemId, cap = 1000, now = Date.now()) {
  let lo = 0;
  let hi = cap;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (costOf(state, itemId, mid, now) <= state.cookies) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
