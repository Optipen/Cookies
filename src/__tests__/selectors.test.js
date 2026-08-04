import { describe, it, expect } from "vitest";
import {
  deriveStats,
  costOf,
  bulkCost,
  maxAffordable,
  buyQuantity,
  comboMultiplier,
  activeIncome,
  activeRatio,
  timeToAfford,
  COMBO,
} from "../utils/selectors.js";
import { miningFrom, clickPowerFrom } from "../utils/calc.js";
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

describe("minage", () => {
  it("additionne exactement les valeurs des Mineurs", () => {
    expect(miningFrom({ oven: 1 }, {}, 0)).toBe(2);
    expect(miningFrom({ oven: 3, bakery: 2 }, {}, 0)).toBe(3 * 2 + 2 * 10);
    expect(miningFrom({}, {}, 0)).toBe(0);
  });

  it("applique le bonus des chips de prestige", () => {
    const base = miningFrom({ oven: 10 }, {}, 0);
    expect(miningFrom({ oven: 10 }, {}, 50)).toBeCloseTo(base * 2); // 50 chips = +100 %
  });
});

describe("puissance de clic", () => {
  it("est strictement additive avec des valeurs propres", () => {
    // Exigence de lisibilité: +0,25 doit porter la puissance de 1 à 1,25 pile.
    const vide = deriveStats(settled(), LATER);
    expect(vide.perClickNoCombo).toBe(1);

    const unCurseur = deriveStats(settled((x) => (x.items = { cursor: 1 })), LATER);
    expect(unCurseur.perClickNoCombo).toBe(1.25);

    const quatre = deriveStats(settled((x) => (x.items = { cursor: 4 })), LATER);
    expect(quatre.perClickNoCombo).toBe(2);

    const mixte = deriveStats(settled((x) => (x.items = { cursor: 4, grandma: 1, farm: 1 })), LATER);
    expect(mixte.perClickNoCombo).toBe(1 + 4 * 0.25 + 1 + 5);
  });

  it("n'est jamais plafonnée", () => {
    // Régression: l'ancienne formule `1 + s·K/(s+K)` plafonnait à ×13. Le
    // multiplicateur atteignait ×11,8 avec un exemplaire de chaque bâtiment
    // puis ne bougeait plus, ce qui tuait le clic en dix minutes de jeu.
    const echelles = [1, 1e3, 1e6, 1e9];
    let precedent = 0;
    for (const n of echelles) {
      const p = clickPowerFrom({ cursor: n }, {});
      expect(p).toBeCloseTo(n * 0.25, 5);
      expect(p).toBeGreaterThan(precedent);
      precedent = p;
    }
  });

  it("garde un gain strictement positif à toutes les échelles jouables", () => {
    for (const n of [0, 10, 1e3, 1e6, 1e9]) {
      const base = settled((x) => (x.items = { cursor: n }));
      const avant = deriveStats(base, LATER).perClickNoCombo;
      const apres = deriveStats({ ...base, items: { cursor: n + 1 } }, LATER).perClickNoCombo;
      expect(apres - avant).toBeCloseTo(0.25, 6);
    }
  });
});

describe("combo", () => {
  it("va de ×1 à ×3 selon la chaîne de clics", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(COMBO.clicksToMax)).toBeCloseTo(COMBO.max);
    expect(comboMultiplier(COMBO.clicksToMax * 10)).toBeCloseTo(COMBO.max);
    expect(comboMultiplier(COMBO.clicksToMax / 2)).toBeCloseTo(1 + (COMBO.max - 1) / 2);
  });

  it("ignore les valeurs aberrantes", () => {
    expect(comboMultiplier(-50)).toBe(1);
    expect(comboMultiplier(undefined)).toBe(1);
  });
});

describe("équilibrage actif / passif", () => {
  // L'objectif de conception: un joueur qui clique gagne 2,5 à 3 fois plus
  // qu'un joueur qui laisse tourner — jamais moins, jamais dix fois plus.
  const empire = (echelle) =>
    settled((x) => {
      x.items = {
        oven: 40 * echelle, bakery: 30 * echelle, farm_cps: 20 * echelle, factory_cps: 12 * echelle,
        cursor: 50 * echelle, grandma: 35 * echelle, farm: 20 * echelle, factory: 12 * echelle,
      };
      x.lifetime = 1e6 * echelle;
    });

  for (const echelle of [1, 5, 25, 100]) {
    it(`reste dans la fourchette à l'échelle ×${echelle}`, () => {
      const s = empire(echelle);
      const passif = deriveStats(s, LATER).cps;
      const actif = activeIncome(s, 7, LATER);
      const ratio = actif / passif;
      expect(ratio).toBeGreaterThan(1.8);
      expect(ratio).toBeLessThan(5);
    });
  }

  it("garde le clic devant l'idle même sur un empire démesuré", () => {
    const s = empire(5000);
    expect(activeIncome(s, 7, LATER)).toBeGreaterThan(deriveStats(s, LATER).cps * 2);
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
    const neutre = deriveStats(settled((x) => (x.items = { oven: 10 })), LATER);
    expect(stats.buffActive).toBe(false);
    expect(stats.cpc).toBeCloseTo(neutre.cpc);
  });

  it("applique un buff actif", () => {
    const s = settled((x) => {
      x.buffs = { cpsMulti: 3, cpcMulti: 2, until: LATER + 10_000, label: "actif" };
      x.items = { oven: 10 };
    });
    const stats = deriveStats(s, LATER);
    const neutre = deriveStats(settled((x) => (x.items = { oven: 10 })), LATER);
    expect(stats.buffActive).toBe(true);
    expect(stats.cps).toBeCloseTo(stats.baseCps * 3);
    expect(stats.cpc).toBeCloseTo(neutre.cpc * 2);
  });

  it("intègre les bonus permanents de l'arbre céleste", () => {
    const plain = settled((x) => (x.items = { oven: 10 }));
    const boosted = settled((x) => {
      x.items = { oven: 10 };
      x.prestige = { chips: 20, spent: 0, upgrades: { celestial_dough: 10, golden_fingers: 10 } };
    });
    // 10 × 5 % de production et 10 × 8 % de clic
    expect(deriveStats(boosted, LATER).baseCps).toBeGreaterThan(deriveStats(plain, LATER).baseCps);
    expect(deriveStats(boosted, LATER).cpc).toBeGreaterThan(deriveStats(plain, LATER).cpc * 1.5);
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

describe("achat groupé", () => {
  it("coûte exactement le prix des achats un par un", () => {
    // Régression: `bulkCost` appliquait le renchérissement du compte de départ à
    // toute la série. Acheter 200 fours d'un coup coûtait 15,8 fois moins cher
    // que 200 achats successifs, rendant le bouton ×100 strictement optimal.
    const item = ITEMS.find((i) => i.id === "oven");
    for (const [from, n] of [[0, 30], [0, 120], [40, 80]]) {
      let unParUn = 0;
      for (let k = 0; k < n; k++) unParUn += bulkCost(item, from + k, 1);
      expect(bulkCost(item, from, n)).toBeCloseTo(unParUn, 5);
    }
  });

  it("ne rend jamais un prix unitaire décroissant", () => {
    const item = ITEMS.find((i) => i.id === "cursor");
    let precedent = 0;
    for (let owned = 0; owned < 250; owned += 7) {
      const prix = bulkCost(item, owned, 1);
      expect(prix).toBeGreaterThanOrEqual(precedent);
      precedent = prix;
    }
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

describe("rapport actif / passif", () => {
  it("récompense proportionnellement le rythme de clic", () => {
    const s = settled((x) => {
      x.items = { oven: 60, bakery: 40, farm_cps: 25, cursor: 60, grandma: 40, farm: 25 };
    });
    const lent = activeRatio(s, 3, LATER);
    const normal = activeRatio(s, 7, LATER);
    const rapide = activeRatio(s, 12, LATER);
    expect(lent).toBeGreaterThan(1);
    expect(normal).toBeGreaterThan(lent);
    expect(rapide).toBeGreaterThan(normal);
  });

  it("reste dans la fourchette visée pour un rythme normal", () => {
    const s = settled((x) => {
      x.items = { oven: 60, bakery: 40, farm_cps: 25, cursor: 60, grandma: 40, farm: 25 };
    });
    const r = activeRatio(s, 7, LATER);
    expect(r).toBeGreaterThan(2);
    expect(r).toBeLessThan(4);
  });
});

describe("timeToAfford", () => {
  it("rend zéro quand c'est déjà payable", () => {
    const s = settled((x) => (x.cookies = 1000));
    expect(timeToAfford(s, 500, deriveStats(s, LATER))).toBe(0);
  });

  it("rend l'infini sans aucun revenu", () => {
    const s = settled();
    expect(timeToAfford(s, 500, deriveStats(s, LATER))).toBe(Infinity);
  });

  it("estime une durée cohérente", () => {
    const s = settled((x) => (x.items = { oven: 10 })); // 20 /s
    expect(timeToAfford(s, 200, deriveStats(s, LATER))).toBeCloseTo(10_000, -2);
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
  it("convertit la production totale en chips, en racine cubique", () => {
    // Régression: en racine carrée, chips → production → chips divergeait
    // (soixante prestiges et 6,5e13 chips en une semaine simulée).
    expect(chipsFor(0)).toBe(0);
    expect(chipsFor(1e3)).toBe(1);
    expect(chipsFor(8e3)).toBe(2);
    expect(chipsFor(-5)).toBe(0);
    // Multiplier la production par mille ne multiplie les chips que par dix
    expect(chipsFor(1e12)).toBe(chipsFor(1e9) * 10);
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

  it("applique chips et staking aux DEUX axes", () => {
    // Régression: quand seul le minage en profitait, chaque prestige faisait
    // décrocher le clic un peu plus.
    const sans = settled((x) => (x.items = { oven: 20, cursor: 20 }));
    const avec = settled((x) => {
      x.items = { oven: 20, cursor: 20 };
      x.prestige = { chips: 50, spent: 0, upgrades: {} };
    });
    const a = deriveStats(sans, LATER);
    const b = deriveStats(avec, LATER);
    expect(b.mining / a.mining).toBeCloseTo(2, 5);
    expect(b.buildingsPower / a.buildingsPower).toBeCloseTo(2, 5);
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
    expect(e.startFraction).toBe(0);
  });
});
