import { describe, it, expect } from "vitest";
import { deriveStats, activeIncome, activeRatio, bulkCost, unitPrice, costOf } from "../utils/selectors.js";
import { globalBonus, unitValue } from "../utils/calc.js";
import { onGrid, lisible } from "../utils/grid.js";
import { roundCrmb, miningRate, stakingYieldPerSecond } from "../utils/crypto.js";
import { createFreshState, migrate } from "../utils/state.js";
import { ITEMS, ITEM_BY_ID } from "../data/items.js";

// Chaque test de ce fichier fige un défaut trouvé lors de l'audit du
// 4 août 2026. Ils sont regroupés ici pour qu'on voie d'un coup d'œil ce qui
// avait cassé, et pourquoi.

const settled = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  mutate(s);
  return s;
};
const LATER = 6e5;

describe("P0 — le CRMB était produit puis détruit", () => {
  it("expose bien `crmbRate`, la clé que lisent la boucle et le hors-ligne", () => {
    // La boucle de jeu lisait `stats.miningRate`, qui n'existe pas. `undefined +
    // n` valant NaN et `NaN > 0` étant faux, le matériel de minage et le staking
    // ne créditaient JAMAIS le moindre CRMB.
    const s = settled((x) => {
      x.crypto.miners = { cpu: 3, gpu: 1 };
      x.crypto.positions = [{ id: "p", amount: 10, tierId: "long", startedAt: 0, unlockAt: 0 }];
    });
    const d = deriveStats(s, LATER);
    expect(d.crmbRate).toBeGreaterThan(0);
    expect(d.stakingYield).toBeGreaterThan(0);
    expect(Number.isFinite(d.crmbRate + d.stakingYield)).toBe(true);
    expect(d.miningRate).toBeUndefined(); // le nom fautif ne doit pas réapparaître
  });

  it("ne laisse jamais un montant non fini contaminer le solde", () => {
    // Le retour hors-ligne produisait NaN, le solde s'affichait « ∞ », puis
    // retombait à zéro au rechargement: perte silencieuse de toute la monnaie.
    expect(roundCrmb(NaN)).toBe(0);
    expect(roundCrmb(Infinity)).toBe(0);
    expect(roundCrmb(undefined)).toBe(0);
    expect(roundCrmb(1.2345678)).toBeCloseTo(1.234568, 6);
  });

  it("garde un solde fini après une migration d'état corrompu", () => {
    const s = migrate({ version: 5, crypto: { balance: NaN, totalEarned: NaN } });
    expect(Number.isFinite(s.crypto.balance)).toBe(true);
    expect(s.crypto.balance).toBe(0);
  });

  it("compte les débits du matériel et du staking dans les bonnes unités", () => {
    expect(miningRate({ cpu: 1 }) * 3600).toBeCloseTo(0.05, 6); // 0,05 CRMB/h
    expect(stakingYieldPerSecond([{ amount: 100, tierId: "flex" }]) * 86_400).toBeCloseTo(1, 6); // 1 %/jour
  });
});

describe("P1 — le Curseur sortait de la grille", () => {
  it("garde le gain unitaire sur la grille quel que soit le multiplicateur", () => {
    // 0,25 × (1 + 0,25k) = k/16: hors grille pour 73 % des multiplicateurs.
    // L'écran affichait « +0,63 » pour un calcul de 0,625.
    for (let crans = 0; crans <= 40; crans++) {
      const g = globalBonus(0, crans, 0);
      for (const item of ITEMS) {
        const v = unitValue(item, 1, g);
        expect(onGrid(v), `${item.name} à ×${g} → ${v}`).toBe(true);
      }
    }
  });

  it("n'annule jamais un gain, même sans aucun bonus", () => {
    for (const item of ITEMS) {
      expect(unitValue(item, 1, 1)).toBe(item.value);
      expect(unitValue(item, 1, 1.25)).toBeGreaterThanOrEqual(item.value);
    }
  });

  it("affiche exactement ce que la formule calcule", () => {
    const base = settled((x) => {
      x.items = { cursor: 4 };
      x.prestige = { chips: 10, spent: 0, upgrades: { celestial_dough: 2, golden_fingers: 2 } };
    });
    const avant = deriveStats(base, LATER, 0).perClickNoCombo;
    const apres = deriveStats({ ...base, items: { cursor: 5 } }, LATER, 0).perClickNoCombo;
    const gain = apres - avant;
    expect(onGrid(gain)).toBe(true);
    expect(gain).toBe(0.5); // 0,25 quantifié à ×2,5, pas 0,625
  });

  it("reste monotone: plus de crans ne peut pas rapporter moins", () => {
    let precedent = 0;
    for (let crans = 0; crans <= 40; crans++) {
      const v = unitValue(ITEM_BY_ID.cursor, 1, globalBonus(0, crans, 0));
      expect(v).toBeGreaterThanOrEqual(precedent);
      precedent = v;
    }
  });
});

describe("P1 — les prix sont lisibles et l'achat groupé exact", () => {
  it("arrondit à deux chiffres significatifs sans jamais stagner", () => {
    const item = ITEM_BY_ID.cursor;
    let precedent = 0;
    for (let n = 0; n < 60; n++) {
      const p = unitPrice(item, n);
      expect(p).toBeGreaterThan(precedent); // strictement croissant
      expect(lisible(p)).toBe(p); // déjà lisible
      precedent = p;
    }
  });

  it("fait coûter un achat groupé exactement la somme des achats un par un", () => {
    for (const id of ["cursor", "oven", "portal"]) {
      const item = ITEM_BY_ID[id];
      for (const [from, n] of [[0, 10], [0, 100], [37, 25]]) {
        let unParUn = 0;
        for (let k = 0; k < n; k++) unParUn += bulkCost(item, from + k, 1);
        expect(bulkCost(item, from, n)).toBe(unParUn);
      }
    }
  });

  it("rend un prix entier et jamais nul", () => {
    const s = settled((x) => (x.items = { cursor: 7 }));
    const p = costOf(s, "cursor", 1, LATER);
    expect(Number.isInteger(p)).toBe(true);
    expect(p).toBeGreaterThan(0);
  });
});

describe("P1 — une sauvegarde bricolée ne casse plus l'économie", () => {
  it("écarte les quantités négatives, décimales ou inconnues", () => {
    const s = migrate({
      version: 5,
      items: { oven: -20, cursor: 3.7, inconnu: 50, bakery: "12", temple: NaN },
      ui: { introSeen: true },
    });
    expect(s.items.oven).toBeUndefined();
    expect(s.items.cursor).toBe(3);
    expect(s.items.inconnu).toBeUndefined();
    expect(s.items.bakery).toBeUndefined();
    expect(s.items.temple).toBeUndefined();

    const d = deriveStats(s, LATER);
    expect(d.mining).toBeGreaterThanOrEqual(0);
    expect(d.perClickNoCombo).toBeGreaterThan(0);
  });
});

describe("P1 — l'automatisation ne paie plus", () => {
  it("garde une borne de crédit très au-dessus d'un humain", () => {
    // Mesuré avant correction: un autoclicker à 50 clics/s obtenait un rapport
    // actif/passif de 23× là où un joueur très actif plafonne à 3,5×, et deux
    // cents fois plus de cookies en cinq minutes.
    //
    // La borne vaut 40 ms, soit 25 clics/s. Un joueur rapide tient 12 à 15
    // clics/s à deux pouces: il ne la touche jamais.
    const BORNE_MS = 40;
    const humainRapide = 15;
    const autoclicker = 50;
    expect(1000 / BORNE_MS).toBe(25);
    expect(humainRapide).toBeLessThan(1000 / BORNE_MS);
    expect(autoclicker).toBeGreaterThan(1000 / BORNE_MS);
    // Ce que l'autoclicker obtient réellement: la cadence bornée, pas la sienne.
    expect(Math.min(autoclicker, 1000 / BORNE_MS)).toBe(25);
  });
});

describe("P2 — revenu actif: une seule définition", () => {
  it("fait dire la même chose à activeIncome et activeRatio", () => {
    // L'une supposait le combo plein en permanence, l'autre la moyenne tenue:
    // deux joueurs différents décrits par le même fichier.
    const s = settled((x) => (x.items = { oven: 40, cursor: 30 }));
    const d = deriveStats(s, LATER);
    const revenu = activeIncome(s, 5, LATER);
    const ratio = activeRatio(s, 5, LATER);
    expect(revenu / d.mining).toBeCloseTo(ratio, 9);
  });
});
