import { describe, it, expect } from "vitest";
import { COMBO, comboMultiplier, comboStep, comboProgress, deriveStats } from "../utils/selectors.js";
import { onGrid, snapDown } from "../utils/grid.js";
import { createFreshState, migrate } from "../utils/state.js";

// Le combo montait à ×3, ce qui écrasait tout le reste de l'économie: un joueur
// en rafale valait trois fois un joueur posé, avant même d'avoir acheté quoi que
// ce soit. Il est ramené à quatre crans, de ×1 à ×1,75.

describe("combo — quatre crans, de ×1 à ×1,75", () => {
  it("n'expose que les quatre valeurs autorisées", () => {
    const vues = new Set();
    for (let streak = 0; streak <= 500; streak++) vues.add(comboMultiplier(streak));
    expect([...vues].sort((a, b) => a - b)).toEqual([1, 1.25, 1.5, 1.75]);
  });

  it("suit exactement 1 + 0,25 × niveau, niveau entre 0 et 3", () => {
    for (let streak = 0; streak <= 500; streak++) {
      const niveau = comboStep(streak);
      expect(niveau).toBeGreaterThanOrEqual(0);
      expect(niveau).toBeLessThanOrEqual(3);
      expect(comboMultiplier(streak)).toBe(1 + 0.25 * niveau);
      expect(onGrid(comboMultiplier(streak))).toBe(true);
    }
  });

  it("ne peut produire aucune valeur intermédiaire", () => {
    for (const interdit of [1.33, 1.67, 1.74, 2, 2.25, 2.5, 3]) {
      for (let streak = 0; streak <= 500; streak++) {
        expect(comboMultiplier(streak)).not.toBe(interdit);
      }
    }
  });

  it("atteint son maximum entre 6 et 10 secondes à 5 clics/s", () => {
    const clicsPourMax = COMBO.steps * COMBO.clicksPerStep;
    const secondes = clicsPourMax / 5;
    expect(secondes).toBeGreaterThanOrEqual(6);
    expect(secondes).toBeLessThanOrEqual(10);
    expect(comboMultiplier(clicsPourMax)).toBe(1.75);
  });

  it("monte cran par cran, jamais d'un coup", () => {
    let precedent = 1;
    for (let streak = 0; streak <= COMBO.clicksToMax; streak++) {
      const m = comboMultiplier(streak);
      expect(m - precedent).toBeLessThanOrEqual(0.25 + 1e-9);
      expect(m).toBeGreaterThanOrEqual(precedent);
      precedent = m;
    }
  });

  it("rend une progression lisible vers le cran suivant", () => {
    expect(comboProgress(0)).toBe(0);
    expect(comboProgress(COMBO.clicksPerStep - 1)).toBeCloseTo((COMBO.clicksPerStep - 1) / COMBO.clicksPerStep, 6);
    expect(comboProgress(COMBO.clicksToMax)).toBe(1); // au maximum, la jauge est pleine
  });

  it("ignore les entrées aberrantes", () => {
    for (const mauvais of [-50, NaN, undefined, null, Infinity]) {
      expect(comboMultiplier(mauvais)).toBeGreaterThanOrEqual(1);
      expect(comboMultiplier(mauvais)).toBeLessThanOrEqual(1.75);
    }
  });
});

describe("combo — migration des anciennes sauvegardes", () => {
  it("ramène un meilleur combo hérité de l'échelle ×3 au nouveau maximum", () => {
    // `bestCombo` alimente un succès et les statistiques: laisser un 3 stocké
    // afficherait un record impossible à atteindre.
    for (const ancien of [2, 2.5, 3, 12]) {
      const s = migrate({ version: 5, stats: { bestCombo: ancien } });
      expect(s.stats.bestCombo).toBe(COMBO.max);
    }
    expect(migrate({ version: 5, stats: { bestCombo: 1.25 } }).stats.bestCombo).toBe(1.25);
    expect(migrate({ version: 5, stats: { bestCombo: NaN } }).stats.bestCombo).toBe(1);
  });
});

describe("combo — effet réel sur le gain", () => {
  it("multiplie le gain d'un clic exactement par le multiplicateur", () => {
    const s = createFreshState(0);
    s.ui.introSeen = true;
    s.items = { cursor: 12, oven: 20 };
    const sans = deriveStats(s, 6e5, 0);
    for (const streak of [0, COMBO.clicksPerStep, COMBO.clicksPerStep * 2, COMBO.clicksToMax]) {
      const avec = deriveStats(s, 6e5, streak);
      // grille × combo quitte la grille (2,5 × 1,75 = 4,375): le gain est le
      // produit REPLIÉ sur la grille, jamais en dessous du « sans combo ».
      expect(avec.perClick).toBe(snapDown(sans.perClickNoCombo * comboMultiplier(streak), sans.perClickNoCombo));
      expect(onGrid(avec.perClick), `parClic ${avec.perClick}`).toBe(true);
      expect(avec.perClick).toBeGreaterThanOrEqual(sans.perClickNoCombo);
      expect(avec.perClickNoCombo).toBe(sans.perClickNoCombo); // le combo ne touche pas la puissance
    }
  });
});
