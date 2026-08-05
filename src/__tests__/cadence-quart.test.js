// === La règle définitive des nombres — volet cadence ===
//
// La cadence est mesurée précisément en interne, mais elle S'AFFICHE arrondie
// au quart et préfixée de « ≈ »: ≈4 · ≈4,25 · ≈4,50 · ≈4,75 · ≈5. Jamais
// ≈4,12 ni ≈4,99. Elle ne compte que les clics réellement CRÉDITÉS.
//
// La production estimée des clics est calculée À PARTIR de cette cadence
// affichée — le joueur peut refaire le calcul de tête — puis posée sur la
// règle des valeurs, et porte le même « ≈ » puisqu'elle en découle.

import { describe, expect, it } from "vitest";
import { productionStats, deriveStats } from "../utils/selectors.js";
import { createFreshState } from "../utils/state.js";
import { CREDIT_MAX_CPS } from "../utils/rate.js";

const stats = (patch = {}) => {
  const s = createFreshState(0);
  Object.assign(s, patch);
  return deriveStats(s, 0, 0);
};

const surLaRegle = (v) =>
  v < 100 ? Math.abs(v * 4 - Math.round(v * 4)) < 1e-9 : Number.isInteger(v);

describe("la cadence affichée est un quart", () => {
  it("arrondit la mesure au quart le plus proche", () => {
    const d = stats();
    expect(productionStats(d, 4.12).cadenceAffichee).toBe(4);
    expect(productionStats(d, 4.13).cadenceAffichee).toBe(4.25);
    expect(productionStats(d, 4.27).cadenceAffichee).toBe(4.25);
    expect(productionStats(d, 4.4).cadenceAffichee).toBe(4.5);
    expect(productionStats(d, 4.63).cadenceAffichee).toBe(4.75);
    expect(productionStats(d, 4.99).cadenceAffichee).toBe(5);
    expect(productionStats(d, 3).cadenceAffichee).toBe(3);
  });

  it("ne compte que les clics crédités: au-delà de la borne, elle affiche la borne", () => {
    const d = stats();
    expect(productionStats(d, 50).cadenceAffichee).toBe(CREDIT_MAX_CPS);
    expect(productionStats(d, 20).cadenceAffichee).toBe(CREDIT_MAX_CPS);
    expect(productionStats(d, 50).bornee).toBe(true);
    expect(productionStats(d, 14).bornee).toBe(false);
  });

  it("s'éteint sans clic, et ne montre jamais zéro pendant qu'on clique", () => {
    const d = stats();
    expect(productionStats(d, 0).cadenceAffichee).toBe(0);
    expect(productionStats(d, 0).actif).toBe(false);
    expect(productionStats(d, 0.1).cadenceAffichee).toBe(0.25);
    expect(productionStats(d, 0.1).actif).toBe(true);
  });

  it("tout affichage possible est un multiple de 0,25", () => {
    const d = stats();
    for (let brut = 0.05; brut < 60; brut += 0.173) {
      const c = productionStats(d, brut).cadenceAffichee;
      expect(Math.abs(c * 4 - Math.round(c * 4)), `${brut} → ${c}`).toBeLessThan(1e-9);
    }
  });
});

describe("la production des clics découle de la cadence affichée", () => {
  it("vaut le produit « par clic × cadence affichée », posé sur la règle", () => {
    const d = stats({ items: { cursor: 1 } }); // par clic 1,25
    const c = productionStats(d, 4.3); // cadence affichée 4,25
    expect(c.cadenceAffichee).toBe(4.25);
    // 1,25 × 4,25 = 5,3125 → plié au quart: 5,25. Le joueur qui refait le
    // calcul tombe à un quart près, et le « ≈ » couvre exactement cet écart.
    expect(c.prodClics).toBe(5.25);
    expect(surLaRegle(c.prodClics)).toBe(true);
  });

  it("reste sur la règle des valeurs à toutes les échelles", () => {
    const gros = stats({ items: { cursor: 2000, grandma: 500 } });
    for (const brut of [0.4, 1, 3.7, 5.2, 8.9, 12.4, 15, 50]) {
      const c = productionStats(gros, brut);
      expect(surLaRegle(c.prodClics), `cadence ${brut} → ${c.prodClics}`).toBe(true);
      expect(surLaRegle(c.total), `cadence ${brut} → total ${c.total}`).toBe(true);
    }
  });

  it("au repos, le total vaut le minage EXACTEMENT", () => {
    const d = stats({ items: { oven: 7, bakery: 2 } });
    const c = productionStats(d, 0);
    expect(c.prodClics).toBe(0);
    expect(c.total).toBe(d.mining);
  });

  it("le produit affichable se recalcule de tête depuis les deux nombres montrés", () => {
    // L'écart entre « par clic × cadence » et la production affichée est
    // toujours strictement inférieur à un cran de la règle: le calcul mental
    // tombe sur le nombre affiché, à un pli près.
    const d = stats({ items: { cursor: 3, grandma: 1 } });
    for (const brut of [2.1, 3.8, 4.6, 7.3, 11.9]) {
      const c = productionStats(d, brut);
      const attendu = c.parClic * c.cadenceAffichee;
      const cran = attendu < 100 ? 0.25 : 1;
      expect(Math.abs(attendu - c.prodClics), `${c.parClic} × ${c.cadenceAffichee}`).toBeLessThan(cran + 1e-9);
    }
  });
});
