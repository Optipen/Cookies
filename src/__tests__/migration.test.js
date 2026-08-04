import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { migrate, createFreshState, loadState, saveState, SAVE_KEY, STATE_VERSION } from "../utils/state.js";
import { deriveStats } from "../utils/selectors.js";
import { getUpgrade } from "../data/upgrades.js";
import { ITEM_BY_ID, ITEMS } from "../data/items.js";
import { costOf } from "../utils/selectors.js";
import { COMBO } from "../utils/combo.js";

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
    expect(s.version).toBe(STATE_VERSION);
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
      expect(s.version).toBe(STATE_VERSION);
      chargeable(s);
    }
  });

  it("n'invente pas de progression sur une sauvegarde neuve", () => {
    const s = migrate(createFreshState(0));
    expect(s.cookies).toBe(0);
    expect(deriveStats(s, 6e5).perClickNoCombo).toBe(1);
  });
});

// ============================================================================
// Version 6: l'Ascension et le Registre
// ============================================================================

// Sauvegarde telle que la branche l'écrivait AVANT l'Ascension: version 5,
// combo hérité de l'échelle ×3, aucun bloc `ascension`, aucun `ledger`.
const SAVE_V5_BRANCHE = {
  version: 5,
  cookies: 3.4e8,
  lifetime: 9.1e9,
  cpcBase: 1,
  items: { oven: 140, bakery: 95, farm_cps: 70, cursor: 160, grandma: 120, farm: 80, portal: 4 },
  upgrades: { "tier:oven:0": true, "tier:oven:1": true, "tier:cursor:0": true, "global:0": true },
  prestige: { chips: 620, spent: 45, upgrades: { celestial_dough: 8, golden_fingers: 6, cheap_bricks: 3 } },
  crypto: {
    name: "CrumbCoin",
    symbol: "CRMB",
    balance: 41.5,
    totalEarned: 58,
    totalMined: 2.5,
    price: 26_400,
    priceHistory: [24_000, 25_100, 26_400],
    miners: { cpu: 4, gpu: 1 },
    positions: [{ id: "p1", amount: 12, tierId: "long", startedAt: 0, unlockAt: 0 }],
  },
  skin: "ice",
  skinsOwned: { default: true, starter: true, ice: true },
  ui: { sounds: true, introSeen: true, highContrast: false, reducedMotion: false, volume: 0.6 },
  stats: { clicks: 210_000, bestCombo: 3, prestigeCount: 9, goldenClicks: 140 },
  quests: { active: [], daily: [], cooldowns: {}, completed: { gain_small: 40 }, streak: 11 },
  unlocked: { click_1: 1, crmb_10: 1 },
};

describe("version 6 — l'Ascension arrive", () => {
  it("écrit la version courante et retient d'où l'on vient", () => {
    for (const [source, attendu] of [[SAVE_V3, 3], [SAVE_V4, 4], [SAVE_V5_BRANCHE, 5]]) {
      const s = migrate(structuredClone(source));
      expect(s.version).toBe(STATE_VERSION);
      expect(s.migratedFrom, `depuis la v${attendu}`).toBe(attendu);
    }
    // Une sauvegarde sans version du tout: on note qu'on n'en savait rien.
    expect(migrate({ cookies: 5 }).migratedFrom).toBe(0);
  });

  it("charge une sauvegarde de la branche sans rien perdre", () => {
    const s = migrate(structuredClone(SAVE_V5_BRANCHE));
    expect(s.cookies).toBe(3.4e8);
    expect(s.items.portal).toBe(4);
    expect(s.prestige.chips).toBe(620);
    expect(s.prestige.upgrades.celestial_dough).toBe(8);
    expect(s.crypto.balance).toBe(41.5);
    expect(s.crypto.miners.cpu).toBe(4);
    expect(s.crypto.positions).toHaveLength(1);
    expect(s.skin).toBe("ice");
    expect(s.skinsOwned.ice).toBe(true);
    expect(s.unlocked.crmb_10).toBe(1);
    expect(s.quests.streak).toBe(11);
    expect(s.stats.prestigeCount).toBe(9);
    chargeable(s);
  });

  it("ramène le record de combo de l'ancienne échelle ×3", () => {
    // Laisser un 3 stocké afficherait un record devenu inatteignable, et
    // décrocherait un succès que plus personne ne peut obtenir.
    expect(migrate(structuredClone(SAVE_V5_BRANCHE)).stats.bestCombo).toBe(COMBO.max);
    expect(migrate({ version: 5, stats: { bestCombo: 1.25 } }).stats.bestCombo).toBe(1.25);
  });

  it("ajoute une Ascension neutre plutôt qu'une progression inventée", () => {
    for (const source of [SAVE_V3, SAVE_V4, SAVE_V5_INTERMEDIAIRE, SAVE_V5_BRANCHE]) {
      const s = migrate(structuredClone(source));
      expect(s.ascension).toEqual({ stars: 0, spent: 0, tracks: {}, count: 0 });
      expect(s.crypto.ledger).toBe(0);
      // Et aucun rang d'Ascension n'est acheté au passage.
      for (const item of ITEMS.filter((i) => i.horizon > 0)) {
        expect(costOf(s, item.id, 1, 6e5), `${item.name}`).toBe(Infinity);
      }
    }
  });
});

describe("ce qui peut arriver à une sauvegarde", () => {
  const cassable = (mutation) => {
    const s = structuredClone(SAVE_V5_BRANCHE);
    mutation(s);
    return migrate(s);
  };

  it("survit à une fermeture brutale au milieu d'une écriture", () => {
    // JSON tronqué: `loadState` l'archive et repart à neuf. Ici on teste
    // l'étage du dessous, avec un objet partiellement rempli.
    const tronque = { version: 5, cookies: 3.4e8, items: { oven: 140 } };
    const s = migrate(tronque);
    expect(s.cookies).toBe(3.4e8);
    expect(s.items.oven).toBe(140);
    expect(s.ui).toBeTruthy();
    expect(s.crypto).toBeTruthy();
    expect(s.quests).toBeTruthy();
    chargeable(s);
  });

  it("survit à une horloge reculée", () => {
    // Le joueur change le fuseau, ou la machine se resynchronise: `lastTs` se
    // retrouve dans le futur. Rien ne doit devenir négatif ni infini.
    const s = cassable((x) => {
      x.lastTs = 4e12; // très loin dans le futur
      x.createdAt = 4e12;
    });
    expect(Number.isFinite(s.lastTs)).toBe(true);
    expect(Number.isFinite(s.createdAt)).toBe(true);
    chargeable(s);
  });

  it("survit à une horloge avancée de dix ans", () => {
    const s = cassable((x) => {
      x.lastTs = 0;
      x.createdAt = 0;
    });
    chargeable(s);
    expect(s.cookies).toBeGreaterThanOrEqual(0);
  });

  it("écarte une quantité négative sans emporter le reste", () => {
    const s = cassable((x) => (x.items = { oven: -20, cursor: 160 }));
    expect(s.items.oven).toBeUndefined();
    expect(s.items.cursor).toBe(160);
    const d = chargeable(s);
    expect(d.mining).toBeGreaterThanOrEqual(0);
  });

  it("écarte les valeurs non finies partout où elles peuvent apparaître", () => {
    const s = cassable((x) => {
      x.cookies = NaN;
      x.lifetime = Infinity;
      x.cpcBase = NaN;
      x.crypto.balance = NaN;
      x.crypto.totalEarned = Infinity;
      x.prestige.chips = NaN;
      x.stats.bestCombo = NaN;
      x.crypto.ledger = Infinity;
      x.ascension = { stars: NaN, spent: Infinity, tracks: { eclat: NaN }, count: NaN };
    });
    for (const v of [s.cookies, s.lifetime, s.cpcBase, s.crypto.balance, s.crypto.totalEarned, s.prestige.chips, s.crypto.ledger, s.ascension.stars]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(s.stats.bestCombo).toBe(1);
    chargeable(s);
  });

  it("supporte des nombres énormes sans devenir infini", () => {
    const s = cassable((x) => {
      x.cookies = 1e300;
      x.lifetime = 1e308;
      x.items = { portal: 1e6 };
    });
    const d = chargeable(s);
    expect(Number.isFinite(d.mining)).toBe(true);
    expect(Number.isFinite(s.cookies)).toBe(true);
  });

  it("survit à des types entièrement faux", () => {
    for (const absurde of [null, undefined, 42, "sauvegarde", [], true]) {
      const s = migrate(absurde);
      expect(s.version).toBe(STATE_VERSION);
      chargeable(s);
    }
  });

  it("écarte les objets manquants sans planter", () => {
    const s = migrate({ version: 5 });
    for (const cle of ["items", "upgrades", "stats", "ui", "flags", "buffs", "prestige", "ascension", "crypto", "quests"]) {
      expect(s[cle], cle).toBeTruthy();
    }
    chargeable(s);
  });

  it("ne rejoue jamais un état d'événement périmé", () => {
    // Une remise en cours ou un buff actif au moment de la fermeture ne doivent
    // pas repartir au chargement: le temps a passé.
    const s = cassable((x) => {
      x.flags = { flash: { itemId: "oven", until: 9e15, discount: 0.9 }, discountAll: { value: 0.9, until: 9e15 }, offlineCollected: true };
      x.buffs = { cpsMulti: 100, cpcMulti: 100, until: 9e15, label: "triche" };
      x.notice = { id: "x", msg: "vieux" };
    });
    expect(s.flags.flash).toBeNull();
    expect(s.flags.discountAll).toBeNull();
    expect(s.flags.offlineCollected).toBe(false);
    expect(s.buffs).toEqual({ cpsMulti: 1, cpcMulti: 1, until: 0, label: "" });
    expect(s.notice).toBeNull();
  });

  it("garde une sauvegarde qui a déjà de l'Ascension", () => {
    const s = migrate({
      version: 6,
      items: { bigbake: 3 },
      ascension: { stars: 12, spent: 7, tracks: { horizon: 3, eclat: 4 }, count: 2 },
      crypto: { balance: 500, ledger: 6 },
    });
    expect(s.ascension.stars).toBe(12);
    expect(s.ascension.tracks.horizon).toBe(3);
    expect(s.crypto.ledger).toBe(6);
    expect(s.items.bigbake).toBe(3);
    expect(costOf(s, "bigbake", 1, 6e5)).toBe(Infinity); // Horizon 3 < 4
    expect(Number.isFinite(costOf(s, "nebula", 1, 6e5))).toBe(true); // Horizon 3 ≥ 3
    chargeable(s);
  });

  it("garde le même résultat si on migre deux fois", () => {
    // Une migration doit être idempotente: recharger une partie déjà migrée ne
    // doit rien changer, sinon chaque ouverture du jeu la ferait dériver.
    const une = migrate(structuredClone(SAVE_V5_BRANCHE), 1000);
    const deux = migrate(structuredClone(une), 1000);
    expect(deux.cookies).toBe(une.cookies);
    expect(deux.items).toEqual(une.items);
    expect(deux.prestige).toEqual(une.prestige);
    expect(deux.ascension).toEqual(une.ascension);
    expect(deux.crypto.balance).toBe(une.crypto.balance);
    expect(deux.crypto.ledger).toBe(une.crypto.ledger);
    expect(deux.stats.bestCombo).toBe(une.stats.bestCombo);
    expect(deux.migratedFrom).toBe(STATE_VERSION);
  });
});

describe("les clés de stockage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("lit la clé de la version courante en priorité", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 6, cookies: 111 }));
    localStorage.setItem("cookieCrazeSaveV5", JSON.stringify({ version: 5, cookies: 999 }));
    expect(loadState().cookies).toBe(111);
  });

  it("retombe sur les clés précédentes, de la plus récente à la plus ancienne", () => {
    localStorage.setItem("cookieCrazeSaveV4", JSON.stringify({ version: 4, cookies: 444 }));
    localStorage.setItem("cookieCrazeSaveV3", JSON.stringify({ version: 3, cookies: 333 }));
    const s = loadState();
    expect(s.cookies).toBe(444);
    expect(s.migratedFrom).toBe(4);
  });

  it("n'efface jamais l'ancienne clé en migrant", () => {
    // Un joueur qui revient sur une version antérieure doit retrouver sa
    // partie. Écraser la clé d'origine la lui prendrait définitivement.
    const brut = JSON.stringify({ version: 5, cookies: 777 });
    localStorage.setItem("cookieCrazeSaveV5", brut);
    const s = loadState();
    expect(saveState(s)).toBe(true);
    expect(localStorage.getItem("cookieCrazeSaveV5")).toBe(brut);
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)).cookies).toBe(777);
  });

  it("archive une sauvegarde illisible au lieu de l'effacer", () => {
    localStorage.setItem(SAVE_KEY, "{ceci n'est pas du JSON");
    const s = loadState();
    expect(s.cookies).toBe(0); // partie neuve
    const archives = Object.keys(localStorage).filter((k) => k.includes("_corrupted_"));
    expect(archives.length).toBe(1);
    expect(localStorage.getItem(archives[0])).toContain("ceci n'est pas du JSON");
  });

  it("repart à neuf si le stockage est indisponible", () => {
    const vrai = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("stockage interdit");
    };
    try {
      expect(loadState().cookies).toBe(0);
    } finally {
      Storage.prototype.getItem = vrai;
    }
  });
});
