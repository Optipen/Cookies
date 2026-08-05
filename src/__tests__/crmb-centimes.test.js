// === La règle définitive des nombres — volet CRMB ===
//
// Le CRMB est l'exception assumée: précision au CENTIÈME, partout — solde,
// récompenses, extraction, staking, achats, ventes, frais, cours. Le solde ne
// porte jamais plus de deux décimales (l'équivalent de centimes entiers), et
// aucune fraction sous le centime ne se perd: elle s'accumule et se verse dès
// qu'un centime est plein.

import { describe, expect, it } from "vitest";
import {
  roundCrmb,
  addCrmb,
  accrueCrmb,
  coutAchatCrmb,
  gainVenteCrmb,
  stepMarket,
  defaultCryptoState,
  CRMB,
} from "../utils/crypto.js";
import { offlineGains } from "../utils/offline.js";
import { deriveStats } from "../utils/selectors.js";
import { createFreshState } from "../utils/state.js";

const estCentimes = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-7;

describe("le solde vit en centimes", () => {
  it("roundCrmb arrondit au centième, jamais plus fin", () => {
    expect(roundCrmb(0.015)).toBeCloseTo(0.02, 10);
    expect(roundCrmb(1.004)).toBeCloseTo(1, 10);
    expect(roundCrmb(0.1 + 0.2)).toBeCloseTo(0.3, 10);
    expect(estCentimes(roundCrmb(Math.PI))).toBe(true);
  });

  it("addCrmb garde le solde en centimes et rejette le delta fautif SEUL", () => {
    expect(addCrmb(1.5, 0.05)).toBeCloseTo(1.55, 10);
    expect(addCrmb(1.55, NaN)).toBeCloseTo(1.55, 10);
    expect(addCrmb(1.55, Infinity)).toBeCloseTo(1.55, 10);
    expect(addCrmb(NaN, 5)).toBeCloseTo(5, 10);
    expect(estCentimes(addCrmb(0.333, 0.333))).toBe(true);
  });

  it("l'accumulateur ne perd aucune fraction sous le centime", () => {
    // Un vieux GPU: 0,05 CRMB/h, soit ~7 millionièmes par tic de 500 ms.
    // Arrondi au centime à chaque tic, il ne verserait JAMAIS rien.
    let crypto = { ...defaultCryptoState(0), balance: 0, pending: 0 };
    const parTic = 0.05 / 3600 / 2;
    for (let i = 0; i < 3 * 3600 * 2; i++) {
      crypto = accrueCrmb(crypto, parTic);
      expect(estCentimes(crypto.balance)).toBe(true);
    }
    // Trois heures à 0,05/h = 0,15: tout doit être arrivé, au centime près.
    expect(crypto.balance).toBeCloseTo(0.15, 2);
    expect(crypto.balance + crypto.pending).toBeCloseTo(0.15, 6);
  });

  it("l'accumulateur rejette un brut invalide sans toucher au solde", () => {
    const base = { ...defaultCryptoState(0), balance: 2.5, pending: 0.004 };
    for (const brut of [NaN, Infinity, -1]) {
      const apres = accrueCrmb(base, brut);
      expect(apres.balance).toBe(2.5);
      expect(apres.pending).toBe(0.004);
    }
  });
});

describe("le marché et ses frais restent propres", () => {
  it("le cours est un entier de cookies", () => {
    let crypto = defaultCryptoState(0);
    let rngIdx = 0;
    const rng = () => [0.1, 0.9, 0.4, 0.7, 0.2, 0.6][rngIdx++ % 6];
    for (let i = 0; i < 200; i++) {
      const { price, priceHistory } = stepMarket(crypto, 10 ** (6 + (i % 6)), rng);
      expect(Number.isInteger(price), `pas ${i}: ${price}`).toBe(true);
      crypto = { ...crypto, price, priceHistory };
    }
  });

  it("l'achat coûte un entier de cookies, la vente en rend un entier", () => {
    for (const price of [20_000, 20_941, 33_333]) {
      for (const amount of [0.01, 0.5, 1, 5, 25]) {
        const cout = coutAchatCrmb(price, amount);
        const gain = gainVenteCrmb(price, amount);
        expect(Number.isInteger(cout), `coût ${price} × ${amount}`).toBe(true);
        expect(Number.isInteger(gain), `gain ${price} × ${amount}`).toBe(true);
        // Les frais de 2 % restent des frais: acheter puis revendre perd.
        expect(gain).toBeLessThan(cout);
        // Et personne ne paie moins que la valeur: l'arrondi va au cent SUPÉRIEUR
        // à l'achat, INFÉRIEUR à la vente.
        expect(cout).toBeGreaterThanOrEqual(price * amount * (1 + CRMB.spread) - 1);
        expect(gain).toBeLessThanOrEqual(price * amount * (1 - CRMB.spread));
      }
    }
  });
});

describe("l'extraction s'affiche comme elle crédite", () => {
  it("le taux effectif est posé au centième par heure", () => {
    const s = createFreshState(0);
    s.crypto.miners = { gpu: 1 };
    s.prestige = { chips: 0, spent: 0, upgrades: { crypto_edge: 1 } }; // ×1,25
    const stats = deriveStats(s, 0);
    const parHeure = stats.crmbRate * 3600;
    // 0,05 × 1,25 = 0,0625 → posé à 0,06: l'écran et le crédit disent pareil.
    expect(parHeure).toBeCloseTo(0.06, 10);
    expect(estCentimes(parHeure)).toBe(true);
  });
});

describe("le retour hors-ligne verse des centimes entiers", () => {
  it("plafonne le CRMB hors-ligne au centième, sans fraction fantôme", () => {
    const s = createFreshState(0);
    s.crypto.miners = { gpu: 2 }; // 0,10/h → 2 h plafonnées × 50 % = 0,10
    const gains = offlineGains(s, 2 * 3600 * 1000, 0);
    expect(estCentimes(gains.crmb)).toBe(true);
    expect(gains.crmb).toBeCloseTo(0.1, 10);
  });

  it("les cookies hors-ligne suivent la règle des valeurs", () => {
    const s = createFreshState(0);
    s.items = { oven: 400, bakery: 60 }; // un minage confortable
    const gains = offlineGains(s, 45 * 60 * 1000, 0);
    expect(gains.cookies).toBeGreaterThan(100);
    expect(Number.isInteger(gains.cookies), `cookies ${gains.cookies}`).toBe(true);
  });
});
