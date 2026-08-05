// === Sauvegardes de départ des profils ===
//
// Les états tardifs (prestige, Ascension, gros portefeuille CRMB) sont posés
// par FIXTURE: aucun profil n'a « attendu dix jours », et le rapport le dit.
// Les fixtures v3/v4/v5 reproduisent les champs réels de ces époques — champs
// morts compris (mission, combo, faucet…) — pour éprouver la migration, pas
// une version idéalisée de celle-ci.

/** V3: l'époque missions/micro-missions, combo ×3, faucet CRMB. */
export const SAVE_V3 = {
  version: 3,
  cookies: 84_512,
  lifetime: 1_240_000,
  cpcBase: 1,
  items: { cursor: 24, grandma: 12, farm: 4, oven: 18, bakery: 9, farm_cps: 3 },
  upgrades: { cursor_10: true, "share:2": true, "cpc:1": true },
  mission: { id: "m3", progress: 4 },
  activeMission: "m3",
  microMissions: [{ id: "µ1" }],
  combo: { streak: 22, best: 2.6 },
  settings: { sound: true, particles: true },
  stats: { clicks: 9_412, bestCombo: 2.6, totalSpent: 61_000, prestigeCount: 0 },
  crypto: {
    balance: 0.412,
    staked: 0,
    mintedUnits: 61,
    perCookies: 20_000,
    perAmount: 0.001,
    price: 21_400.7,
    priceHistory: [21_000, 21_400.7],
  },
  ui: { introSeen: true, sounds: true },
};

/** V4: staking « à plat » (un seul nombre), améliorations legacy. */
export const SAVE_V4 = {
  version: 4,
  cookies: 2_450_000,
  lifetime: 18_600_000,
  cpcBase: 1,
  items: { cursor: 40, grandma: 25, farm: 12, factory: 3, oven: 30, bakery: 18, farm_cps: 10, factory_cps: 4 },
  upgrades: { "tier:oven:0": true, "tier:cursor:0": true, "global:0": true, "share:3": true },
  stats: { clicks: 31_000, bestCombo: 3, totalSpent: 9_000_000, prestigeCount: 0 },
  crypto: {
    balance: 6.2,
    staked: 4.5,
    mintedUnits: 930,
    price: 22_000,
    priceHistory: [21_500, 22_000],
    miners: { cpu: 1 },
  },
  ui: { introSeen: true, sounds: false },
};

/** V5: la génération précédente — chips, arbre céleste, pas d'Ascension. */
export const SAVE_V5 = {
  version: 5,
  cookies: 5e9,
  lifetime: 3.1e11,
  cpcBase: 1,
  items: {
    cursor: 70, grandma: 52, farm: 30, factory: 18, bank: 9, ai: 4,
    oven: 60, bakery: 45, farm_cps: 32, factory_cps: 20, bank_cps: 10, temple: 5, lab: 2,
  },
  upgrades: { "tier:oven:0": true, "tier:oven:1": true, "tier:cursor:0": true, "tier:grandma:0": true, "global:0": true },
  prestige: { chips: 260, spent: 130, upgrades: { celestial_dough: 3, golden_fingers: 2, cheap_bricks: 1 } },
  stats: { clicks: 152_000, bestCombo: 1.75, totalSpent: 2.4e11, prestigeCount: 3 },
  crypto: {
    balance: 58,
    miners: { cpu: 3, gpu: 1 },
    totalMined: 21.4,
    positions: [{ id: "p1", amount: 10, tierId: "flex", startedAt: 0, unlockAt: 0 }],
    ledger: 0,
    price: 23_800,
    priceHistory: [23_000, 23_800],
    totalEarned: 96,
  },
  quests: { active: [], daily: [], cooldowns: {}, completed: { click_warmup: 6, gain_small: 4 }, dailyResetAt: 0, streak: 2, lastDailyClaim: 0 },
  ui: { introSeen: true, sounds: false },
};

/** Petit parc de départ, pour les profils qui mesurent la cadence de clic. */
export const SAVE_PETIT = {
  version: 6,
  cookies: 900,
  lifetime: 3_200,
  items: { cursor: 6, oven: 2 },
  stats: { clicks: 300, bestCombo: 1.5 },
  ui: { introSeen: true },
};

/** Parc moyen: milieu de première heure. */
export const SAVE_MOYEN = {
  version: 6,
  cookies: 120_000,
  lifetime: 900_000,
  items: { cursor: 22, grandma: 10, farm: 3, oven: 20, bakery: 8, farm_cps: 2 },
  upgrades: { "tier:cursor:0": true, "tier:oven:0": true },
  crypto: { balance: 4 },
  stats: { clicks: 4_000, bestCombo: 1.75 },
  ui: { introSeen: true },
};

/** Spécialiste CRMB: de quoi acheter du matériel et jouer le marché. */
export const SAVE_CRMB = {
  version: 6,
  cookies: 5.2e9,
  lifetime: 6.4e10,
  items: {
    cursor: 55, grandma: 40, farm: 25, factory: 12, bank: 6,
    oven: 50, bakery: 38, farm_cps: 26, factory_cps: 14, bank_cps: 7, temple: 3,
  },
  upgrades: { "tier:oven:0": true, "tier:cursor:0": true, "global:0": true },
  crypto: { balance: 64, miners: {}, ledger: 0, totalEarned: 70, price: 22_500, priceHistory: [22_000, 22_500] },
  prestige: { chips: 90, spent: 0, upgrades: {} },
  stats: { clicks: 60_000, bestCombo: 1.75, prestigeCount: 1 },
  ui: { introSeen: true },
};

/** Chasseur de quêtes/succès/événements: assez de parc pour tout déclencher. */
export const SAVE_QUETES = {
  version: 6,
  cookies: 800_000,
  lifetime: 5_000_000,
  items: { cursor: 30, grandma: 15, farm: 6, oven: 28, bakery: 14, farm_cps: 6, factory_cps: 1 },
  upgrades: { "tier:cursor:0": true, "tier:oven:0": true },
  crypto: { balance: 8 },
  stats: { clicks: 12_000, bestCombo: 1.75 },
  ui: { introSeen: true },
};

/** Au bord du prestige: la production totale dépasse le seuil de 250 M. */
export const SAVE_PRESTIGE = {
  version: 6,
  cookies: 6.5e7,
  lifetime: 7.4e8,
  items: {
    cursor: 60, grandma: 45, farm: 26, factory: 12, bank: 5, ai: 1,
    oven: 55, bakery: 40, farm_cps: 28, factory_cps: 15, bank_cps: 6, temple: 2,
  },
  upgrades: { "tier:cursor:0": true, "tier:grandma:0": true, "tier:oven:0": true, "tier:oven:1": true, "tier:bakery:0": true },
  crypto: { balance: 12 },
  prestige: { chips: 0, spent: 0, upgrades: {} },
  stats: { clicks: 45_000, bestCombo: 1.75, prestigeCount: 0 },
  ui: { introSeen: true },
};

/**
 * En pleine Ascension: une première ascension déjà faite (la Voûte est
 * ouverte), des chips au-delà du seuil pour en refaire une, un gros solde pour
 * acheter les bâtiments tardifs. État posé par fixture, pas « attendu dix jours ».
 */
export const SAVE_ASCENSION = {
  version: 6,
  cookies: 2.1e13,
  lifetime: 8.4e14,
  items: {
    cursor: 120, grandma: 90, farm: 70, factory: 55, bank: 40, ai: 30, tm: 18, singularity: 9,
    oven: 110, bakery: 95, farm_cps: 75, factory_cps: 60, bank_cps: 45, temple: 32, lab: 20, portal: 10,
  },
  upgrades: { "tier:oven:0": true, "tier:oven:1": true, "tier:portal:0": true, "global:0": true, "global:1": true },
  prestige: { chips: 6_400, spent: 900, upgrades: { celestial_dough: 6, golden_fingers: 5, cheap_bricks: 4, head_start: 3 } },
  ascension: { stars: 9, spent: 1, tracks: { horizon: 1 }, count: 1 },
  crypto: {
    balance: 74,
    miners: { cpu: 4, gpu: 2, asic: 1 },
    totalMined: 60,
    ledger: 1,
    totalEarned: 160,
    positions: [{ id: "p1", amount: 20, tierId: "flex", startedAt: 0, unlockAt: 0 }],
  },
  stats: { clicks: 400_000, bestCombo: 1.75, prestigeCount: 21 },
  skinsOwned: { default: true, starter: true, early: false, caramel: false, noir: false, ice: true, fire: false },
  skin: "ice",
  ui: { introSeen: true },
};

/** Accessibilité: un parc qui produit, du matériel CRMB, une absence de 2 h. */
export const SAVE_ACCESSIBILITE = {
  version: 6,
  cookies: 3_400_000,
  lifetime: 4.1e7,
  items: { cursor: 35, grandma: 20, farm: 9, oven: 32, bakery: 20, farm_cps: 9, factory_cps: 3 },
  upgrades: { "tier:cursor:0": true, "tier:oven:0": true },
  crypto: { balance: 9, miners: { cpu: 1 } },
  stats: { clicks: 15_000, bestCombo: 1.5 },
  ui: { introSeen: true, sounds: true },
};
