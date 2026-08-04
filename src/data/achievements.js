import { ITEMS, BASE_ITEMS } from "./items.js";
import { MINERS } from "../utils/crypto.js";
import { COMBO } from "../utils/combo.js";
import { fmtMult } from "../utils/format.js";
import { lisible } from "../utils/grid.js";

const totalBuildings = (s) => ITEMS.reduce((sum, it) => sum + (s.items?.[it.id] || 0), 0);
const totalMiners = (s) => MINERS.reduce((sum, m) => sum + (s.crypto?.miners?.[m.id] || 0), 0);
const heldCrmb = (s) => (s.crypto?.balance || 0) + (s.crypto?.positions || []).reduce((a, p) => a + p.amount, 0);
const questsDone = (s) => Object.values(s.quests?.completed || {}).reduce((a, b) => a + b, 0);

// `tier` pilote le style de la carte: 1 bronze → 5 légendaire
export const ACHIEVEMENTS = [
  // --- Clics ---
  { id: "click_1", tier: 1, cat: "clic", name: "Premier croc", desc: "Ton tout premier clic.", cond: (s) => (s.stats?.clicks || 0) >= 1 },
  { id: "click_100", tier: 1, cat: "clic", name: "Ça clique sec", desc: "100 clics.", cond: (s) => (s.stats?.clicks || 0) >= 100 },
  { id: "click_1k", tier: 2, cat: "clic", name: "Cliqueur fou", desc: "1 000 clics.", cond: (s) => (s.stats?.clicks || 0) >= 1_000 },
  { id: "click_10k", tier: 3, cat: "clic", name: "Tendinite", desc: "10 000 clics.", cond: (s) => (s.stats?.clicks || 0) >= 10_000 },
  { id: "click_100k", tier: 4, cat: "clic", name: "Main bionique", desc: "100 000 clics.", cond: (s) => (s.stats?.clicks || 0) >= 100_000 },

  { id: "combo_max", tier: 2, cat: "clic", name: "Enchaînement", desc: `Atteindre un combo ×${fmtMult(COMBO.max)}.`, cond: (s) => (s.stats?.bestCombo || 0) >= COMBO.max - 1e-9 },
  { id: "power_1k", tier: 3, cat: "clic", name: "Doigts de fée", desc: "Atteindre 1 000 de puissance de clic.", cond: (s, ctx) => (ctx?.perClickNoCombo || 0) >= 1_000 },
  { id: "power_1m", tier: 5, cat: "clic", name: "Toucher divin", desc: "Atteindre 1 million de puissance de clic.", cond: (s, ctx) => (ctx?.perClickNoCombo || 0) >= 1e6 },

  // --- Banque ---
  { id: "bank_1k", tier: 1, cat: "banque", name: "Petit pécule", desc: "1 000 cookies en banque.", cond: (s) => (s.cookies || 0) >= 1_000 },
  { id: "bank_1m", tier: 2, cat: "banque", name: "Ça pèse", desc: "1 million en banque.", cond: (s) => (s.cookies || 0) >= 1e6 },
  { id: "bank_1b", tier: 3, cat: "banque", name: "Milliardaire", desc: "1 milliard en banque.", cond: (s) => (s.cookies || 0) >= 1e9 },
  { id: "bank_1t", tier: 4, cat: "banque", name: "Réserve fédérale", desc: "1 billion en banque.", cond: (s) => (s.cookies || 0) >= 1e12 },
  { id: "life_1m", tier: 2, cat: "banque", name: "Fournée million", desc: "1 million cuits au total.", cond: (s) => (s.lifetime || 0) >= 1e6 },
  { id: "life_1b", tier: 3, cat: "banque", name: "Industriel", desc: "1 milliard cuits au total.", cond: (s) => (s.lifetime || 0) >= 1e9 },
  { id: "life_1q", tier: 5, cat: "banque", name: "Singularité sucrée", desc: "1 quadrillion cuits au total.", cond: (s) => (s.lifetime || 0) >= 1e15 },

  // --- Empire ---
  { id: "build_10", tier: 1, cat: "empire", name: "Petit atelier", desc: "10 bâtiments.", cond: (s) => totalBuildings(s) >= 10 },
  { id: "build_100", tier: 2, cat: "empire", name: "Manufacture", desc: "100 bâtiments.", cond: (s) => totalBuildings(s) >= 100 },
  { id: "build_500", tier: 3, cat: "empire", name: "Conglomérat", desc: "500 bâtiments.", cond: (s) => totalBuildings(s) >= 500 },
  { id: "build_1000", tier: 4, cat: "empire", name: "Empire du biscuit", desc: "1 000 bâtiments.", cond: (s) => totalBuildings(s) >= 1_000 },
  { id: "grandma_10", tier: 1, cat: "empire", name: "Thé de 17 h", desc: "10 Mamies.", cond: (s) => (s.items?.grandma || 0) >= 10 },
  { id: "grandma_100", tier: 3, cat: "empire", name: "Comité des mamies", desc: "100 Mamies.", cond: (s) => (s.items?.grandma || 0) >= 100 },
  { id: "cursor_50", tier: 1, cat: "empire", name: "Pieuvre", desc: "50 Curseurs.", cond: (s) => (s.items?.cursor || 0) >= 50 },
  { id: "portal_1", tier: 4, cat: "empire", name: "Ailleurs", desc: "Ouvrir un Portail.", cond: (s) => (s.items?.portal || 0) >= 1 },
  { id: "diverse", tier: 3, cat: "empire", name: "Portefeuille équilibré", desc: "Posséder les 16 types de Cliqueurs et Mineurs.", cond: (s) => BASE_ITEMS.every((it) => (s.items?.[it.id] || 0) > 0) },
  { id: "upgrades_5", tier: 1, cat: "empire", name: "Bricoleur", desc: "5 améliorations achetées.", cond: (s) => Object.keys(s.upgrades || {}).length >= 5 },
  { id: "upgrades_25", tier: 2, cat: "empire", name: "Ingénieur", desc: "25 améliorations achetées.", cond: (s) => Object.keys(s.upgrades || {}).length >= 25 },
  { id: "upgrades_75", tier: 3, cat: "empire", name: "Optimiseur", desc: "75 améliorations achetées.", cond: (s) => Object.keys(s.upgrades || {}).length >= 75 },
  { id: "upgrades_200", tier: 5, cat: "empire", name: "Perfectionniste", desc: "200 améliorations achetées.", cond: (s) => Object.keys(s.upgrades || {}).length >= 200 },

  // --- Minage ---
  { id: "cps_10", tier: 1, cat: "minage", name: "Ça tourne", desc: "Miner 10 cookies par seconde.", cond: (s, ctx) => (ctx?.mining || 0) >= 10 },
  { id: "cps_1k", tier: 2, cat: "minage", name: "Chaîne rodée", desc: "Miner 1 000 cookies par seconde.", cond: (s, ctx) => (ctx?.mining || 0) >= 1_000 },
  { id: "cps_1m", tier: 4, cat: "minage", name: "Usine à ciel ouvert", desc: "Miner 1 million de cookies par seconde.", cond: (s, ctx) => (ctx?.mining || 0) >= 1e6 },

  // --- Événements ---
  { id: "golden_1", tier: 1, cat: "événement", name: "Doré !", desc: "Attraper un cookie doré.", cond: (s) => (s.stats?.goldenClicks || 0) >= 1 },
  { id: "golden_25", tier: 2, cat: "événement", name: "Chasseur d'or", desc: "25 cookies dorés.", cond: (s) => (s.stats?.goldenClicks || 0) >= 25 },
  { id: "golden_200", tier: 4, cat: "événement", name: "Roi Midas", desc: "200 cookies dorés.", cond: (s) => (s.stats?.goldenClicks || 0) >= 200 },
  { id: "eaten_1", tier: 1, cat: "événement", name: "Miam", desc: "Croquer un cookie entier.", cond: (s) => (s.cookieEatenCount || 0) >= 1 },
  { id: "eaten_25", tier: 3, cat: "événement", name: "Appétit d'ogre", desc: "25 cookies croqués.", cond: (s) => (s.cookieEatenCount || 0) >= 25 },
  { id: "offline", tier: 1, cat: "événement", name: "Rentier", desc: "Encaisser des gains hors-ligne.", cond: (s) => !!s.flags?.offlineCollected },

  // --- Quêtes ---
  { id: "quest_1", tier: 1, cat: "quête", name: "Première mission", desc: "Terminer une quête.", cond: (s) => questsDone(s) >= 1 },
  { id: "quest_25", tier: 2, cat: "quête", name: "Aventurier", desc: "25 quêtes terminées.", cond: (s) => questsDone(s) >= 25 },
  { id: "quest_150", tier: 4, cat: "quête", name: "Légende du biscuit", desc: "150 quêtes terminées.", cond: (s) => questsDone(s) >= 150 },
  { id: "streak_7", tier: 3, cat: "quête", name: "Assidu", desc: "7 jours de série quotidienne.", cond: (s) => (s.quests?.streak || 0) >= 7 },

  // --- Crypto ---
  { id: "crmb_first", tier: 1, cat: "crypto", name: "Premier satoshi", desc: "Obtenir du CRMB.", cond: (s) => heldCrmb(s) > 0 },
  { id: "crmb_1", tier: 2, cat: "crypto", name: "Investisseur", desc: "Détenir 1 CRMB.", cond: (s) => heldCrmb(s) >= 1 },
  { id: "crmb_10", tier: 3, cat: "crypto", name: "Baleine", desc: "Détenir 10 CRMB.", cond: (s) => heldCrmb(s) >= 10 },
  { id: "miner_1", tier: 1, cat: "crypto", name: "Ça extrait", desc: "Installer une machine d'extraction.", cond: (s) => totalMiners(s) >= 1 },
  { id: "miner_50", tier: 3, cat: "crypto", name: "Datacenter", desc: "50 machines d'extraction installées.", cond: (s) => totalMiners(s) >= 50 },
  { id: "stake_1", tier: 2, cat: "crypto", name: "Bloqué", desc: "Ouvrir une position de staking.", cond: (s) => (s.crypto?.positions || []).length >= 1 },
  { id: "stake_long", tier: 3, cat: "crypto", name: "Main de diamant", desc: "Ouvrir une position verrouillée 24 h.", cond: (s) => (s.crypto?.positions || []).some((p) => p.tierId === "long") },
  { id: "trader_profit", tier: 3, cat: "crypto", name: "Trader gagnant", desc: "Dégager un profit net sur le marché.", cond: (s) => (s.crypto?.realizedPnl || 0) > 0 },

  // --- Prestige ---
  { id: "prestige_1", tier: 2, cat: "prestige", name: "Renaissance", desc: "Faire un prestige.", cond: (s) => (s.stats?.prestigeCount || 0) >= 1 },
  { id: "prestige_10", tier: 4, cat: "prestige", name: "Cycle éternel", desc: "10 prestiges.", cond: (s) => (s.stats?.prestigeCount || 0) >= 10 },
  { id: "chips_100", tier: 3, cat: "prestige", name: "Constellation", desc: "100 chips célestes.", cond: (s) => (s.prestige?.chips || 0) >= 100 },
  { id: "tree_maxed", tier: 5, cat: "prestige", name: "Ascension", desc: "Un nœud de l'arbre céleste au maximum.", cond: (s) => Object.values(s.prestige?.upgrades || {}).some((l) => l >= 20) },

  // --- Style ---
  { id: "skin_1", tier: 1, cat: "style", name: "Relooking", desc: "Acheter un skin.", cond: (s) => Object.values(s.skinsOwned || {}).filter(Boolean).length >= 2 },
  { id: "skin_all", tier: 4, cat: "style", name: "Garde-robe complète", desc: "Posséder tous les skins.", cond: (s) => Object.values(s.skinsOwned || {}).filter(Boolean).length >= 7 },
];

export const ACHIEVEMENT_CATEGORIES = ["clic", "banque", "empire", "minage", "événement", "quête", "crypto", "prestige", "style"];

export const TIER_STYLE = {
  1: { label: "Bronze", ring: "ring-amber-600/40", bg: "from-amber-100 to-amber-50", text: "text-amber-900" },
  2: { label: "Argent", ring: "ring-slate-400/50", bg: "from-slate-100 to-slate-50", text: "text-slate-800" },
  3: { label: "Or", ring: "ring-yellow-500/50", bg: "from-yellow-100 to-amber-50", text: "text-yellow-900" },
  4: { label: "Platine", ring: "ring-cyan-400/50", bg: "from-cyan-100 to-sky-50", text: "text-cyan-900" },
  5: { label: "Légendaire", ring: "ring-fuchsia-400/60", bg: "from-fuchsia-100 to-violet-50", text: "text-fuchsia-900" },
};

/**
 * Récompense en cookies d'un succès, proportionnelle à son palier.
 *
 * Arrondie à deux chiffres significatifs: « +30 000 000 » se lit, pas
 * « +29 847 213 ».
 */
export const achievementReward = (tier, cps) => lisible(Math.max(100 * tier, Math.floor(cps * 30 * tier)));

/**
 * Récompense en CRMB d'un succès. Seuls les paliers qui comptent en donnent,
 * et toujours en nombres entiers: Or +1, Platine +2, Légendaire +5. Bronze et
 * Argent n'en donnent aucun — c'est ce qui garde la monnaie désirable.
 */
export const CRMB_PAR_PALIER = { 1: 0, 2: 0, 3: 1, 4: 2, 5: 5 };
export const achievementCrmb = (tier) => CRMB_PAR_PALIER[tier] || 0;
