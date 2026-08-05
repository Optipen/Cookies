// === La règle définitive des nombres — volet gains d'événements ===
//
// Cookies dorés, pluie de miettes, cookie croqué: chaque gain CRÉDITÉ est posé
// sur la règle des valeurs (quarts sous cent, entiers dès cent). Une miette à
// « ×2,5 le clic » sur un clic de 1,25 rendait 3,125 — un nombre qui n'existe
// pas dans ce jeu.

import { describe, expect, it } from "vitest";
import { gainChance, gainJackpot, gainMiette, gainCroque } from "../utils/gains.js";

const surLaRegle = (v) =>
  v < 100 ? Math.abs(v * 4 - Math.round(v * 4)) < 1e-9 : Number.isInteger(v);

describe("chaque gain d'événement tombe sur la règle", () => {
  it("la miette de pluie plie le produit clic × multiplicateur", () => {
    // cpc 1,25 × ×2,5 = 3,125 → 3 (le quart en dessous)
    expect(gainMiette({ cpc: 1.25, cps: 0 }, 2.5)).toBe(3);
    expect(surLaRegle(gainMiette({ cpc: 1.25, cps: 0 }, 2.5))).toBe(true);
    // et le plancher « deux secondes de minage » reste sur la règle aussi
    expect(gainMiette({ cpc: 0.25, cps: 60.25 }, 2)).toBe(120);
  });

  it("le doré « Chance » plie banque × 10 % comme production × 25 s", () => {
    for (const [cookies, cps, dr] of [
      [1_237, 0, 1],
      [99_999, 12.75, 0.5],
      [5, 3.25, 0.25],
      [1e9 + 0.5, 1_330.25, 0.1],
    ]) {
      const g = gainChance({ cookies }, { cps }, dr);
      expect(surLaRegle(g), `chance(${cookies}, ${cps}, ${dr}) = ${g}`).toBe(true);
      expect(g).toBeGreaterThanOrEqual(0);
    }
  });

  it("le jackpot plie clic × 60 × rendement décroissant", () => {
    for (const [cpc, dr] of [
      [1.25, 1],
      [2.5, 0.5],
      [1.25, 0.1],
      [401, 0.25],
    ]) {
      const g = gainJackpot({ cpc }, dr);
      expect(surLaRegle(g), `jackpot(${cpc}, ${dr}) = ${g}`).toBe(true);
    }
  });

  it("le cookie croqué plie le maximum des deux barèmes", () => {
    for (const [perClick, mining, count] of [
      [1.25, 2.25, 1],
      [2.5, 0, 5],
      [401, 1_330.25, 10],
      [0.25, 60.5, 4],
    ]) {
      const g = gainCroque({ perClick, mining }, count);
      expect(surLaRegle(g), `croque(${perClick}, ${mining}, ${count}) = ${g}`).toBe(true);
      expect(g).toBeGreaterThan(0);
    }
  });
});
