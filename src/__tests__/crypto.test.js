import { describe, it, expect } from "vitest";
import {
  CRMB,
  MINERS,
  STAKE_TIERS,
  getTier,
  defaultCryptoState,
  anchorPrice,
  stepMarket,
  buyPrice,
  sellPrice,
  priceTrend,
  minerCost,
  miningRate,
  stakedTotal,
  stakingBoost,
  stakingYieldPerSecond,
  isUnlocked,
  roundCrmb,
} from "../utils/crypto.js";

describe("marché", () => {
  it("garde le prix dans ses bornes même avec un générateur extrême", () => {
    let crypto = defaultCryptoState(0);
    const anchor = anchorPrice(0);
    // 500 pas avec le bruit maximal vers le haut
    for (let i = 0; i < 500; i++) {
      crypto = { ...crypto, ...stepMarket(crypto, 0, () => 1) };
    }
    expect(crypto.price).toBeLessThanOrEqual(anchor * CRMB.maxPriceFactor + 1);

    crypto = defaultCryptoState(0);
    for (let i = 0; i < 500; i++) {
      crypto = { ...crypto, ...stepMarket(crypto, 0, () => 0) };
    }
    expect(crypto.price).toBeGreaterThanOrEqual(anchor * CRMB.minPriceFactor - 1);
    expect(crypto.price).toBeGreaterThan(0);
  });

  it("limite la longueur de l'historique", () => {
    let crypto = defaultCryptoState(0);
    for (let i = 0; i < CRMB.historyLength * 3; i++) {
      crypto = { ...crypto, ...stepMarket(crypto, 0, () => 0.5) };
    }
    expect(crypto.priceHistory.length).toBe(CRMB.historyLength);
  });

  it("revient vers son ancre", () => {
    // Un prix très bas doit remonter avec un bruit neutre
    let crypto = { ...defaultCryptoState(0), price: anchorPrice(0) * 0.4 };
    const start = crypto.price;
    for (let i = 0; i < 40; i++) {
      crypto = { ...crypto, ...stepMarket(crypto, 0, () => 0.5) };
    }
    expect(crypto.price).toBeGreaterThan(start);
  });

  it("monte l'ancre avec la progression du joueur", () => {
    expect(anchorPrice(1e9)).toBeGreaterThan(anchorPrice(1e3));
  });

  it("applique un spread défavorable dans les deux sens", () => {
    const price = 1000;
    expect(buyPrice(price)).toBeGreaterThan(price);
    expect(sellPrice(price)).toBeLessThan(price);
    // Acheter puis revendre immédiatement doit être perdant
    expect(sellPrice(price)).toBeLessThan(buyPrice(price));
  });

  it("calcule la tendance sur l'historique", () => {
    expect(priceTrend([100, 110])).toBeCloseTo(0.1);
    expect(priceTrend([100, 90])).toBeCloseTo(-0.1);
    expect(priceTrend([])).toBe(0);
    expect(priceTrend([100])).toBe(0);
  });
});

describe("minage", () => {
  it("renchérit à chaque exemplaire", () => {
    const first = minerCost("cpu", 0);
    const tenth = minerCost("cpu", 10);
    expect(tenth).toBeGreaterThan(first);
    expect(minerCost("inconnu", 0)).toBe(Infinity);
  });

  it("additionne les débits du matériel", () => {
    expect(miningRate({})).toBe(0);
    expect(miningRate({ cpu: 2 })).toBeCloseTo(MINERS[0].rate * 2);
    expect(miningRate({ cpu: 1, gpu: 1 })).toBeCloseTo(MINERS[0].rate + MINERS[1].rate);
  });
});

describe("staking", () => {
  it("totalise les positions", () => {
    expect(stakedTotal([])).toBe(0);
    expect(stakedTotal([{ amount: 1 }, { amount: 0.5 }])).toBe(1.5);
  });

  it("applique des rendements décroissants", () => {
    const one = stakingBoost([{ amount: 1, tierId: "flex" }]);
    const hundred = stakingBoost([{ amount: 100, tierId: "flex" }]);
    expect(one).toBeGreaterThan(1);
    expect(hundred).toBeGreaterThan(one);
    // 100× la mise ne doit pas donner 100× le bonus
    expect(hundred - 1).toBeLessThan((one - 1) * 100);
  });

  it("récompense les paliers longs", () => {
    const flex = stakingBoost([{ amount: 1, tierId: "flex" }]);
    const long = stakingBoost([{ amount: 1, tierId: "long" }]);
    expect(long).toBeGreaterThan(flex);
  });

  it("rend un boost neutre sans position", () => {
    expect(stakingBoost([])).toBe(1);
    expect(stakingYieldPerSecond([])).toBe(0);
  });

  it("calcule un rendement annuel cohérent", () => {
    const perSecond = stakingYieldPerSecond([{ amount: 100, tierId: "flex" }]);
    const perYear = perSecond * 365 * 24 * 3600;
    expect(perYear).toBeCloseTo(100 * getTier("flex").apr, 4);
  });

  it("respecte le verrou temporel", () => {
    expect(isUnlocked({ unlockAt: 0 }, 1000)).toBe(true);
    expect(isUnlocked({ unlockAt: 5000 }, 1000)).toBe(false);
  });

  it("retombe sur le palier flexible si l'identifiant est inconnu", () => {
    expect(getTier("nawak").id).toBe("flex");
    expect(STAKE_TIERS[0].lockMs).toBe(0);
  });
});

describe("roundCrmb", () => {
  it("évite l'accumulation d'erreurs flottantes", () => {
    let balance = 0;
    for (let i = 0; i < 10; i++) balance = roundCrmb(balance + 0.1);
    expect(balance).toBe(1);
  });
});
