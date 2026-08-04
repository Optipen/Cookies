import { ITEMS } from "../data/items.js";
import { getUpgrade } from "../data/upgrades.js";

/**
 * Multiplicateur propre à chaque bâtiment: améliorations de palier (×2, ×3, ×5)
 * et synergies entre familles.
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

  return mult;
};

/**
 * Somme additive d'une famille de bâtiments.
 *
 * Linéaire et sans plafond: chaque exemplaire ajoute exactement sa valeur,
 * multipliée par les paliers achetés sur ce bâtiment. Aucune courbe
 * d'amortissement n'intervient ici — l'équilibre passe par les prix.
 */
const sumFamily = (items, upgrades, mode) => {
  const mult = computePerItemMult(items, upgrades);
  let total = 0;
  for (const it of ITEMS) {
    if (it.mode !== mode) continue;
    total += (items[it.id] || 0) * it.value * (mult[it.id] || 1);
  }
  return total;
};

/**
 * Bonus commun aux deux familles: chips célestes et staking CRMB.
 *
 * Il s'applique au clic ET au minage. Quand il ne portait que le minage, chaque
 * prestige faisait décrocher le clic un peu plus — le rapport entre jeu actif et
 * jeu passif dérivait vers zéro au fil des renaissances.
 */
export const globalBonus = (chips = 0, stakeMulti = 1) => (1 + (chips || 0) * 0.02) * stakeMulti;

/** Cookies produits chaque seconde par les Mineurs. */
export const miningFrom = (items = {}, upgrades = {}, chips = 0, stakeMulti = 1) =>
  sumFamily(items, upgrades, "mine") * globalBonus(chips, stakeMulti);

/** Cookies ajoutés à chaque clic par les Cliqueurs. */
export const clickPowerFrom = (items = {}, upgrades = {}, chips = 0, stakeMulti = 1) =>
  sumFamily(items, upgrades, "click") * globalBonus(chips, stakeMulti);

// Noms historiques, conservés pour les modules qui les importent encore.
export const cpsFrom = miningFrom;
