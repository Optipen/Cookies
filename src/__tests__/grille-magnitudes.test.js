// === La règle définitive des nombres — volet grille ===
//
// Sous cent, seuls les quarts existent: 0 · 0,25 · 0,50 · … · 99,75.
// À partir de cent, seuls les entiers existent: 100 · 125 · 402 · 1 910…
// Les multiplicateurs, eux, restent en pas de 0,25 à toute magnitude.
// Le CRMB est l'exception assumée, au centième — traité dans son propre volet.
//
// La valeur CRÉDITÉE respecte la règle, pas seulement l'affichage: c'est
// `snapDown` — le pli appliqué par le moteur — qui la porte.

import { describe, expect, it } from "vitest";
import { snapDown, snap, onGrid } from "../utils/grid.js";
import { unitValue } from "../utils/calc.js";
import { deriveStats } from "../utils/selectors.js";
import { createFreshState } from "../utils/state.js";
import { ITEMS, ITEM_BY_ID } from "../data/items.js";

const surLaRegle = (v) =>
  v < 100 ? Math.abs(v * 4 - Math.round(v * 4)) < 1e-9 : Number.isInteger(v);

describe("snapDown pose toute valeur sur la règle: quarts sous 100, entiers dès 100", () => {
  it("plie au quart sous cent", () => {
    expect(snapDown(0.31)).toBe(0.25);
    expect(snapDown(1.08)).toBe(1);
    expect(snapDown(2.24)).toBe(2);
    expect(snapDown(20.1)).toBe(20);
    expect(snapDown(99.99)).toBe(99.75);
    expect(snapDown(99.75)).toBe(99.75);
  });

  it("plie à l'entier dès cent", () => {
    expect(snapDown(100)).toBe(100);
    expect(snapDown(100.25)).toBe(100);
    expect(snapDown(125.5)).toBe(125);
    expect(snapDown(401.7)).toBe(401);
    expect(snapDown(1910.75)).toBe(1910);
    expect(snapDown(20_100.25)).toBe(20_100);
    expect(snapDown(1_910_000.9)).toBe(1_910_000);
  });

  it("ne franchit jamais la frontière des cent par le mauvais côté", () => {
    // 100,2 plié au quart donnerait 100... déjà entier; 99,9 doit rendre 99,75
    expect(snapDown(99.9)).toBe(99.75);
    expect(snapDown(100.0)).toBe(100);
    // Balayage: le plié est toujours ≤ la valeur, toujours sur la règle,
    // et la fonction est croissante.
    let precedent = 0;
    for (let v = 0; v < 400; v += 0.077) {
      const p = snapDown(v);
      expect(p).toBeLessThanOrEqual(v + 1e-9);
      expect(surLaRegle(p)).toBe(true);
      expect(p + 1e-9).toBeGreaterThanOrEqual(precedent);
      precedent = p;
    }
  });

  it("respecte le plancher sans quitter la règle", () => {
    expect(snapDown(0.3, 0.25)).toBe(0.25);
    expect(snapDown(0.1, 0.25)).toBe(0.25);
    expect(snapDown(NaN, 2)).toBe(2);
  });

  it("laisse `snap` en pas de 0,25 à toute magnitude — les multiplicateurs", () => {
    // ×101,25 est un multiplicateur légal: la règle des entiers ne s'applique
    // qu'aux valeurs de gameplay, pas aux pas de 0,25 des multiplicateurs.
    expect(snap(101.25)).toBe(101.25);
    expect(onGrid(101.25)).toBe(true);
  });
});

describe("le moteur crédite des valeurs sur la règle", () => {
  it("garde chaque valeur unitaire de bâtiment sur la règle, bonus compris", () => {
    for (const item of ITEMS) {
      for (const perItem of [1, 2, 4, 8]) {
        for (const global of [1, 1.25, 1.5, 2.75, 13.5, 101.25]) {
          const v = unitValue(item, perItem, global);
          expect(surLaRegle(v), `${item.id} ×${perItem} global ${global} → ${v}`).toBe(true);
          expect(v).toBeGreaterThanOrEqual(item.value);
        }
      }
    }
  });

  it("rend un minage et une puissance de clic sur la règle, même au-delà de cent", () => {
    const s = createFreshState(0);
    // Un parc qui pousse les valeurs au-delà de cent avec des quarts en jeu
    s.items = { cursor: 500, grandma: 30, oven: 60, bakery: 12 };
    s.prestige = { chips: 30, spent: 0, upgrades: {} };
    const stats = deriveStats(s, 0, 0);
    expect(surLaRegle(stats.mining), `minage ${stats.mining}`).toBe(true);
    expect(surLaRegle(stats.perClickNoCombo), `puissance ${stats.perClickNoCombo}`).toBe(true);
    expect(surLaRegle(stats.perClick), `par clic ${stats.perClick}`).toBe(true);
    expect(stats.mining).toBeGreaterThan(100); // le test doit couvrir la zone entière
    expect(stats.perClickNoCombo).toBeGreaterThan(100);
  });

  it("l'exemple du README devient un entier: plus de 401,75 par clic", () => {
    // 401,75 était l'exemple canonique de l'ancienne règle. Sous la nouvelle,
    // une puissance au-delà de cent est un entier.
    const s = createFreshState(0);
    s.items = { cursor: 1603 }; // 1 + 1603×0,25 = 401,75 sous l'ancienne règle
    const stats = deriveStats(s, 0, 0);
    expect(Number.isInteger(stats.perClickNoCombo)).toBe(true);
    expect(stats.perClickNoCombo).toBe(401);
  });

  it("le Curseur garde son quart sous cent — la règle n'écrase pas les petits nombres", () => {
    const s = createFreshState(0);
    s.items = { cursor: 1 };
    const stats = deriveStats(s, 0, 0);
    expect(stats.perClickNoCombo).toBe(1.25);
    expect(ITEM_BY_ID.cursor.value).toBe(0.25);
  });
});
