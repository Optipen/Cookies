import { ITEMS } from "../data/items.js";
import { getUpgrade } from "../data/upgrades.js";

/**
 * Multiplicateur propre à chaque bâtiment: améliorations achetées + synergies.
 */
export const computePerItemMult = (items = {}, upgrades = {}) => {
  const mult = {};
  for (const it of ITEMS) mult[it.id] = 1;

  for (const id in upgrades) {
    if (!upgrades[id]) continue;
    const up = getUpgrade(id);
    if (!up || up.type !== "mult") continue;
    if (up.target === "all") {
      for (const it of ITEMS) mult[it.id] *= up.value;
    } else if (up.target in mult) {
      mult[up.target] *= up.value;
    }
  }

  // Synergies croisées: un bâtiment renforce son voisin de gamme
  const grandma = items.grandma || 0;
  const farm = items.farm || 0;
  const factory = items.factory || 0;
  if (mult.cursor != null) mult.cursor *= 1 + 0.01 * grandma;
  if (mult.grandma != null) mult.grandma *= 1 + 0.005 * farm;
  if (mult.farm != null) mult.farm *= 1 + 0.002 * factory;

  return mult;
};

/** Production automatique, en cookies par seconde. */
export const cpsFrom = (items = {}, upgrades = {}, chips = 0, stakeMulti = 1) => {
  const mult = computePerItemMult(items, upgrades);
  let cps = 0;
  for (const it of ITEMS) {
    if (it.mode === "cps") cps += (items[it.id] || 0) * it.cps * (mult[it.id] || 1);
  }
  return cps * (1 + (chips || 0) * 0.02) * stakeMulti;
};

/**
 * Poids brut des bâtiments de clic.
 *
 * Ce nombre ne sert pas directement de multiplicateur: il alimente la « part de
 * production par clic » (voir `selectors.js`), qui sature vers un plafond que
 * les améliorations relèvent sans fin.
 *
 * L'ancienne formule appliquait un softcap rationnel `1 + s·K/(s+K)` dont
 * l'asymptote valait K+1 = 13. Le multiplicateur atteignait ×11,8 avec un seul
 * exemplaire de chaque bâtiment puis ne bougeait plus jamais: passé les sept
 * premiers achats, investir dans le clic ne servait plus à rien, et la
 * production automatique — elle, illimitée — écrasait le clic en dix minutes.
 */
export const clickWeightFrom = (items = {}, upgrades = {}) => {
  const mult = computePerItemMult(items, upgrades);
  let weight = 0;
  for (const it of ITEMS) {
    if (it.mode === "mult") weight += (items[it.id] || 0) * (it.mult || 0) * (mult[it.id] || 1);
  }
  return weight;
};
