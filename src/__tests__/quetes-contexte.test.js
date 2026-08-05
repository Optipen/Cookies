// === Quêtes: le contexte dit la vérité ===
//
// Deux mensonges attrapés par l'audit:
//
// 1. `buildContext` passait `stakingBoost(positions)` — un MULTIPLICATEUR,
//    ×1 au minimum — là où `cpsFrom` attend des CRANS. Résultat: un cran
//    fantôme permanent, même sans le moindre staking, et un `ctx.cps` gonflé
//    de +0,25 de bonus global — cibles et récompenses calibrées sur un minage
//    qui n'existe pas.
// 2. La carte de quête affichait la récompense CRMB multipliée par le bonus
//    de l'arbre céleste (« +1,25 CRMB »), alors que le moteur ne l'applique
//    QU'AUX cookies — le joueur recevait 1. L'affiché doit être le crédité.

import { describe, expect, it } from "vitest";
import { buildContext, resolveReward } from "../quests/engine.js";
import { deriveStats } from "../utils/selectors.js";
import { createFreshState } from "../utils/state.js";

const partie = (patch) => {
  const s = createFreshState(0);
  patch?.(s);
  return s;
};

describe("le contexte de quête mesure le vrai minage", () => {
  it("sans staking, ctx.cps est EXACTEMENT le minage du moteur", () => {
    const s = partie((x) => {
      x.items = { oven: 13, bakery: 4 };
    });
    const ctx = buildContext(s);
    expect(ctx.cps).toBe(deriveStats(s, 0).baseMining);
  });

  it("avec staking, le boost compte en crans, pas en multiplicateur-pris-pour-des-crans", () => {
    const s = partie((x) => {
      x.items = { oven: 13, bakery: 4 };
      x.crypto.positions = [{ id: "p", amount: 10, tierId: "flex", startedAt: 0, unlockAt: 0 }];
    });
    const ctx = buildContext(s);
    expect(ctx.cps).toBe(deriveStats(s, 0).baseMining);
  });
});

describe("la récompense affichée est la récompense versée", () => {
  it("le bonus de quête ne s'applique qu'aux cookies, jamais au CRMB", () => {
    const s = partie((x) => {
      x.prestige = { chips: 0, spent: 0, upgrades: { quest_master: 2 } }; // ×1,5
    });
    const ctx = buildContext(s);
    expect(ctx.questMult).toBe(1.5);
    const quete = {
      reward: () => ({ cookies: 1000, crmb: 2 }),
    };
    const paquet = resolveReward(quete, s, ctx, {});
    expect(paquet.cookies).toBe(1500);
    expect(paquet.crmb).toBe(2); // PAS 3: une monnaie de récompense reste entière
  });
});
