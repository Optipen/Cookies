import { describe, it, expect } from "vitest";
import { costOf, bulkCost, unitPrice, maxAffordable } from "../utils/selectors.js";
import { createFreshState } from "../utils/state.js";
import { ITEMS, ITEM_BY_ID } from "../data/items.js";
import { lisible } from "../utils/grid.js";

const LATER = 6e5; // hors de la fenêtre de début de partie
const partie = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  s.flags.freeFirstAutoGiven = true;
  s.cookies = 1e18;
  mutate(s);
  return s;
};

/** Achète `n` exemplaires un par un, en payant chaque fois le prix affiché. */
const unParUn = (state, id, n) => {
  let s = { ...state, items: { ...state.items } };
  let total = 0;
  for (let k = 0; k < n; k++) {
    total += costOf(s, id, 1, LATER);
    s = { ...s, items: { ...s.items, [id]: (s.items[id] || 0) + 1 } };
  }
  return total;
};

describe("un achat groupé coûte exactement la somme des achats un par un", () => {
  // C'est la seule garantie qui compte pour le joueur: le sélecteur ×10 ne doit
  // être ni une remise cachée ni une pénalité cachée.
  for (const id of ["cursor", "oven", "portal", "singularity"]) {
    it(`${ITEM_BY_ID[id].name}: ×10 depuis zéro`, () => {
      const s = partie();
      expect(costOf(s, id, 10, LATER)).toBe(unParUn(s, id, 10));
    });

    it(`${ITEM_BY_ID[id].name}: ×25 depuis un parc déjà constitué`, () => {
      const s = partie((x) => (x.items = { [id]: 37 }));
      expect(costOf(s, id, 25, LATER)).toBe(unParUn(s, id, 25));
    });
  }

  it("tient aussi avec une réduction de coût du prestige", () => {
    // `cheap_bricks` retire 5 % par niveau. Un arrondi appliqué une seule fois
    // au lot rendait l'achat groupé moins cher que les achats unitaires.
    for (const niveaux of [1, 5, 10]) {
      const s = partie((x) => {
        x.items = { oven: 12 };
        x.prestige = { chips: 500, spent: 0, upgrades: { cheap_bricks: niveaux } };
      });
      expect(costOf(s, "oven", 10, LATER), `niveau ${niveaux}`).toBe(unParUn(s, "oven", 10));
    }
  });

  it("tient aussi pendant une remise générale", () => {
    const s = partie((x) => {
      x.items = { bakery: 8 };
      x.flags.discountAll = { value: 0.25, until: LATER + 60_000 };
    });
    expect(costOf(s, "bakery", 10, LATER)).toBe(unParUn(s, "bakery", 10));
  });

  it("tient quand deux remises se cumulent et tombent sur des centimes", () => {
    // Cas le plus exigeant: ×0,95 puis ×0,75 donnent 0,7125, qui ne tombe juste
    // sur aucun prix rond. Un arrondi appliqué au lot au lieu de chaque
    // exemplaire s'y verrait immédiatement.
    const s = partie((x) => {
      x.items = { bakery: 8 };
      x.prestige = { chips: 500, spent: 0, upgrades: { cheap_bricks: 1 } };
      x.flags.discountAll = { value: 0.25, until: LATER + 60_000 };
    });
    expect(costOf(s, "bakery", 10, LATER)).toBe(unParUn(s, "bakery", 10));
  });

  it("tient pour « Max »", () => {
    const s = partie((x) => {
      x.cookies = 250_000;
      x.items = { cursor: 5 };
    });
    const n = maxAffordable(s, "cursor", 1000, LATER);
    expect(n).toBeGreaterThan(0);
    const prix = costOf(s, "cursor", n, LATER);
    expect(prix).toBe(unParUn(s, "cursor", n));
    expect(prix).toBeLessThanOrEqual(s.cookies);
    // …et pas un exemplaire de plus.
    expect(costOf(s, "cursor", n + 1, LATER)).toBeGreaterThan(s.cookies);
  });
});

describe("les prix restent lisibles et strictement croissants", () => {
  it("n'affiche que des nombres à deux chiffres significatifs", () => {
    for (const item of ITEMS) {
      let precedent = 0;
      for (let n = 0; n < 80; n++) {
        const p = unitPrice(item, n);
        expect(p, `${item.name} #${n}`).toBeGreaterThan(precedent);
        expect(lisible(p), `${item.name} #${n}`).toBe(p);
        precedent = p;
      }
    }
  });

  it("ne stagne jamais d'un exemplaire au suivant", () => {
    // Deux exemplaires au même tarif, et le joueur en achète deux en croyant
    // en payer un.
    for (const item of ITEMS) {
      for (let n = 0; n < 200; n++) {
        expect(unitPrice(item, n + 1)).toBeGreaterThan(unitPrice(item, n));
      }
    }
  });

  it("rend un prix entier, jamais nul, jamais négatif", () => {
    for (const item of ITEMS) {
      for (const owned of [0, 1, 17, 250]) {
        const s = partie((x) => (x.items = { [item.id]: owned }));
        const p = costOf(s, item.id, 1, LATER);
        expect(Number.isInteger(p), `${item.name}`).toBe(true);
        expect(p).toBeGreaterThan(0);
      }
    }
  });

  it("ne déborde pas sur un lot démesuré", () => {
    const s = partie((x) => (x.items = { portal: 900 }));
    const p = costOf(s, "portal", 1000, LATER);
    expect(p === Infinity || Number.isFinite(p)).toBe(true);
    expect(bulkCost(ITEM_BY_ID.portal, 0, 0)).toBe(0);
  });
});
