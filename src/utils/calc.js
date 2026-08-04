import { ITEMS } from "../data/items.js";
import { getUpgrade } from "../data/upgrades.js";
import { tierState, stepsReached, multOf } from "./grid.js";

/**
 * Multiplicateur propre à chaque bâtiment: améliorations de palier (×2).
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
 * Bonus des chips célestes, **par paliers**.
 *
 * Chaque chip ne donne plus « +2 % ». Les chips remplissent un palier de
 * l'échelle 1 · 2,5 · 5 · 10 · 25 …, et franchir un palier ajoute exactement
 * +0,25 au multiplicateur. C'est ce qui supprime les ×1,02 et ×2,06: entre
 * deux paliers le nombre ne bouge pas, une barre montre ce qu'il reste.
 */
export const chipTier = (chips = 0) => tierState(Math.max(0, chips || 0));
export const chipMult = (chips = 0) => chipTier(chips).mult;

/**
 * Bonus global: chips célestes, staking CRMB et arbre céleste **s'additionnent**.
 *
 * Chaque source apporte un nombre entier de crans de +0,25, et c'est la SOMME
 * des crans qui donne le multiplicateur — jamais le produit des multiplicateurs.
 * Multiplier ×2,25 par ×1,25 donnait ×2,8125, et un Curseur affichait alors
 * « +2,81 /clic ». En additionnant les crans on obtient ×2,75, et le Curseur
 * affiche « +2,75 ».
 *
 * Il s'applique au clic ET au minage. Quand il ne portait que le minage, chaque
 * prestige faisait décrocher le clic un peu plus — le rapport entre jeu actif et
 * jeu passif dérivait vers zéro au fil des renaissances.
 */
export const globalSteps = (chips = 0, stakeSteps = 0, treeSteps = 0) =>
  stepsReached(Math.max(0, chips || 0)) + Math.max(0, stakeSteps || 0) + Math.max(0, treeSteps || 0);

export const globalBonus = (chips = 0, stakeSteps = 0, treeSteps = 0) =>
  multOf(globalSteps(chips, stakeSteps, treeSteps));

/** Cookies produits chaque seconde par les Mineurs. */
export const miningFrom = (items = {}, upgrades = {}, chips = 0, stakeSteps = 0, treeSteps = 0) =>
  sumFamily(items, upgrades, "mine") * globalBonus(chips, stakeSteps, treeSteps);

/** Cookies ajoutés à chaque clic par les Cliqueurs. */
export const clickPowerFrom = (items = {}, upgrades = {}, chips = 0, stakeSteps = 0, treeSteps = 0) =>
  sumFamily(items, upgrades, "click") * globalBonus(chips, stakeSteps, treeSteps);

// Noms historiques, conservés pour les modules qui les importent encore.
export const cpsFrom = miningFrom;
