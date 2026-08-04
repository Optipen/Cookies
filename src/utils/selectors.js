// === Valeurs dérivées ===
//
// Un seul endroit calcule la puissance de clic, le minage et les prix. Les
// noms internes gardent parfois « cpc » / « cps »; l'interface, elle, ne parle
// que de « puissance de clic » et de « minage ».

import { ITEMS, ITEM_BY_ID, BALANCE } from "../data/items.js";
import { getUpgrade, SHARE_BASE } from "../data/upgrades.js";
import { miningFrom, clickPowerFrom, computePerItemMult, globalBonus } from "./calc.js";
import { prestigeEffects } from "../data/prestige.js";
import { stakingTier, miningRate, stakingYieldPerSecond } from "./crypto.js";
import { chipTier } from "./calc.js";
import { multOf, lisible } from "./grid.js";
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

// Le combo monte par crans de +0,25, pas en glissant. Un multiplicateur qui
// affichait ×2,07 puis ×2,13 ne se lisait pas; huit crans nets se lisent d'un
// coup d'œil et se ressentent — chaque palier est un petit événement.
export const COMBO = {
  max: 3,
  steps: 8, // ×1 → ×3 par pas de 0,25
  clicksPerStep: 4,
  clicksToMax: 32,
  windowMs: 1400,
  decayPerSecond: 12,
};

export const comboStep = (streak = 0) =>
  Math.min(COMBO.steps, Math.floor(Math.max(0, streak) / COMBO.clicksPerStep));

export const comboMultiplier = (streak = 0) => multOf(comboStep(streak));

/** Avancement vers le cran suivant, pour la jauge. */
export const comboProgress = (streak = 0) => {
  const s = comboStep(streak);
  if (s >= COMBO.steps) return 1;
  return (Math.max(0, streak) - s * COMBO.clicksPerStep) / COMBO.clicksPerStep;
};

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
 *   crans       = paliers(chips) + paliers(staking) + niveaux(arbre)
 *   global      = 1 + 0,25 × crans          ← un multiple de 0,25, toujours
 *   minage      = Σ(mineurs   × valeur × palier) × global
 *   clicPropre  = (1 + Σ(cliqueurs × valeur × palier) × global)
 *   parClic     = (clicPropre + minage × part) × combo × buff
 *
 * Les sources de bonus **additionnent leurs crans** au lieu de multiplier leurs
 * multiplicateurs: ×2,25 × ×1,25 valait ×2,8125 et un Curseur annonçait alors
 * « +2,81 /clic ». En sommant les crans on obtient ×2,75, et il annonce
 * « +2,75 ». C'est la même idée que la grille, appliquée à la composition.
 *
 * Les deux sommes sont linéaires et sans plafond: le millionième Cliqueur
 * ajoute exactement autant que le premier. L'équilibre entre les deux axes est
 * tenu par les prix, pas par un amortissement.
 */
export function deriveStats(state, now = Date.now(), comboStreak = 0) {
  const prestige = prestigeEffects(state);
  const positions = state.crypto?.positions || [];
  const stakeTier = stakingTier(positions);
  const stakeMult = stakeTier.mult;
  const chipTierState = chipTier(state.prestige?.chips || 0);

  const buffActive = (state.buffs?.until || 0) > now;
  const buffMine = buffActive ? state.buffs.cpsMulti || 1 : 1;
  const buffClick = buffActive ? state.buffs.cpcMulti || 1 : 1;

  // Un seul multiplicateur global par axe, obtenu en additionnant les crans de
  // toutes les sources. C'est cette addition qui garde les gains lisibles.
  const chips = state.prestige?.chips || 0;
  const items = state.items || {};
  const upgrades = state.upgrades || {};

  const baseMining = miningFrom(items, upgrades, chips, stakeTier.steps, prestige.mineSteps);
  const mining = baseMining * buffMine;

  const earlyMult = isEarlyWindow(state, now) ? earlyCfg().click_base_mult || 1 : 1;
  const buildingsPower = clickPowerFrom(items, upgrades, chips, stakeTier.steps, prestige.clickSteps);
  const ownPower = (state.cpcBase || 1) + buildingsPower;
  const flatClick = ownPower * earlyMult * clickUpgradeMult(upgrades);

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
    // Paliers en cours, pour les barres de progression: le multiplicateur ne
    // bouge pas entre deux crans, mais on voit le suivant approcher.
    chipTier: chipTierState,
    stakeTier,
    // Multiplicateur global effectif de chaque axe, tel qu'on peut l'annoncer.
    mineMult: globalBonus(chips, stakeTier.steps, prestige.mineSteps),
    clickMult: globalBonus(chips, stakeTier.steps, prestige.clickSteps),
    prestige,
    buffActive,
    buffCps: buffMine,
    buffCpc: buffClick,
    perItemMult: computePerItemMult(items, upgrades),
    // Matériel d'extraction CRMB — sans rapport avec le minage de cookies
    crmbRate: miningRate(state.crypto?.miners) * prestige.cryptoMult,
    stakingYield: stakingYieldPerSecond(positions) * prestige.cryptoMult,
  };
}

// Référence de calibration: le joueur actif « normal ». Cinq clics par seconde
// est ce qu'on tient réellement au pouce sur mobile — sept était une cadence de
// souris soutenue, irréaliste comme moyenne. Le combo de référence est celui
// qu'on tient en moyenne, pas son maximum.
export const REF_CLICKS_PER_SECOND = BALANCE.reference_clicks_per_second ?? 5;
export const REF_COMBO = BALANCE.reference_combo ?? 2.2;

/**
 * Revenu par seconde d'un joueur actif, pour comparer au mode passif.
 *
 * Même définition que `activeRatio`: combo MOYEN, pas combo maximum. Les deux
 * fonctions décrivaient auparavant deux joueurs différents — l'une supposait un
 * combo plein en permanence, l'autre la moyenne réellement tenue.
 */
export function activeIncome(state, clicksPerSecond = REF_CLICKS_PER_SECOND, now = Date.now(), combo = REF_COMBO) {
  const stats = deriveStats(state, now);
  return stats.mining + stats.perClickNoCombo * combo * clicksPerSecond;
}

/**
 * Rapport entre jeu actif et jeu passif. Sert au diagnostic d'équilibrage.
 * `combo` par défaut: le combo moyen réellement tenu, pas son maximum.
 */
export function activeRatio(state, clicksPerSecond = REF_CLICKS_PER_SECOND, now = Date.now(), combo = REF_COMBO) {
  const stats = deriveStats(state, now);
  if (stats.mining <= 0) return Infinity;
  return (stats.mining + stats.perClickNoCombo * combo * clicksPerSecond) / stats.mining;
}

// === Prix ===

const MAX_BULK = 1000;

/**
 * Prix du n-ième exemplaire, arrondi à deux chiffres significatifs.
 *
 * `base × 1,22^n` donne 149, 182, 222, 271, 330… Ces nombres sont exacts mais
 * illisibles; à deux chiffres significatifs ils deviennent 150, 180, 220, 270,
 * 330 tout en restant strictement croissants — le prix ne doit jamais stagner
 * d'un exemplaire au suivant, sinon on en achète deux au même tarif.
 */
export const unitPrice = (item, index) => lisible(item.base * Math.pow(item.growth, index));

/**
 * Prix de `count` exemplaires à partir de `owned`.
 *
 * La somme est calculée exemplaire par exemplaire, sur les prix ARRONDIS: un
 * achat groupé coûte donc exactement ce que coûteraient les achats un par un.
 * La formule fermée d'une suite géométrique ne le garantissait plus une fois
 * les prix arrondis.
 *
 * Il n'y a pas de renchérissement par paliers: il compliquait la formule,
 * créait des murs de progression, et son application au lot entier rendait
 * l'achat groupé 15,8 fois moins cher que les achats unitaires.
 */
export function bulkCost(item, owned, count) {
  const n = Math.min(MAX_BULK, Math.max(0, Math.floor(count)));
  if (n === 0) return 0;
  let total = 0;
  for (let k = 0; k < n; k++) {
    total += unitPrice(item, owned + k);
    if (!isFinite(total)) return Infinity;
  }
  return total;
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
