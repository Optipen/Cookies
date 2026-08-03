import { describe, it, expect } from "vitest";
import {
  createFreshState,
  migrate,
  createResetState,
  validateState,
  exportSave,
  importSave,
  STATE_VERSION,
} from "../utils/state.js";

describe("createFreshState", () => {
  it("produit des objets indépendants à chaque appel", () => {
    const a = createFreshState();
    const b = createFreshState();
    // Régression: une constante DEFAULT_STATE partagée laissait fuiter les
    // mutations d'une partie à l'autre.
    expect(a.ui).not.toBe(b.ui);
    expect(a.items).not.toBe(b.items);
    expect(a.crypto).not.toBe(b.crypto);
    a.items.oven = 5;
    a.ui.sounds = false;
    expect(b.items.oven).toBeUndefined();
    expect(b.ui.sounds).toBe(true);
  });

  it("horodate à l'instant demandé", () => {
    const s = createFreshState(12345);
    expect(s.createdAt).toBe(12345);
    expect(s.lastTs).toBe(12345);
  });
});

describe("migrate", () => {
  it("repart à neuf sans sauvegarde", () => {
    const s = migrate(null);
    expect(s.cookies).toBe(0);
    expect(s.version).toBe(STATE_VERSION);
    expect(s.quests.active).toEqual([]);
  });

  it("complète les champs manquants d'une vieille sauvegarde", () => {
    const s = migrate({ version: 3, cookies: 10, ui: { sounds: false } });
    expect(s.cookies).toBe(10);
    expect(s.ui.sounds).toBe(false);
    expect(s.ui.highContrast).toBe(false);
    expect(typeof s.items).toBe("object");
    expect(s.quests).toBeDefined();
    expect(s.prestige.upgrades).toEqual({});
  });

  it("convertit le staking à plat de la v4 en position flexible", () => {
    const s = migrate({ version: 4, crypto: { balance: 1.5, staked: 0.25 } });
    expect(s.crypto.balance).toBe(1.5);
    expect(s.crypto.staked).toBeUndefined();
    expect(s.crypto.positions).toHaveLength(1);
    expect(s.crypto.positions[0]).toMatchObject({ amount: 0.25, tierId: "flex" });
  });

  it("supprime les champs morts des anciennes versions", () => {
    const s = migrate({
      version: 4,
      mission: { id: "x" },
      activeMission: { id: "y" },
      activeMicroMission: { id: "z" },
      missionsState: { history: [] },
      combo: { value: 3 },
    });
    expect(s.mission).toBeUndefined();
    expect(s.activeMission).toBeUndefined();
    expect(s.activeMicroMission).toBeUndefined();
    expect(s.missionsState).toBeUndefined();
    expect(s.combo).toBeUndefined();
  });

  it("neutralise les états volatils au chargement", () => {
    const past = { flash: { itemId: "oven", discount: 0.9, until: 1 }, discountAll: { value: 0.9, until: 1 } };
    const s = migrate({ version: 4, flags: past, buffs: { cpsMulti: 99, cpcMulti: 99, until: 9e15, label: "TRICHE" } });
    // Une vente flash ou un buff périmé ne doit pas être rejoué au démarrage
    expect(s.flags.flash).toBeNull();
    expect(s.flags.discountAll).toBeNull();
    expect(s.buffs.cpsMulti).toBe(1);
    expect(s.buffs.until).toBe(0);
  });

  it("assainit les valeurs numériques aberrantes", () => {
    const s = migrate({ version: 4, cookies: -500, lifetime: NaN, cpcBase: "abc" });
    expect(s.cookies).toBe(0);
    expect(Number.isFinite(s.lifetime)).toBe(true);
    expect(s.cpcBase).toBe(1);
  });

  it("borne les chips dépensés aux chips gagnés", () => {
    const s = migrate({ version: 5, prestige: { chips: 3, spent: 999, upgrades: {} } });
    expect(s.prestige.spent).toBe(3);
  });

  it("résiste à une entrée non-objet", () => {
    expect(migrate("nope").cookies).toBe(0);
    expect(migrate(42).cookies).toBe(0);
    expect(migrate([]).cookies).toBe(0);
  });
});

describe("createResetState", () => {
  it("conserve prestige et arbre céleste quand demandé", () => {
    const s = createResetState({
      preservePrestige: true,
      prestige: { chips: 7, spent: 2, upgrades: { celestial_dough: 3 } },
      sounds: true,
    });
    expect(s.prestige.chips).toBe(7);
    expect(s.prestige.spent).toBe(2);
    expect(s.prestige.upgrades.celestial_dough).toBe(3);
    expect(s.cookies).toBe(0);
    expect(s.ui.sounds).toBe(true);
  });

  it("efface tout quand le prestige n'est pas préservé", () => {
    const s = createResetState({ preservePrestige: false, prestige: { chips: 7 }, sounds: false });
    expect(s.prestige.chips).toBe(0);
    expect(s.ui.sounds).toBe(false);
  });

  it("ne mute pas l'état de référence entre deux resets", () => {
    const a = createResetState({ sounds: false });
    const b = createResetState({ sounds: true });
    expect(a.ui.sounds).toBe(false);
    expect(b.ui.sounds).toBe(true);
  });
});

describe("validateState", () => {
  it("accepte un état complet et rejette le reste", () => {
    expect(validateState(createFreshState())).toBe(true);
    expect(validateState(null)).toBe(false);
    expect(validateState({})).toBe(false);
    expect(validateState({ cookies: "beaucoup", items: {}, stats: {}, ui: {} })).toBe(false);
  });
});

describe("export / import", () => {
  it("fait un aller-retour sans perte", () => {
    const original = createFreshState();
    original.cookies = 1234;
    original.items.oven = 3;
    const restored = importSave(exportSave(original));
    expect(restored.cookies).toBe(1234);
    expect(restored.items.oven).toBe(3);
  });

  it("accepte un état nu", () => {
    const restored = importSave(JSON.stringify({ ...createFreshState(), cookies: 99 }));
    expect(restored.cookies).toBe(99);
  });

  it("rend null sur une entrée illisible", () => {
    expect(importSave("pas du json")).toBeNull();
    expect(importSave(JSON.stringify({ rien: true }))).toBeNull();
  });
});
