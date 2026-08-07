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
  REF_CLICKS_PER_SECOND,
  REF_COMBO,
} from "../utils/selectors.js";
import { SHARE_BASE, tierThreshold, tierMultiplier } from "../data/upgrades.js";
import { miningFrom, clickPowerFrom, chipMult } from "../utils/calc.js";
import { onGrid } from "../utils/grid.js";
import { createFreshState } from "../utils/state.js";
import { prestigeEffects, chipsFor, upgradeCost, availableChips, PRESTIGE_BY_ID } from "../data/prestige.js";
import { ITEMS, ITEM_BY_ID } from "../data/items.js";

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
    // Valeurs lues dans le catalogue: le test vérifie l'ADDITION, pas un
    // nombre appris par cœur qu'il faudrait réécrire à chaque calibration.
    const four = ITEM_BY_ID.oven.value;
    const boulangerie = ITEM_BY_ID.bakery.value;
    expect(miningFrom({ oven: 1 }, {}, 0)).toBe(four);
    expect(miningFrom({ oven: 3, bakery: 2 }, {}, 0)).toBe(3 * four + 2 * boulangerie);
    expect(miningFrom({}, {}, 0)).toBe(0);
  });

  it("applique le bonus des chips par paliers propres", () => {
    // Les chips ne donnent plus « +2 % » chacune: elles remplissent un palier,
    // et franchir un palier ajoute exactement +0,25. C'est ce qui interdit les
    // ×1,02 et ×2,06 que produisait l'ancien pourcentage.
    const base = miningFrom({ oven: 10 }, {}, 0);
    expect(miningFrom({ oven: 10 }, {}, 0)).toBe(base);
    expect(miningFrom({ oven: 10 }, {}, 1)).toBeCloseTo(base * 1.25, 6);
    expect(miningFrom({ oven: 10 }, {}, 10)).toBeCloseTo(base * 2, 6);
    for (const chips of [0, 1, 2, 7, 42, 1234, 1e6]) {
      expect(onGrid(chipMult(chips))).toBe(true);
    }
  });

  it("ne bouge pas entre deux paliers de chips", () => {
    // 3 chips ou 4 chips: même multiplicateur. La barre de progression montre
    // ce qu'il reste, le nombre reste net.
    expect(chipMult(3)).toBe(chipMult(4));
    expect(chipMult(5)).toBe(chipMult(9));
    expect(chipMult(10)).toBeGreaterThan(chipMult(9));
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

  it("garde un gain exact de +0,25 par Curseur tant que la puissance reste sous cent", () => {
    for (const n of [0, 10, 100, 390]) {
      const base = settled((x) => (x.items = { cursor: n }));
      const avant = deriveStats(base, LATER).perClickNoCombo;
      if (avant + 0.25 >= 100) continue;
      const apres = deriveStats({ ...base, items: { cursor: n + 1 } }, LATER).perClickNoCombo;
      expect(apres - avant).toBeCloseTo(0.25, 6);
    }
  });

  it("au-delà de cent, quatre Curseurs rendent exactement +1 et aucun achat ne rend négatif", () => {
    // La règle des entiers dès cent rend le +0,25 unitaire invisible trois fois
    // sur quatre à grande échelle: il se matérialise en +1 tous les quatre
    // exemplaires, jamais en perte. C'est le prix — assumé — d'un « par clic »
    // sans décimale au-delà de cent.
    for (const n of [1e3, 1e6, 1e9]) {
      const base = settled((x) => (x.items = { cursor: n }));
      const avant = deriveStats(base, LATER).perClickNoCombo;
      expect(Number.isInteger(avant)).toBe(true);
      const unParUn = [1, 2, 3, 4].map(
        (k) => deriveStats({ ...base, items: { cursor: n + k } }, LATER).perClickNoCombo
      );
      let precedent = avant;
      for (const p of unParUn) {
        expect(p).toBeGreaterThanOrEqual(precedent);
        precedent = p;
      }
      expect(unParUn[3] - avant).toBeCloseTo(1, 6);
    }
  });
});

// La spécification complète du combo vit dans `combo.test.js`: quatre crans,
// de ×1 à ×1,75. On ne garde ici que le lien avec le reste des sélecteurs.
describe("combo", () => {
  it("part de ×1 et sature au maximum", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(COMBO.clicksToMax)).toBe(COMBO.max);
    expect(comboMultiplier(COMBO.clicksToMax * 10)).toBe(COMBO.max);
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
      // Comparaison relative: la somme géométrique fermée et la somme itérée
      // divergent des derniers bits du flottant passé 10^13, ce qui n'a aucune
      // conséquence en jeu — c'est l'écart RELATIF qui doit être nul.
      expect(bulkCost(item, from, n) / unParUn).toBeCloseTo(1, 9);
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
  const moyen = () =>
    settled((x) => {
      x.items = { oven: 60, bakery: 40, farm_cps: 25, cursor: 60, grandma: 40, farm: 25 };
    });

  it("récompense proportionnellement le rythme de clic", () => {
    const s = moyen();
    const lent = activeRatio(s, 3, LATER);
    const normal = activeRatio(s, 5, LATER);
    const rapide = activeRatio(s, 12, LATER);
    expect(lent).toBeGreaterThan(1);
    expect(normal).toBeGreaterThan(lent);
    expect(rapide).toBeGreaterThan(normal);
  });

  it("prend cinq clics par seconde comme référence, pas sept", () => {
    // Sept clics/seconde est une cadence de souris soutenue: intenable au pouce
    // sur mobile, donc fausse comme référence d'un joueur « normalement actif ».
    expect(REF_CLICKS_PER_SECOND).toBe(5);
    expect(activeRatio(moyen())).toBe(activeRatio(moyen(), 5, undefined, REF_COMBO));
  });

  // La fourchette d'équilibrage réelle se mesure sur une partie jouée, dans
  // `balance.test.js`: un parc écrit à la main décrit un joueur qui n'existe
  // pas. On vérifie ici qu'à parc réaliste la valeur reste dans le même ordre
  // de grandeur que la cible, pour attraper une régression grossière.
  it("reste dans l'ordre de grandeur visé à la cadence de référence", () => {
    const r = activeRatio(moyen(), REF_CLICKS_PER_SECOND, LATER, REF_COMBO);
    expect(r).toBeGreaterThan(1.8);
    expect(r).toBeLessThan(3.5);
  });

  it("laisse les joueurs rapides dépasser 3× sans aucun plafond", () => {
    const s = moyen();
    const rapide = activeRatio(s, 12, LATER);
    expect(rapide).toBeGreaterThan(3);
    // Aucune saturation: doubler la cadence double l'écart au passif.
    const ecart = (c) => activeRatio(s, c, LATER) - 1;
    expect(ecart(24)).toBeCloseTo(ecart(12) * 2, 6);
    expect(ecart(240)).toBeCloseTo(ecart(12) * 20, 5);
  });
});

describe("Mineurs: deux gains, deux unités", () => {
  // Le Portail rapporte +100 000/s de minage ET, par la part reversée, de la
  // puissance de clic. Les deux ne partagent pas la même unité: l'interface les
  // affiche séparément et ne doit jamais les additionner.
  const base = settled((x) => (x.items = { portal: 10 }));
  const avec = settled((x) => (x.items = { portal: 11 }));

  it("ajoute exactement la valeur propre au minage", () => {
    const gain = deriveStats(avec, LATER).mining - deriveStats(base, LATER).mining;
    expect(gain).toBeCloseTo(ITEM_BY_ID.portal.value, 6);
  });

  it("ajoute en plus une part au clic, dans son unité", () => {
    const gainClic = deriveStats(avec, LATER).perClickNoCombo - deriveStats(base, LATER).perClickNoCombo;
    expect(gainClic).toBeCloseTo(ITEM_BY_ID.portal.value * SHARE_BASE, 6);
    expect(gainClic).toBeGreaterThan(0);
    // Les deux gains sont distincts: le clic ne vaut pas le minage.
    expect(gainClic).not.toBeCloseTo(ITEM_BY_ID.portal.value, 0);
  });

  it("laisse un Cliqueur sans effet sur le minage", () => {
    const a = settled((x) => (x.items = { cursor: 10 }));
    const b = settled((x) => (x.items = { cursor: 11 }));
    expect(deriveStats(b, LATER).mining).toBe(deriveStats(a, LATER).mining);
    expect(deriveStats(b, LATER).perClickNoCombo - deriveStats(a, LATER).perClickNoCombo).toBeCloseTo(0.25, 6);
  });
});

describe("paliers: doubler le parc, doubler le rendement", () => {
  it("place le premier palier à cinq, puis double sans fin", () => {
    // Cinq, parce qu'acheter son deuxième, troisième, quatrième Curseur ne
    // changeait jamais rien à ce que la carte annonçait: le palier qui répond à
    // ça arrivait au dixième, trop tard pour qu'on fasse le lien.
    //
    // Et le seuil SUIVANT reste à vingt, pas à dix: c'est ce qui garde la
    // partie strictement identique à partir du dixième exemplaire. Un palier
    // de plus à chaque étage rendait tout le jeu deux fois plus fort pour
    // toujours — mesuré, le rapport actif/passif tombait à 2,32 sur les dix
    // premières minutes et le joueur rapide crevait son plafond.
    expect([0, 1, 2, 3, 4, 5].map(tierThreshold)).toEqual([5, 20, 40, 80, 160, 320]);
    for (let n = 2; n < 40; n++) {
      expect(tierThreshold(n) / tierThreshold(n - 1)).toBe(2);
    }
    expect(tierThreshold(39)).toBeGreaterThan(tierThreshold(38));

    // Le cumul est INCHANGÉ dès dix exemplaires: ×2 à dix, ×4 à vingt.
    const cumul = (owned) =>
      [0, 1, 2, 3, 4, 5, 6].reduce((m, n) => (tierThreshold(n) <= owned ? m * tierMultiplier(n) : m), 1);
    expect(cumul(5)).toBe(2); // le gain: ×2 dès cinq, là où il n'y avait rien
    expect(cumul(10)).toBe(2);
    expect(cumul(20)).toBe(4);
    expect(cumul(40)).toBe(8);
    expect(cumul(320)).toBe(64);
  });

  it("garde un multiplicateur unique et net: ×2", () => {
    // Un seul nombre à retenir. L'échelle ×2/×3/×5 cumulait ×360 à 400
    // exemplaires et faisait s'emballer la partie en quelques minutes.
    for (let n = 0; n < 40; n++) expect(tierMultiplier(n)).toBe(2);
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
      x.prestige = { chips: 10, spent: 0, upgrades: {} }; // 4 paliers = ×2 pile
    });
    const a = deriveStats(sans, LATER);
    const b = deriveStats(avec, LATER);
    expect(b.mining / a.mining).toBeCloseTo(2, 5);
    expect(b.buildingsPower / a.buildingsPower).toBeCloseTo(2, 5);
  });

  it("plafonne la réduction de coût à -50 %", () => {
    const maxed = prestigeEffects({ prestige: { upgrades: { cheap_bricks: 999 } } });
    expect(maxed.costMult).toBe(0.5);
  });

  it("garde les multiplicateurs de l'arbre sur la grille", () => {
    for (const n of [0, 1, 2, 3, 7, 40]) {
      const e = prestigeEffects({ prestige: { upgrades: { celestial_dough: n, golden_fingers: n } } });
      expect(onGrid(e.cpsMult)).toBe(true);
      expect(onGrid(e.cpcMult)).toBe(true);
    }
    // Un niveau = +0,25 exactement, pas +5 %.
    expect(prestigeEffects({ prestige: { upgrades: { celestial_dough: 1 } } }).cpsMult).toBe(1.25);
    expect(prestigeEffects({ prestige: { upgrades: { celestial_dough: 4 } } }).cpsMult).toBe(2);
  });

  it("rend des effets neutres sans arbre", () => {
    const e = prestigeEffects({});
    expect(e.cpsMult).toBe(1);
    expect(e.cpcMult).toBe(1);
    expect(e.costMult).toBe(1);
    expect(e.startFraction).toBe(0);
  });
});
