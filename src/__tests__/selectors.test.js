import { describe, it, expect } from "vitest";
import { deriveStats, costOf, bulkCost, milestoneFactor, maxAffordable, buyQuantity } from "../utils/selectors.js";
import { cpsFrom, clickMultiplierFrom } from "../utils/calc.js";
import { createFreshState } from "../utils/state.js";
import { prestigeEffects, chipsFor, upgradeCost, availableChips, PRESTIGE_BY_ID } from "../data/prestige.js";
import { ITEMS } from "../data/items.js";

// L'état frais utilise Date.now(); on fige l'instant pour sortir de la fenêtre
// « early game » et tester les formules de base sans bonus temporaire.
const settled = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  mutate(s);
  return s;
};
const LATER = 10 * 60 * 1000; // au-delà de early.window_s (300 s)

describe("cpsFrom", () => {
  it("calcule la production sans amélioration", () => {
    expect(cpsFrom({ oven: 1 }, {}, 0)).toBeCloseTo(0.6);
    expect(cpsFrom({}, {}, 0)).toBe(0);
  });

  it("applique le bonus des chips de prestige", () => {
    const base = cpsFrom({ oven: 10 }, {}, 0);
    const withChips = cpsFrom({ oven: 10 }, {}, 50);
    expect(withChips).toBeCloseTo(base * 2); // 50 chips = +100 %
  });
});

describe("clickMultiplierFrom", () => {
  it("croît avec des rendements décroissants", () => {
    const low = clickMultiplierFrom({ cursor: 1 }, {});
    const high = clickMultiplierFrom({ cursor: 100, grandma: 50, farm: 20, factory: 10 }, {});
    expect(low).toBeGreaterThan(1);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(50);
  });
});

describe("deriveStats", () => {
  it("rend des valeurs neutres sur un état neuf", () => {
    const stats = deriveStats(settled(), LATER);
    expect(stats.cps).toBe(0);
    expect(stats.cpc).toBe(1);
    expect(stats.buffActive).toBe(false);
  });

  it("ignore un buff expiré", () => {
    const s = settled((x) => {
      x.buffs = { cpsMulti: 10, cpcMulti: 10, until: 1000, label: "vieux" };
      x.items = { oven: 10 };
    });
    const stats = deriveStats(s, LATER);
    expect(stats.buffActive).toBe(false);
    expect(stats.cpc).toBe(1);
  });

  it("applique un buff actif", () => {
    const s = settled((x) => {
      x.buffs = { cpsMulti: 3, cpcMulti: 2, until: LATER + 10_000, label: "actif" };
      x.items = { oven: 10 };
    });
    const stats = deriveStats(s, LATER);
    expect(stats.buffActive).toBe(true);
    expect(stats.cps).toBeCloseTo(stats.baseCps * 3);
    expect(stats.cpc).toBeCloseTo(2);
  });

  it("intègre les bonus permanents de l'arbre céleste", () => {
    const plain = settled((x) => (x.items = { oven: 10 }));
    const boosted = settled((x) => {
      x.items = { oven: 10 };
      x.prestige = { chips: 20, spent: 0, upgrades: { celestial_dough: 10, golden_fingers: 10 } };
    });
    // 10 × 5 % de production et 10 × 8 % de clic
    expect(deriveStats(boosted, LATER).baseCps).toBeGreaterThan(deriveStats(plain, LATER).baseCps);
    expect(deriveStats(boosted, LATER).cpc).toBeCloseTo(1.8);
  });

  it("prend en compte le boost de staking", () => {
    const s = settled((x) => {
      x.items = { oven: 10 };
      x.crypto.positions = [{ id: "p", amount: 1, tierId: "long", startedAt: 0, unlockAt: 0 }];
    });
    expect(deriveStats(s, LATER).stakeMult).toBeGreaterThan(1);
  });
});

describe("coûts", () => {
  it("renchérit avec le nombre possédé", () => {
    const item = ITEMS.find((i) => i.id === "oven");
    expect(bulkCost(item, 10, 1)).toBeGreaterThan(bulkCost(item, 0, 1));
  });

  it("applique le renchérissement par paliers", () => {
    expect(milestoneFactor(0)).toBe(1);
    expect(milestoneFactor(10)).toBeGreaterThan(1);
    expect(milestoneFactor(100)).toBeGreaterThan(milestoneFactor(10));
  });

  it("rend un entier au minimum à 1", () => {
    const s = settled();
    const price = costOf(s, "oven", 1, LATER);
    expect(Number.isInteger(price)).toBe(true);
    expect(price).toBeGreaterThanOrEqual(1);
  });

  it("cumule les remises", () => {
    const plain = settled();
    const discounted = settled((x) => {
      x.flags.discountAll = { value: 0.5, until: LATER + 10_000 };
    });
    expect(costOf(discounted, "oven", 1, LATER)).toBeLessThan(costOf(plain, "oven", 1, LATER));
  });

  it("applique la vente flash au bon bâtiment seulement", () => {
    const s = settled((x) => {
      x.flags.flash = { itemId: "oven", discount: 0.5, until: LATER + 10_000 };
    });
    const plain = settled();
    expect(costOf(s, "oven", 1, LATER)).toBeLessThan(costOf(plain, "oven", 1, LATER));
    expect(costOf(s, "bakery", 1, LATER)).toBe(costOf(plain, "bakery", 1, LATER));
  });

  it("réduit les coûts via l'arbre céleste", () => {
    const plain = settled();
    const cheap = settled((x) => {
      x.prestige = { chips: 100, spent: 0, upgrades: { cheap_bricks: 15 } };
    });
    expect(costOf(cheap, "bakery", 1, LATER)).toBeLessThan(costOf(plain, "bakery", 1, LATER));
  });

  it("offre le premier curseur avant la fin de l'intro", () => {
    const s = settled((x) => (x.ui.introSeen = false));
    expect(costOf(s, "cursor", 1, LATER)).toBe(0);
    // Une fois possédé, il devient payant
    s.items.cursor = 1;
    expect(costOf(s, "cursor", 1, LATER)).toBeGreaterThan(0);
  });

  it("rend Infinity pour un bâtiment inconnu", () => {
    expect(costOf(settled(), "licorne", 1, LATER)).toBe(Infinity);
  });
});

describe("maxAffordable", () => {
  it("trouve la quantité maximale achetable", () => {
    const s = settled((x) => (x.cookies = 0));
    expect(maxAffordable(s, "oven", 100, LATER)).toBe(0);

    const rich = settled((x) => (x.cookies = 1e9));
    const n = maxAffordable(rich, "oven", 100, LATER);
    expect(n).toBeGreaterThan(0);
    expect(costOf(rich, "oven", n, LATER)).toBeLessThanOrEqual(rich.cookies);
    if (n < 100) expect(costOf(rich, "oven", n + 1, LATER)).toBeGreaterThan(rich.cookies);
  });
});

describe("buyQuantity", () => {
  it("lit les modificateurs clavier", () => {
    expect(buyQuantity({})).toBe(1);
    expect(buyQuantity({ shiftKey: true })).toBe(10);
    expect(buyQuantity({ ctrlKey: true })).toBe(100);
    expect(buyQuantity({ metaKey: true })).toBe(100);
    expect(buyQuantity(null)).toBe(1);
  });
});

describe("prestige", () => {
  it("convertit la production totale en chips", () => {
    expect(chipsFor(0)).toBe(0);
    expect(chipsFor(1e6)).toBe(1);
    expect(chipsFor(4e6)).toBe(2);
    expect(chipsFor(-5)).toBe(0);
  });

  it("renchérit chaque niveau", () => {
    expect(upgradeCost("celestial_dough", 5)).toBeGreaterThan(upgradeCost("celestial_dough", 0));
  });

  it("rend Infinity au niveau maximum", () => {
    const node = PRESTIGE_BY_ID.celestial_dough;
    expect(upgradeCost("celestial_dough", node.maxLevel)).toBe(Infinity);
  });

  it("décompte les chips dépensés", () => {
    expect(availableChips({ prestige: { chips: 10, spent: 4 } })).toBe(6);
    expect(availableChips({ prestige: { chips: 3, spent: 99 } })).toBe(0);
    expect(availableChips({})).toBe(0);
  });

  it("plafonne la réduction de coût", () => {
    const maxed = prestigeEffects({ prestige: { upgrades: { cheap_bricks: 999 } } });
    expect(maxed.costMult).toBeGreaterThanOrEqual(0.7);
  });

  it("rend des effets neutres sans arbre", () => {
    const e = prestigeEffects({});
    expect(e.cpsMult).toBe(1);
    expect(e.cpcMult).toBe(1);
    expect(e.costMult).toBe(1);
    expect(e.startCookies).toBe(0);
  });
});
