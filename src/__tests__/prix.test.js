import { describe, it, expect } from "vitest";
import { costOf, bulkCost, unitPrice, maxAffordable } from "../utils/selectors.js";
import { createFreshState } from "../utils/state.js";
import { ITEMS, ITEM_BY_ID } from "../data/items.js";
import { lisible, prixLisible } from "../utils/grid.js";
import { fmtPrix } from "../utils/format.js";

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

describe("un achat groupé ne coûte jamais plus que la somme des achats un par un", () => {
  // C'est la garantie qui compte pour le joueur: le sélecteur ×10 n'est jamais
  // une pénalité cachée. Chaque UNITÉ est posée sur la grille des prix; le lot
  // en est la somme exacte, sauf quand cette somme traverse une décade — elle
  // est alors repliée vers le BAS, d'au plus un quart de son cran d'affichage.
  const verifieLot = (s, id, n, etiquette = "") => {
    // Le lot vaut EXACTEMENT la somme des achats un par un. L'ancien repli du
    // total « vers le bas sur la grille d'affichage » fabriquait une remise
    // cachée récurrente — mesurée jusqu'à −19,9 % (dix Fours à 19 possédés:
    // 124 800 un par un, 100 000 en lot) — et « Max » redevenait secrètement
    // meilleur que ×1. Aucune tolérance: égalité stricte.
    const lot = costOf(s, id, n, LATER);
    const un = unParUn(s, id, n);
    expect(lot, etiquette).toBe(un);
    return lot;
  };

  for (const id of ["cursor", "oven", "portal", "singularity"]) {
    it(`${ITEM_BY_ID[id].name}: ×10 depuis zéro`, () => {
      verifieLot(partie(), id, 10);
    });

    it(`${ITEM_BY_ID[id].name}: ×25 depuis un parc déjà constitué`, () => {
      verifieLot(partie((x) => (x.items = { [id]: 37 })), id, 25);
    });
  }

  it("tient aussi avec une réduction de coût du prestige", () => {
    // `cheap_bricks` retire 5 % par niveau. La remise s'applique à chaque
    // exemplaire AVANT sa pose sur la grille: c'est la remise qui s'adapte au
    // quart près, pas l'affichage qui ment.
    for (const niveaux of [1, 5, 10]) {
      const s = partie((x) => {
        x.items = { oven: 12 };
        x.prestige = { chips: 500, spent: 0, upgrades: { cheap_bricks: niveaux } };
      });
      verifieLot(s, "oven", 10, `niveau ${niveaux}`);
    }
  });

  it("tient aussi pendant une remise générale", () => {
    const s = partie((x) => {
      x.items = { bakery: 8 };
      x.flags.discountAll = { value: 0.25, until: LATER + 60_000 };
    });
    verifieLot(s, "bakery", 10);
  });

  it("tient quand deux remises se cumulent et tombent sur des centimes", () => {
    // Cas le plus exigeant: ×0,95 puis ×0,75 donnent 0,7125, qui ne tombe juste
    // sur aucun prix rond. La pose sur la grille se fait par exemplaire, jamais
    // sur le lot entier.
    const s = partie((x) => {
      x.items = { bakery: 8 };
      x.prestige = { chips: 500, spent: 0, upgrades: { cheap_bricks: 1 } };
      x.flags.discountAll = { value: 0.25, until: LATER + 60_000 };
    });
    verifieLot(s, "bakery", 10);
  });

  it("tient pour « Max »", () => {
    const s = partie((x) => {
      x.cookies = 250_000;
      x.items = { cursor: 5 };
    });
    const n = maxAffordable(s, "cursor", 1000, LATER);
    expect(n).toBeGreaterThan(0);
    const prix = verifieLot(s, "cursor", n);
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

  it("le prix PAYÉ ne stagne jamais et reste posé sur la grille des quarts", () => {
    // Le prix facturé passe par `prixLisible`: son second chiffre est un quart.
    // La pose ne doit ni faire stagner l'échelle, ni la faire reculer.
    const ouverte = partie((x) => {
      x.ascension = { stars: 99, spent: 0, tracks: { horizon: 4 }, count: 1 };
    });
    for (const item of ITEMS) {
      let precedent = 0;
      for (let k = 0; k < 60; k++) {
        const s = { ...ouverte, items: { [item.id]: k } };
        const p = costOf(s, item.id, 1, LATER);
        expect(p, `${item.name} #${k}`).toBeGreaterThan(precedent);
        expect(prixLisible(p), `${item.name} #${k}`).toBe(p);
        precedent = p;
      }
    }
  });

  it("s'affiche exactement: le texte à l'écran EST le prix payé", () => {
    // C'est `fmtPrix` qui porte cette garantie, et il la porte maintenant dans
    // l'UNITÉ DU SOLDE: « 5,75M », et non plus « 5 750K ». Comparer un prix à
    // un solde ne demande plus de conversion mentale. Un prix qui ne tombe pas
    // juste s'écrit toujours en toutes lettres, aussi long soit-il.
    const esp = (s) => s.replace(/[\s  ]/g, " ");
    expect(fmtPrix(5_750_000)).toBe("5,75M");
    expect(fmtPrix(57_500_000)).toBe("57,5M");
    expect(fmtPrix(575_000_000)).toBe("575M");
    expect(fmtPrix(11_750_000)).toBe("11,75M");
    expect(fmtPrix(2_750_000_000_000)).toBe("2,75T");
    expect(esp(fmtPrix(125_000))).toBe("125 000");
    expect(esp(fmtPrix(1_248_300))).toBe("1 248 300");
  });

  it("rend un prix entier, jamais nul, jamais négatif", () => {
    for (const item of ITEMS) {
      for (const owned of [0, 1, 17, 250]) {
        const s = partie((x) => {
          x.items = { [item.id]: owned };
          // On ouvre toutes les voies d'Horizon: on teste ici la formule de
          // prix, pas le verrouillage.
          x.ascension = { stars: 99, spent: 0, tracks: { horizon: 4 }, count: 1 };
        });
        const p = costOf(s, item.id, 1, LATER);
        expect(Number.isInteger(p), `${item.name}`).toBe(true);
        expect(p).toBeGreaterThan(0);
      }
    }
  });

  it("ne met aucun prix sur un rang que l'Ascension n'a pas ouvert", () => {
    // Un rang verrouillé n'est pas cher: il n'est pas à vendre. Rendre un prix
    // fini laisserait la boutique proposer un achat impossible, et « Max »
    // pourrait vider la banque dessus.
    const ferme = partie();
    for (const item of ITEMS.filter((i) => i.horizon > 0)) {
      expect(costOf(ferme, item.id, 1, LATER), `${item.name}`).toBe(Infinity);
      expect(maxAffordable({ ...ferme, cookies: 1e30 }, item.id, 1000, LATER)).toBe(0);
    }
    // Une fois la voie montée, les rangs correspondants s'ouvrent un par un.
    for (let niveau = 1; niveau <= 4; niveau++) {
      const s = partie((x) => {
        x.cookies = 1e30;
        x.ascension = { stars: 99, spent: 0, tracks: { horizon: niveau }, count: 1 };
      });
      for (const item of ITEMS.filter((i) => i.horizon > 0)) {
        const ouvert = item.horizon <= niveau;
        expect(Number.isFinite(costOf(s, item.id, 1, LATER)), `${item.name} à Horizon ${niveau}`).toBe(ouvert);
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
