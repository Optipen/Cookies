import { ITEMS } from "../data/items.js";
import { UPGRADES } from "../data/upgrades.js";

export const computePerItemMult = (items, upgrades) => {
  const mult = {};
  ITEMS.forEach((it) => (mult[it.id] = 1));

  for (const id in (upgrades || {})) {
    if (!upgrades[id]) continue;
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) continue;
    if (up.type === "mult") {
      if (up.target === "all") ITEMS.forEach((it) => (mult[it.id] *= up.value));
      else if (up.target in mult) mult[up.target] *= up.value;
    }
  }

  const g = (items.grandma || 0), f = (items.farm || 0), fac = (items.factory || 0);
  if (mult.cursor != null)  mult.cursor  *= 1 + 0.01  * g;
  if (mult.grandma != null) mult.grandma *= 1 + 0.005 * f;
  if (mult.farm != null)    mult.farm    *= 1 + 0.002 * fac;

  return mult;
};

export const cpsFrom = (items, upgrades, chips, stakeMulti = 1) => {
  const mult = computePerItemMult(items, upgrades);
  let cps = 0;
  for (const it of ITEMS) {
    cps += (items[it.id] || 0) * it.cps * (mult[it.id] || 1);
  }
  return cps * (1 + (chips || 0) * 0.02) * stakeMulti;
};


