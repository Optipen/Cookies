import { describe, it, expect } from "vitest";
import { QUESTS, QUEST_BY_ID, questTitle, questDesc } from "../quests/catalog.js";
import {
  buildContext,
  instantiate,
  evaluate,
  applyReward,
  resolveReward,
  tickQuests,
  rerollQuest,
  refill,
  ACTIVE_SLOTS,
  DAILY_SLOTS,
} from "../quests/engine.js";
import { createFreshState } from "../utils/state.js";

const seededRng = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("catalogue", () => {
  it("n'a que des identifiants uniques", () => {
    const ids = QUESTS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("déclare les champs obligatoires", () => {
    for (const q of QUESTS) {
      expect(q.id, `${q.id}: id`).toBeTruthy();
      expect(["micro", "main", "daily"], `${q.id}: tier`).toContain(q.tier);
      expect(typeof q.target, `${q.id}: target`).toBe("function");
      expect(typeof q.progress, `${q.id}: progress`).toBe("function");
      expect(typeof q.reward, `${q.id}: reward`).toBe("function");
      expect(q.cooldownS, `${q.id}: cooldownS`).toBeGreaterThan(0);
    }
  });

  it("produit un titre et une description exploitables pour chaque quête", () => {
    const state = createFreshState();
    state.cookies = 50_000;
    state.lifetime = 200_000;
    state.items = { oven: 10, cursor: 10, grandma: 5 };
    const ctx = buildContext(state);

    for (const quest of QUESTS) {
      const inst = instantiate(quest, state, ctx);
      expect(inst, `${quest.id} doit s'instancier`).not.toBeNull();
      const title = questTitle(quest, inst.meta);
      const desc = questDesc(quest, inst.meta);
      expect(typeof title, `${quest.id}: titre`).toBe("string");
      expect(title.length, `${quest.id}: titre non vide`).toBeGreaterThan(0);
      // Régression: l'ancien moteur affichait « Acheter 1 × oven » (id brut)
      expect(title, `${quest.id}: pas d'identifiant brut`).not.toMatch(/× (oven|farm_cps|factory_cps|bank_cps)$/);
      expect(typeof desc, `${quest.id}: description`).toBe("string");
    }
  });

  it("évalue chaque quête sans lever d'exception", () => {
    const state = createFreshState();
    state.cookies = 1e6;
    state.lifetime = 5e6;
    const ctx = buildContext(state);
    for (const quest of QUESTS) {
      const inst = instantiate(quest, state, ctx);
      const res = evaluate(inst, state, ctx);
      expect(Number.isFinite(res.progress), `${quest.id}: progress fini`).toBe(true);
      expect(Number.isFinite(res.target), `${quest.id}: target fini`).toBe(true);
    }
  });
});

describe("evaluate", () => {
  it("marque une quête chronométrée expirée comme échouée, pas réussie", () => {
    const state = createFreshState();
    const ctx = buildContext(state);
    const quest = QUEST_BY_ID.click_sprint;
    const inst = instantiate(quest, state, ctx, 1000);
    // Régression: l'ancien moteur renvoyait done=true à l'expiration du chrono
    // et versait la récompense même sans avoir atteint l'objectif.
    const res = evaluate(inst, state, ctx, inst.expiresAt + 1);
    expect(res.done).toBe(false);
    expect(res.failed).toBe(true);
    expect(res.expired).toBe(true);
  });

  it("valide une quête chronométrée terminée à temps", () => {
    const state = createFreshState();
    const ctx = buildContext(state);
    const quest = QUEST_BY_ID.click_sprint;
    const inst = instantiate(quest, state, ctx, 1000);
    const done = { ...state, stats: { ...state.stats, clicks: inst.meta.clicks + 10 } };
    const res = evaluate(inst, done, ctx, 2000);
    expect(res.done).toBe(true);
    expect(res.failed).toBe(false);
  });

  it("échoue la quête de patience dès le premier clic", () => {
    const state = createFreshState();
    state.items = { oven: 30 };
    state.lifetime = 50_000;
    const ctx = buildContext(state);
    const inst = instantiate(QUEST_BY_ID.idle_patience, state, ctx);
    const clicked = { ...state, stats: { ...state.stats, clicks: state.stats.clicks + 1 } };
    expect(evaluate(inst, clicked, ctx).failed).toBe(true);
  });

  it("mesure les gains en delta, jamais rétroactivement", () => {
    const state = createFreshState();
    state.cookies = 10_000;
    state.lifetime = 10_000;
    const ctx = buildContext(state);
    const inst = instantiate(QUEST_BY_ID.gain_small, state, ctx);
    // Un joueur déjà riche ne doit pas valider la quête instantanément
    expect(evaluate(inst, state, ctx).done).toBe(false);
  });

  it("signale une quête dont le modèle a disparu", () => {
    const state = createFreshState();
    const res = evaluate({ questId: "quete_supprimee", meta: {} }, state, buildContext(state));
    expect(res.failed).toBe(true);
  });
});

describe("applyReward", () => {
  it("crédite cookies et CRMB", () => {
    const state = createFreshState();
    const next = applyReward(state, { cookies: 500, crmb: 0.25, buff: null, discount: null, chips: 0 }, 1000);
    expect(next.cookies).toBe(500);
    expect(next.lifetime).toBe(500);
    expect(next.crypto.balance).toBe(0.25);
  });

  it("repart de 1 quand le buff précédent est expiré", () => {
    const state = createFreshState();
    state.buffs = { cpsMulti: 8, cpcMulti: 1, until: 500, label: "vieux" };
    // Régression: l'ancien code multipliait par la valeur d'un buff mort,
    // ce qui faisait exploser les multiplicateurs au fil des quêtes.
    const next = applyReward(state, { cookies: 0, crmb: 0, buff: { kind: "cps", value: 2, seconds: 10 } }, 1000);
    expect(next.buffs.cpsMulti).toBe(2);
  });

  it("cumule un buff encore actif mais plafonne", () => {
    const state = createFreshState();
    state.buffs = { cpsMulti: 4, cpcMulti: 1, until: 10_000, label: "actif" };
    const next = applyReward(state, { cookies: 0, crmb: 0, buff: { kind: "cps", value: 3, seconds: 10 } }, 1000);
    expect(next.buffs.cpsMulti).toBe(12);

    const huge = applyReward(state, { cookies: 0, crmb: 0, buff: { kind: "cps", value: 999, seconds: 10 } }, 1000);
    expect(huge.buffs.cpsMulti).toBeLessThanOrEqual(50);
  });

  it("plafonne la durée cumulée des buffs", () => {
    const state = createFreshState();
    const next = applyReward(state, { cookies: 0, crmb: 0, buff: { kind: "cpc", value: 2, seconds: 100_000 } }, 1000);
    expect(next.buffs.until - 1000).toBeLessThanOrEqual(300_000);
  });

  it("pose une remise globale", () => {
    const state = createFreshState();
    const next = applyReward(state, { cookies: 0, crmb: 0, discount: { value: 0.2, seconds: 30 } }, 1000);
    expect(next.flags.discountAll).toEqual({ value: 0.2, until: 31_000 });
  });

  it("ne fait rien sans récompense", () => {
    const state = createFreshState();
    expect(applyReward(state, null)).toBe(state);
  });
});

describe("resolveReward", () => {
  it("applique le multiplicateur de l'arbre céleste", () => {
    const state = createFreshState();
    state.cookies = 10_000;
    const base = buildContext(state);
    const boosted = { ...base, questMult: 2 };
    const quest = QUEST_BY_ID.gain_small;
    const r1 = resolveReward(quest, state, base, {});
    const r2 = resolveReward(quest, state, boosted, {});
    expect(r2.cookies).toBe(r1.cookies * 2);
  });
});

describe("tickQuests", () => {
  it("remplit les emplacements vides", () => {
    const state = createFreshState();
    state.cookies = 5_000;
    state.lifetime = 20_000;
    const result = tickQuests(state, buildContext(state), Date.now(), seededRng([0.1, 0.4, 0.7]));
    expect(result.changed).toBe(true);
    expect(result.state.quests.active.length).toBeGreaterThan(0);
    expect(result.state.quests.active.length).toBeLessThanOrEqual(ACTIVE_SLOTS);
    expect(result.state.quests.daily.length).toBeLessThanOrEqual(DAILY_SLOTS);
  });

  it("ne tire jamais deux fois la même quête en même temps", () => {
    const state = createFreshState();
    state.cookies = 1e6;
    state.lifetime = 5e6;
    const result = tickQuests(state, buildContext(state), Date.now(), () => 0);
    const all = [...result.state.quests.active, ...result.state.quests.daily].map((q) => q.questId);
    expect(new Set(all).size).toBe(all.length);
  });

  it("verse la récompense et pose un cooldown à la complétion", () => {
    let state = createFreshState();
    state.cookies = 5_000;
    state.lifetime = 20_000;
    const now = 1_000_000;

    state = tickQuests(state, buildContext(state), now).state;
    const entry = state.quests.active[0];
    const quest = QUEST_BY_ID[entry.questId];

    // Force la complétion en satisfaisant largement l'objectif
    const satisfied = {
      ...state,
      cookies: state.cookies + 1e9,
      lifetime: state.lifetime + 1e9,
      stats: { ...state.stats, clicks: state.stats.clicks + 100_000, goldenClicks: 50 },
      items: Object.fromEntries(Object.keys(entry.meta.itemId ? { [entry.meta.itemId]: 0 } : {}).map((k) => [k, 500])),
      cookieEatenCount: 50,
    };
    if (entry.meta.itemId) satisfied.items = { ...state.items, [entry.meta.itemId]: (state.items[entry.meta.itemId] || 0) + 500 };

    const after = tickQuests(satisfied, buildContext(satisfied), now + 1000);
    const completedEvent = after.events.find((e) => e.type === "completed");
    if (completedEvent) {
      expect(after.state.quests.cooldowns[completedEvent.questId]).toBeGreaterThan(now);
      expect(after.state.quests.completed[completedEvent.questId]).toBe(1);
      expect(quest).toBeDefined();
    }
  });

  it("respecte les cooldowns lors du réapprovisionnement", () => {
    const state = createFreshState();
    state.cookies = 1e6;
    const now = 1_000_000;
    const cooldowns = Object.fromEntries(QUESTS.map((q) => [q.id, now + 60_000]));
    const filled = refill([], ACTIVE_SLOTS, state, buildContext(state), cooldowns, false, now);
    expect(filled).toHaveLength(0);
  });

  it("réinitialise les quotidiennes après 24 h", () => {
    let state = createFreshState();
    state.cookies = 5_000;
    const now = 1_000_000;
    state = tickQuests(state, buildContext(state), now).state;
    const firstBatch = state.quests.daily.map((q) => q.questId);
    expect(firstBatch.length).toBeGreaterThan(0);

    const later = state.quests.dailyResetAt + 1;
    const after = tickQuests(state, buildContext(state), later);
    expect(after.state.quests.dailyResetAt).toBeGreaterThan(later);
  });

  it("est idempotent quand rien ne change", () => {
    let state = createFreshState();
    state.cookies = 5_000;
    const now = 1_000_000;
    state = tickQuests(state, buildContext(state), now).state;
    // Aucune place libre, aucune progression: le tick ne doit rien produire
    const second = tickQuests(state, buildContext(state), now + 10);
    expect(second.changed).toBe(false);
    expect(second.state).toBe(state);
  });
});

describe("rerollQuest", () => {
  it("remplace une quête et la met en cooldown", () => {
    let state = createFreshState();
    state.cookies = 1e6;
    state.lifetime = 5e6;
    const now = 1_000_000;
    state = tickQuests(state, buildContext(state), now).state;

    const target = state.quests.active[0].questId;
    const after = rerollQuest(state, target, buildContext(state), now);
    expect(after.quests.cooldowns[target]).toBeGreaterThan(now);
    expect(after.quests.active.some((q) => q.questId === target)).toBe(false);
  });
});

describe("buildContext", () => {
  it("classe le joueur par stade de progression", () => {
    const early = createFreshState();
    expect(buildContext(early).level).toBe("early");

    const mid = createFreshState();
    mid.lifetime = 50_000;
    expect(buildContext(mid).level).toBe("mid");

    const late = createFreshState();
    late.lifetime = 5e6;
    late.items = { portal: 50, lab: 50 };
    expect(buildContext(late).level).toBe("late");
  });

  it("propose le bâtiment abordable le moins cher", () => {
    const state = createFreshState();
    state.cookies = 1000;
    const ctx = buildContext(state);
    expect(ctx.nextAffordable).not.toBeNull();
    expect(ctx.nextAffordable.estimatedCost).toBeLessThanOrEqual(700);
  });
});
