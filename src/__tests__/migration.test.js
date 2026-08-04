import { describe, it, expect } from "vitest";
import { migrate, createFreshState } from "../utils/state.js";
import { deriveStats } from "../utils/selectors.js";
import { getUpgrade } from "../data/upgrades.js";
import { ITEM_BY_ID } from "../data/items.js";

// Sauvegardes réelles telles que les versions précédentes les écrivaient.
// Elles doivent toutes se charger sans perte de progression ni valeur aberrante.

const SAVE_V3 = {
  version: 3,
  cookies: 45_000,
  lifetime: 120_000,
  items: { oven: 30, cursor: 45, grandma: 20, farm: 8 },
  upgrades: { cursor_10: true, grandma_10: true, oven_10: true, global_s: true },
  prestige: { chips: 4 },
  ui: { sounds: false, introSeen: true },
  stats: { clicks: 3200, goldenClicks: 12 },
  mission: { id: "reach_500", startedAt: 1, completed: false },
};

const SAVE_V4 = {
  version: 4,
  cookies: 8.5e9,
  lifetime: 4.2e10,
  items: { oven: 120, bakery: 85, farm_cps: 60, factory_cps: 40, cursor: 150, grandma: 110, farm: 70, tm: 12 },
  upgrades: { cursor_10: true, cursor_25: true, farmcps_10: true, cpc_1: true },
  prestige: { chips: 42 },
  crypto: { name: "CrumbCoin", symbol: "CRMB", balance: 3.48, staked: 0.25, mintedUnits: 2_100_000 },
  ui: { sounds: true, introSeen: true, highContrast: false },
  stats: { clicks: 18_420, goldenClicks: 63 },
  activeMission: { templateId: "reach_bank_dynamic" },
  missionsState: { history: [] },
  combo: { value: 3 },
};

// Version intermédiaire de cette refonte: identifiants d'améliorations
// aujourd'hui supprimés (`share:`, `cpc:`, `click:`).
const SAVE_V5_INTERMEDIAIRE = {
  version: 5,
  cookies: 1e12,
  lifetime: 5e13,
  items: { oven: 200, cursor: 180, singularity: 3 },
  upgrades: { "tier:oven:0": true, "tier:cursor:1": true, "share:0": true, "share:1": true, "cpc:0": true, "click:2": true },
  prestige: { chips: 900, spent: 100, upgrades: { celestial_dough: 12 } },
  ui: { sounds: true, introSeen: true },
  stats: { clicks: 90_000 },
  quests: { active: [], daily: [], cooldowns: {}, completed: { gain_small: 12 }, streak: 4 },
};

const chargeable = (s) => {
  const stats = deriveStats(s, 6e5);
  expect(Number.isFinite(stats.mining)).toBe(true);
  expect(Number.isFinite(stats.perClick)).toBe(true);
  expect(stats.mining).toBeGreaterThanOrEqual(0);
  expect(stats.perClick).toBeGreaterThan(0);
  return stats;
};

describe("migration des anciennes sauvegardes", () => {
  it("charge une sauvegarde v3 sans perdre les bâtiments", () => {
    const s = migrate(SAVE_V3);
    expect(s.version).toBe(5);
    expect(s.cookies).toBe(45_000);
    expect(s.items.oven).toBe(30);
    expect(s.items.cursor).toBe(45);
    expect(s.prestige.chips).toBe(4);
    expect(s.ui.sounds).toBe(false);
    chargeable(s);
  });

  it("charge une sauvegarde v4 et convertit le staking", () => {
    const s = migrate(SAVE_V4);
    expect(s.cookies).toBe(8.5e9);
    expect(s.items.factory_cps).toBe(40);
    expect(s.crypto.balance).toBe(3.48);
    expect(s.crypto.positions).toHaveLength(1);
    expect(s.crypto.positions[0]).toMatchObject({ amount: 0.25, tierId: "flex" });
    expect(s.crypto.staked).toBeUndefined();
    chargeable(s);
  });

  it("écarte les identifiants d'améliorations disparus", () => {
    // Les anciens `cursor_10`, `global_s`, `share:0`, `cpc:0`, `click:2` n'ont
    // plus d'effet: les garder gonflerait le compteur sans rien produire.
    const v3 = migrate(SAVE_V3);
    expect(Object.keys(v3.upgrades)).toHaveLength(0);

    const v5 = migrate(SAVE_V5_INTERMEDIAIRE);
    expect(v5.upgrades["tier:oven:0"]).toBe(true);
    expect(v5.upgrades["tier:cursor:1"]).toBe(true);
    expect(v5.upgrades["share:0"]).toBeUndefined();
    expect(v5.upgrades["cpc:0"]).toBeUndefined();
    expect(v5.upgrades["click:2"]).toBeUndefined();

    for (const id of Object.keys(v5.upgrades)) {
      expect(getUpgrade(id), `${id} doit être résoluble`).not.toBeNull();
    }
  });

  it("conserve prestige, quêtes et succès de la v5 intermédiaire", () => {
    const s = migrate(SAVE_V5_INTERMEDIAIRE);
    expect(s.prestige.chips).toBe(900);
    expect(s.prestige.spent).toBe(100);
    expect(s.prestige.upgrades.celestial_dough).toBe(12);
    expect(s.quests.completed.gain_small).toBe(12);
    expect(s.quests.streak).toBe(4);
    chargeable(s);
  });

  it("garde tous les identifiants de bâtiments d'origine", () => {
    // Les huit Mineurs et les sept Cliqueurs historiques existent toujours:
    // aucune sauvegarde ne perd de bâtiment.
    for (const id of ["oven", "bakery", "farm_cps", "factory_cps", "bank_cps", "temple", "lab", "portal"]) {
      expect(ITEM_BY_ID[id], `${id} doit exister`).toBeDefined();
      expect(ITEM_BY_ID[id].mode).toBe("mine");
    }
    for (const id of ["cursor", "grandma", "farm", "factory", "bank", "ai", "tm"]) {
      expect(ITEM_BY_ID[id], `${id} doit exister`).toBeDefined();
      expect(ITEM_BY_ID[id].mode).toBe("click");
    }
  });

  it("neutralise les buffs et ventes flash périmés", () => {
    const s = migrate({
      ...SAVE_V4,
      buffs: { cpsMulti: 99, cpcMulti: 99, until: 9e15, label: "TRICHE" },
      flags: { flash: { itemId: "oven", discount: 0.99, until: 9e15 } },
    });
    expect(s.buffs.cpsMulti).toBe(1);
    expect(s.flags.flash).toBeNull();
  });

  it("résiste à une sauvegarde tronquée ou absurde", () => {
    for (const entree of [null, undefined, "", 42, [], { cookies: NaN }, { items: "oups" }]) {
      const s = migrate(entree);
      expect(s.version).toBe(5);
      chargeable(s);
    }
  });

  it("n'invente pas de progression sur une sauvegarde neuve", () => {
    const s = migrate(createFreshState(0));
    expect(s.cookies).toBe(0);
    expect(deriveStats(s, 6e5).perClickNoCombo).toBe(1);
  });
});
