import { describe, it, expect } from "vitest";
import {
  addCrmb,
  roundCrmb,
  miningRate,
  stakingYieldPerSecond,
  stakingTier,
  MINERS,
  STAKE_TIERS,
  ledgerCost,
  ledgerSteps,
  LEDGER_FIRST,
} from "../utils/crypto.js";
import { deriveStats } from "../utils/selectors.js";
import { createFreshState, migrate } from "../utils/state.js";
import { globalBonus } from "../utils/calc.js";
import { onGrid, niceIntAt } from "../utils/grid.js";
import { CRMB_PAR_PRESTIGE } from "../data/prestige.js";
import { CRMB_PAR_PALIER } from "../data/achievements.js";
import { QUESTS } from "../quests/catalog.js";

const LATER = 6e5;
const partie = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  mutate(s);
  return s;
};

describe("un solde valide n'est jamais détruit par un calcul invalide", () => {
  it("rejette le seul delta fautif et garde le solde", () => {
    // La règle, et elle prime sur tout le reste ici: si un nouveau calcul
    // produit une valeur non finie, on rejette CE calcul. On ne remet pas le
    // solde du joueur à zéro parce qu'un rendement s'est mal calculé.
    for (const mauvais of [NaN, Infinity, -Infinity, undefined, null, "abc", {}]) {
      expect(addCrmb(42.5, mauvais), `delta ${String(mauvais)}`).toBe(42.5);
    }
  });

  it("additionne normalement un delta valide", () => {
    expect(addCrmb(0, 1)).toBe(1);
    expect(addCrmb(42.5, 2.25)).toBe(44.75);
    expect(addCrmb(10, -3)).toBe(7);
  });

  it("ne descend jamais sous zéro", () => {
    expect(addCrmb(1, -5)).toBe(0);
    expect(addCrmb(0, -1)).toBe(0);
  });

  it("ne laisse pas un solde déjà corrompu contaminer la suite", () => {
    // Il n'y a alors plus de « dernier solde valide » à conserver: on repart de
    // zéro, mais on ne propage jamais le NaN.
    for (const mauvais of [NaN, Infinity, undefined, -5]) {
      const r = addCrmb(mauvais, 3);
      expect(Number.isFinite(r), `solde ${String(mauvais)}`).toBe(true);
      expect(r).toBeGreaterThanOrEqual(0);
    }
  });

  it("ne dérive pas au bout de cent mille additions", () => {
    let solde = 0;
    for (let i = 0; i < 100_000; i++) solde = addCrmb(solde, 0.1);
    expect(solde).toBeCloseTo(10_000, 3);
  });

  it("garde un solde fini après une migration d'état corrompu", () => {
    const s = migrate({ version: 5, crypto: { balance: NaN, totalEarned: Infinity } });
    expect(Number.isFinite(s.crypto.balance)).toBe(true);
    expect(Number.isFinite(s.crypto.totalEarned)).toBe(true);
    expect(s.crypto.balance).toBeGreaterThanOrEqual(0);
  });

  it("arrondit sans jamais rendre une valeur non finie", () => {
    for (const n of [NaN, Infinity, -Infinity, undefined]) expect(roundCrmb(n)).toBe(0);
    expect(roundCrmb(1.2345678)).toBeCloseTo(1.234568, 6);
  });
});

describe("les trois sources de CRMB fonctionnent vraiment", () => {
  it("crédite le matériel de minage", () => {
    const s = partie((x) => (x.crypto.miners = { cpu: 3, gpu: 1 }));
    const d = deriveStats(s, LATER);
    expect(d.crmbRate).toBeGreaterThan(0);
    expect(d.crmbRate * 3600).toBeCloseTo(3 * 0.05 + 0.25, 6);
    expect(d.miningRate).toBeUndefined(); // le nom fautif ne doit pas réapparaître
  });

  it("crédite le staking", () => {
    const s = partie((x) => {
      x.crypto.positions = [{ id: "p", amount: 100, tierId: "flex", startedAt: 0, unlockAt: 0 }];
    });
    const d = deriveStats(s, LATER);
    expect(d.stakingYield * 86_400).toBeCloseTo(1, 6); // 1 %/jour sur 100 CRMB
  });

  it("donne un boost de staking sur la grille", () => {
    for (const montant of [0, 1, 2.5, 7, 42, 1000, 1e6]) {
      const t = stakingTier([{ amount: montant, tierId: "long" }]);
      expect(onGrid(t.mult), `${montant} CRMB → ×${t.mult}`).toBe(true);
    }
  });

  it("verse le prestige en nombre entier et rond", () => {
    expect(Number.isInteger(CRMB_PAR_PRESTIGE)).toBe(true);
    expect([1, 2, 5, 10]).toContain(CRMB_PAR_PRESTIGE);
  });
});

describe("le CRMB reste rare", () => {
  it("ne se gagne jamais en cuisant des cookies", () => {
    // Le faucet historique versait 0,001 CRMB tous les 20 000 cookies, soit des
    // centaines de millions en fin de partie.
    const avant = partie((x) => (x.lifetime = 0));
    const apres = partie((x) => (x.lifetime = 1e18));
    expect(deriveStats(apres, LATER).crmbRate).toBe(deriveStats(avant, LATER).crmbRate);
    expect(deriveStats(apres, LATER).crmbRate).toBe(0);
  });

  it("ne verse que des montants ronds", () => {
    const propres = new Set([1, 2, 5, 10]);
    for (const q of QUESTS) {
      const r = q.reward?.({}, { cps: 1, cpc: 1, bank: 0, crmbPrice: 20_000 });
      if (r?.crmb) expect(propres.has(r.crmb), `${q.id} verse ${r.crmb}`).toBe(true);
    }
    for (const [palier, v] of Object.entries(CRMB_PAR_PALIER)) {
      if (v > 0) expect(propres.has(v), `palier ${palier} verse ${v}`).toBe(true);
    }
  });

  it("n'a aucune source illimitée sans effort", () => {
    // Le matériel se paie en cookies et rapporte peu: le meilleur rig donne
    // 25 CRMB par heure pour cinq cents milliards de cookies.
    for (const m of MINERS) {
      expect(m.perHour).toBeLessThanOrEqual(25);
      expect(m.base).toBeGreaterThanOrEqual(1e7);
    }
    // Le staking rend au plus 0,1 % par jour: il ne double jamais une mise.
    for (const t of STAKE_TIERS) expect(t.perDay).toBeLessThanOrEqual(0.1);
    expect(miningRate({})).toBe(0);
    expect(stakingYieldPerSecond([])).toBe(0);
  });

  it("ne rend pas toutes les apparences accessibles en quelques minutes", async () => {
    const { SKIN_LIST } = await import("../data/skins.js");
    const total = SKIN_LIST.reduce((a, s) => a + (s.crmb || 0), 0);
    // Trente-cinq CRMB: à un ou deux par quête, c'est plusieurs sessions.
    expect(total).toBeGreaterThanOrEqual(25);
  });
});

describe("le Registre: un puits qui ne se tarit pas", () => {
  it("commence à un prix rond et suit l'échelle des nombres agréables", () => {
    expect(ledgerCost(0)).toBe(niceIntAt(LEDGER_FIRST));
    let precedent = 0;
    for (let n = 0; n < 30; n++) {
      const p = ledgerCost(n);
      expect(p, `contrat ${n}`).toBeGreaterThan(precedent);
      expect(Number.isInteger(p)).toBe(true);
      precedent = p;
    }
  });

  it("ne devient jamais gratuit ni infini sur une partie très longue", () => {
    for (const n of [0, 10, 50, 100]) {
      const p = ledgerCost(n);
      expect(Number.isFinite(p), `contrat ${n}`).toBe(true);
      expect(p).toBeGreaterThan(0);
    }
  });

  it("apporte des crans de grille, jamais un pourcentage", () => {
    for (const n of [0, 1, 7, 40, 1000]) {
      expect(Number.isInteger(ledgerSteps(n))).toBe(true);
      expect(onGrid(globalBonus(0, 0, ledgerSteps(n)))).toBe(true);
    }
    expect(ledgerSteps(0)).toBe(0);
    expect(ledgerSteps(4)).toBe(4);
    expect(ledgerSteps(-3)).toBe(0);
    expect(ledgerSteps(NaN)).toBe(0);
  });

  it("relance les DEUX axes à la fois, sans toucher au rapport actif/passif", () => {
    // Un puits qui ne pousserait qu'un seul axe déplacerait l'équilibre du jeu
    // à chaque achat. Celui-ci pousse les deux du même cran.
    //
    // On mesure sur la Mamie et non sur le Curseur: le Curseur est le seul
    // bâtiment dont la valeur de base n'est pas entière, et la quantification
    // par exemplaire ramène son 0,625 à 0,50 pour rester sur la grille. Il
    // monte donc par paliers légèrement décalés — c'est voulu, et c'est le
    // sujet d'un autre test.
    const parc = { oven: 40, grandma: 40 };
    const a = deriveStats(partie((x) => (x.items = parc)), LATER, 0);
    const b = deriveStats(
      partie((x) => {
        x.items = parc;
        x.crypto.ledger = 6;
      }),
      LATER,
      0
    );
    expect(b.mining).toBeGreaterThan(a.mining);
    expect(b.perClickNoCombo).toBeGreaterThan(a.perClickNoCombo);
    expect(b.mining / a.mining).toBeCloseTo(b.buildingsPower / a.buildingsPower, 6);
    expect(b.mineMult).toBe(b.clickMult);
  });

  it("ne fait jamais reculer le Curseur, même s'il ne suit pas exactement", () => {
    // Sa valeur de base, 0,25, est la seule non entière du catalogue: elle est
    // quantifiée vers le bas pour rester sur la grille. Le gain est donc parfois
    // en retard d'un cran, jamais négatif ni nul.
    let precedent = 0;
    for (let n = 0; n <= 40; n++) {
      const d = deriveStats(
        partie((x) => {
          x.items = { cursor: 1 };
          x.crypto.ledger = n;
        }),
        LATER,
        0
      );
      expect(d.buildingsPower).toBeGreaterThanOrEqual(precedent);
      expect(onGrid(d.buildingsPower), `${n} contrats → ${d.buildingsPower}`).toBe(true);
      precedent = d.buildingsPower;
    }
  });

  it("survit au prestige: c'est un achat définitif", () => {
    const s = partie((x) => (x.crypto.ledger = 12));
    expect(migrate(JSON.parse(JSON.stringify(s))).crypto.ledger).toBe(12);
  });

  it("écarte un compteur bricolé dans la sauvegarde", () => {
    for (const mauvais of [-5, NaN, Infinity, "12", null, 3.7]) {
      const s = migrate({ version: 5, crypto: { ledger: mauvais } });
      expect(Number.isInteger(s.crypto.ledger), `ledger ${String(mauvais)}`).toBe(true);
      expect(s.crypto.ledger).toBeGreaterThanOrEqual(0);
    }
    expect(migrate({ version: 5, crypto: { ledger: 3.7 } }).crypto.ledger).toBe(3);
  });
});
