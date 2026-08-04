import { describe, it, expect } from "vitest";
import { STEP, snap, snapDown, onGrid, multOf, lisible, niceIntAt, stepsReached, tierState } from "../utils/grid.js";
import { globalBonus, unitValue, chipMult } from "../utils/calc.js";
import { deriveStats } from "../utils/selectors.js";
import { comboMultiplier, COMBO } from "../utils/combo.js";
import { fmt, fmtMult } from "../utils/format.js";
import { createFreshState } from "../utils/state.js";
import { ITEMS } from "../data/items.js";
import { PRESTIGE_UPGRADES, prestigeEffects } from "../data/prestige.js";
import { STAKE_TIERS, MINERS } from "../utils/crypto.js";
import tuning from "../data/tuning.json";

// La règle: tout multiplicateur de gameplay VISIBLE est un multiple de 0,25.
// Pas « arrondi à 0,25 à l'écran » — réellement sur la grille, pour que le
// nombre affiché soit le nombre calculé.
//
// Les valeurs nommément interdites par le cahier des charges: ×1,02, ×1,08,
// ×2,08, ×2,81, +0,31, +0,37, +0,63.

const INTERDITS = [1.02, 1.08, 2.08, 2.81, 0.31, 0.37, 0.63];
const LATER = 6e5;

describe("aucun multiplicateur visible ne sort de la grille", () => {
  it("interdit les valeurs nommées, quelle que soit la source", () => {
    const vus = new Set();
    for (let chips = 0; chips <= 5000; chips += 7) vus.add(chipMult(chips));
    for (let crans = 0; crans <= 120; crans++) vus.add(multOf(crans));
    for (let streak = 0; streak <= 500; streak++) vus.add(comboMultiplier(streak));
    for (let a = 0; a <= 20; a++) for (let b = 0; b <= 20; b++) vus.add(globalBonus(0, a, b));

    for (const v of vus) {
      expect(onGrid(v), `×${v} hors grille`).toBe(true);
      for (const mauvais of INTERDITS) {
        expect(Math.abs(v - mauvais), `×${v} est une valeur interdite`).toBeGreaterThan(1e-9);
      }
    }
  });

  it("compose les sources en ADDITIONNANT leurs crans", () => {
    // Multiplier ×2,25 par ×1,25 donne ×2,8125 — hors grille, et un Curseur
    // annonçait « +2,81 /clic ». En sommant les crans on obtient ×2,75.
    expect(globalBonus(0, 5, 1)).toBe(multOf(6));
    expect(globalBonus(0, 5, 1)).not.toBeCloseTo(multOf(5) * multOf(1), 9);
    for (let a = 0; a <= 30; a++) {
      for (let b = 0; b <= 30; b++) {
        expect(onGrid(globalBonus(0, a, b))).toBe(true);
      }
    }
  });

  it("garde chaque gain unitaire sur la grille, pour tout bâtiment et tout bonus", () => {
    for (let crans = 0; crans <= 60; crans++) {
      const g = globalBonus(0, crans, 0);
      for (const item of ITEMS) {
        for (const palier of [1, 2, 4, 8, 16, 32]) {
          const v = unitValue(item, palier, g);
          expect(onGrid(v), `${item.name} ×${palier} à ×${g} → ${v}`).toBe(true);
          expect(v).toBeGreaterThanOrEqual(item.value);
        }
      }
    }
  });

  it("n'affiche jamais un multiplicateur avec une décimale inventée", () => {
    for (let crans = 0; crans <= 200; crans++) {
      const texte = fmtMult(multOf(crans));
      // Soit un entier nu, soit exactement deux décimales parmi ,25 ,50 ,75
      expect(texte, `×${texte}`).toMatch(/^\d+$|^\d+,(25|50|75)$/);
    }
  });
});

describe("les valeurs configurées sont réellement sur la grille", () => {
  it("place chaque valeur de bâtiment sur la grille", () => {
    for (const item of ITEMS) {
      expect(onGrid(item.value), `${item.name} = ${item.value}`).toBe(true);
      expect(item.value).toBeGreaterThan(0);
    }
  });

  it("fait avancer chaque nœud de l'arbre céleste par crans propres", () => {
    for (const noeud of PRESTIGE_UPGRADES) {
      const par = noeud.effect.perLevel;
      // Un cran de grille, ou un pourcentage rond (5 %, 25 %) pour les nœuds
      // qui ne produisent pas un multiplicateur affiché.
      const propre = Math.abs(par - STEP) < 1e-9 || Math.abs(par * 100 - Math.round(par * 100)) < 1e-9;
      expect(propre, `${noeud.name}: ${par}`).toBe(true);
    }
  });

  it("rend des multiplicateurs d'arbre sur la grille à tous les niveaux", () => {
    for (const n of [0, 1, 3, 7, 25, 100, 1000]) {
      const e = prestigeEffects({ prestige: { upgrades: { celestial_dough: n, golden_fingers: n } } });
      expect(onGrid(e.cpsMult), `niveau ${n}`).toBe(true);
      expect(onGrid(e.cpcMult), `niveau ${n}`).toBe(true);
    }
  });

  it("garde les réglages de tuning.json sur des nombres ronds", () => {
    const b = tuning.standard.balance;
    for (const [cle, v] of Object.entries(b)) {
      // Deux décimales au plus: un réglage à 0,0725 ne se raconte pas.
      expect(Math.abs(v * 100 - Math.round(v * 100)), `${cle} = ${v}`).toBeLessThan(1e-9);
    }
  });

  it("n'a aucune clé morte dans le bloc balance", () => {
    // Chaque réglage doit être lu quelque part. Une clé oubliée fait croire à
    // un levier qui ne fait rien.
    const attendues = [
      "click_price_factor",
      "click_share",
      "price_growth",
      "reference_clicks_per_second",
      "reference_combo",
      "price_scale",
      "tier_first",
    ];
    expect(Object.keys(tuning.standard.balance).sort()).toEqual([...attendues].sort());
  });
});

describe("les rendements crypto restent des nombres ronds", () => {
  it("donne des taux lisibles", () => {
    for (const t of STAKE_TIERS) {
      expect(Math.abs(t.perDay * 1000 - Math.round(t.perDay * 1000)), `${t.id}`).toBeLessThan(1e-9);
      expect(onGrid(t.boostMult), `${t.id} boost`).toBe(true);
    }
    for (const m of MINERS) {
      expect(Math.abs(m.perHour * 100 - Math.round(m.perHour * 100)), `${m.id}`).toBeLessThan(1e-9);
    }
  });
});

describe("outils de grille", () => {
  it("arrondit vers le bas sans jamais passer sous le plancher", () => {
    expect(snapDown(0.6249, 0.25)).toBe(0.5);
    expect(snapDown(0.1, 0.25)).toBe(0.25);
    expect(snapDown(NaN, 0.25)).toBe(0.25);
    expect(snapDown(-5, 0)).toBe(0);
  });

  it("garde snap et onGrid cohérents", () => {
    for (let k = -40; k <= 400; k++) {
      const v = snap(k * STEP);
      expect(onGrid(v)).toBe(true);
    }
    expect(onGrid(0.3)).toBe(false);
    expect(onGrid(1.02)).toBe(false);
  });

  it("rend une échelle 1 · 2,5 · 5 · 10 strictement croissante", () => {
    let precedent = 0;
    for (let i = 0; i < 40; i++) {
      const v = niceIntAt(i);
      expect(v).toBeGreaterThanOrEqual(precedent);
      precedent = v;
    }
    expect(stepsReached(0)).toBe(0);
    expect(tierState(0).mult).toBe(1);
  });

  it("rend un prix lisible à deux chiffres significatifs", () => {
    expect(lisible(1487)).toBe(1500);
    expect(lisible(9)).toBe(9);
    expect(lisible(0)).toBe(0);
    expect(lisible(-5)).toBe(0);
  });
});

describe("les cinq chiffres de l'écran restent propres", () => {
  it("affiche des gains de bâtiment sans décimale inventée", () => {
    const base = createFreshState(0);
    base.ui.introSeen = true;
    base.items = { cursor: 4, oven: 4 };
    base.prestige = { chips: 10, spent: 0, upgrades: { celestial_dough: 3, golden_fingers: 3 } };

    for (const item of ITEMS) {
      const avant = deriveStats(base, LATER, 0);
      const apres = deriveStats({ ...base, items: { ...base.items, [item.id]: (base.items[item.id] || 0) + 1 } }, LATER, 0);
      const gain = item.mode === "click" ? apres.perClickNoCombo - avant.perClickNoCombo : apres.mining - avant.mining;
      expect(onGrid(gain), `${item.name} → +${gain}`).toBe(true);
      for (const mauvais of INTERDITS) {
        expect(Math.abs(gain - mauvais), `${item.name} → +${gain}`).toBeGreaterThan(1e-9);
      }
      // Et ce qui s'affiche se relit à l'identique.
      if (gain < 1000) {
        const relu = Number(fmt(gain).replace(/[\u202f\u00a0\s]/g, "").replace(",", "."));
        expect(relu, `${item.name} affiché ${fmt(gain)}`).toBeCloseTo(gain, 9);
      }
    }
  });

  it("multiplie le gain d'un clic par un multiplicateur de la grille", () => {
    const s = createFreshState(0);
    s.ui.introSeen = true;
    s.items = { cursor: 8 };
    for (let streak = 0; streak <= COMBO.clicksToMax; streak += 4) {
      const d = deriveStats(s, LATER, streak);
      expect(onGrid(d.combo)).toBe(true);
      expect(d.perClick).toBeCloseTo(d.perClickNoCombo * d.combo, 9);
    }
  });
});
