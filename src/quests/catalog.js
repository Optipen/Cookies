// === Catalogue de quêtes ===
// Chaque quête est une donnée pure. Le moteur (engine.js) les instancie,
// suit leur progression et distribue les récompenses.
//
// Contrat d'une quête:
//   id         identifiant stable (sert aux cooldowns et à l'historique)
//   category   sert au filtrage, à l'icône et à l'anti-doublon
//   tier       'micro' (court) | 'main' (moyen) | 'daily' (quotidien)
//   title/desc peuvent être des fonctions de meta pour afficher la cible réelle
//   eligible   (ctx) => bool — la quête a-t-elle du sens maintenant ?
//   target     (state, ctx) => meta — objectif + photo de l'état au départ
//   progress   (state, meta, ctx) => { progress, target, done, failed }
//   reward     (state, ctx, meta) => paquet de récompense
//   weight     (ctx) => number — poids de tirage
//   timeLimitS optionnel, transforme la quête en défi chronométré
//   cooldownS  temps avant de pouvoir retirer la même quête

import { ITEMS } from "../data/items.js";
import { MINERS } from "../utils/crypto.js";
import { fmt } from "../utils/format.js";

const MINE_ITEMS = ITEMS.filter((i) => i.mode === "mine");
const CLICK_ITEMS = ITEMS.filter((i) => i.mode === "click");

const itemName = (id) => ITEMS.find((i) => i.id === id)?.name || id;
const itemEmoji = (id) => ITEMS.find((i) => i.id === id)?.emoji || "📦";

// Échelle les objectifs sur le stade de jeu pour rester toujours atteignable
const byLevel = (ctx, early, mid, late) =>
  ctx.level === "early" ? early : ctx.level === "mid" ? mid : late;

// Récompenses calibrées sur la production courante. `seconds` représente la
// durée de production offerte: il pilote aussi la part de banque, sinon toutes
// les quêtes finissaient par verser exactement le même montant en fin de partie.
const cookieReward = (ctx, seconds) => {
  const fromProduction = ctx.cps * seconds;
  const fromBank = ctx.bank * Math.min(0.5, seconds / 1200);
  return Math.max(50, Math.floor(Math.max(fromProduction, fromBank)));
};
const buff = (kind, value, seconds, label) => ({ kind, value, seconds, label });

// --- Compteurs utilitaires -------------------------------------------------

const totalOwned = (items, list) => list.reduce((sum, it) => sum + (items[it.id] || 0), 0);
const totalMiners = (miners = {}) => MINERS.reduce((sum, m) => sum + (miners[m.id] || 0), 0);

// --- Fabriques de quêtes ---------------------------------------------------

// « Gagner N cookies » — mesuré en delta depuis le départ, donc jamais rétroactif
const gainQuest = ({ id, tier, title, icon, mult, cooldownS, timeLimitS, weight }) => ({
  id,
  category: "banque",
  tier,
  icon,
  cooldownS,
  timeLimitS,
  eligible: (ctx) => ctx.cps > 0 || ctx.bank > 100,
  target: (state, ctx) => ({
    amount: Math.max(100, Math.round(Math.max(ctx.cps * 30, ctx.bank * 0.5) * mult)),
    lifetimeAtStart: state.lifetime || 0,
  }),
  title: (meta) => `${title} ${fmt(meta.amount)} cookies`,
  desc: () => "Compte les cookies gagnés depuis le début de la quête.",
  progress: (state, meta) => {
    const gained = Math.max(0, (state.lifetime || 0) - (meta.lifetimeAtStart || 0));
    return { progress: Math.min(gained, meta.amount), target: meta.amount, done: gained >= meta.amount };
  },
  reward: (state, ctx) => ({ cookies: cookieReward(ctx, 45), buff: buff("cps", 1.25, 25, "×1,25 minage") }),
  weight: (ctx) => 1 + (ctx.cps > 0 ? 0.5 : 0),
});

// « Cliquer N fois » — optionnellement chronométré
const clickQuest = ({ id, tier, icon, early, mid, late, timeLimitS, cooldownS, reward, weight }) => ({
  id,
  category: "clic",
  tier,
  icon,
  cooldownS,
  timeLimitS,
  eligible: () => true,
  target: (state, ctx) => ({
    clicks: byLevel(ctx, early, mid, late),
    clicksAtStart: state.stats.clicks || 0,
  }),
  title: (meta) => `Réaliser ${meta.clicks} clics`,
  desc: (meta, quest) =>
    quest.timeLimitS ? `Enchaîne ${meta.clicks} clics avant la fin du chrono.` : `Clique ${meta.clicks} fois sur le cookie.`,
  progress: (state, meta) => {
    const diff = Math.max(0, (state.stats.clicks || 0) - (meta.clicksAtStart || 0));
    return { progress: Math.min(diff, meta.clicks), target: meta.clicks, done: diff >= meta.clicks };
  },
  reward: reward || ((state, ctx) => ({ cookies: cookieReward(ctx, 20), buff: buff("cpc", 1.25, 25, "×1,25 au clic") })),
  weight: weight || (() => 1),
});

// « Acheter N exemplaires d'un bâtiment » — la cible est choisie à l'instanciation
const buyQuest = ({ id, tier, icon, pool, qty, cooldownS, reward, weight, categoryLabel }) => ({
  id,
  category: categoryLabel || "achat",
  tier,
  icon,
  cooldownS,
  eligible: (ctx) => !!ctx.nextAffordable,
  target: (state, ctx) => {
    const candidates = pool.filter((it) => it.base <= Math.max(1, ctx.bank * 3));
    const pick = candidates[candidates.length - 1] || pool[0];
    return {
      itemId: pick.id,
      qty: typeof qty === "function" ? qty(ctx) : qty,
      ownedAtStart: state.items[pick.id] || 0,
    };
  },
  title: (meta) => `Acheter ${meta.qty} × ${itemName(meta.itemId)}`,
  desc: (meta) => `${itemEmoji(meta.itemId)} Développe ton empire avec ${meta.qty} ${itemName(meta.itemId)}.`,
  progress: (state, meta) => {
    const diff = Math.max(0, (state.items[meta.itemId] || 0) - (meta.ownedAtStart || 0));
    return { progress: Math.min(diff, meta.qty), target: meta.qty, done: diff >= meta.qty };
  },
  reward: reward || ((state, ctx) => ({ cookies: cookieReward(ctx, 60), discount: { value: 0.25, seconds: 30, label: "-25 % coûts" } })),
  weight: weight || (() => 1),
});

// --- Le catalogue ----------------------------------------------------------

export const QUESTS = [
  // ============ CLIC ============
  clickQuest({ id: "click_warmup", tier: "micro", icon: "👆", early: 25, mid: 60, late: 120, cooldownS: 60 }),
  clickQuest({
    id: "click_sprint",
    tier: "micro",
    icon: "⚡",
    early: 40,
    mid: 80,
    late: 150,
    timeLimitS: 30,
    cooldownS: 120,
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 60), buff: buff("cpc", 1.75, 20, "×1,75 au clic") }),
    weight: (ctx) => (ctx.level === "early" ? 1.4 : 0.9),
  }),
  clickQuest({
    id: "click_marathon",
    tier: "main",
    icon: "🏃",
    early: 250,
    mid: 600,
    late: 1200,
    cooldownS: 600,
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 180), buff: buff("cpc", 1.5, 60, "×1,5 au clic") }),
  }),
  {
    id: "click_precision",
    category: "clic",
    tier: "micro",
    icon: "🎯",
    cooldownS: 180,
    timeLimitS: 15,
    eligible: (ctx) => ctx.level !== "early",
    target: (state) => ({ clicks: 40, clicksAtStart: state.stats.clicks || 0 }),
    title: () => "Burst: 40 clics en 15 s",
    desc: () => "Un vrai sprint. Prépare ton poignet.",
    progress: (state, meta) => {
      const diff = Math.max(0, (state.stats.clicks || 0) - (meta.clicksAtStart || 0));
      return { progress: Math.min(diff, meta.clicks), target: meta.clicks, done: diff >= meta.clicks };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 90), buff: buff("cpc", 2.25, 15, "×2,25 au clic") }),
    weight: () => 0.8,
  },

  // ============ BANQUE / GAIN ============
  gainQuest({ id: "gain_small", tier: "micro", title: "Récolter", icon: "🍪", mult: 0.6, cooldownS: 60 }),
  gainQuest({ id: "gain_medium", tier: "main", title: "Amasser", icon: "💰", mult: 3, cooldownS: 300 }),
  gainQuest({ id: "gain_rush", tier: "micro", title: "Récolte éclair:", icon: "💨", mult: 1.2, cooldownS: 240, timeLimitS: 60 }),
  {
    id: "bank_hoard",
    category: "banque",
    tier: "main",
    icon: "🏦",
    cooldownS: 480,
    eligible: (ctx) => ctx.bank > 500,
    target: (state, ctx) => ({ amount: Math.ceil(ctx.bank * 2.5) }),
    title: (meta) => `Avoir ${fmt(meta.amount)} en banque`,
    desc: () => "Accumule sans dépenser. La patience paie.",
    progress: (state, meta) => ({
      progress: Math.min(state.cookies || 0, meta.amount),
      target: meta.amount,
      done: (state.cookies || 0) >= meta.amount,
    }),
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 120), crmb: 1, discount: { value: 0.25, seconds: 45, label: "-25 % coûts" } }),
    weight: () => 1.1,
  },

  // ============ ACHAT / BÂTIMENTS ============
  buyQuest({ id: "buy_starter", tier: "micro", icon: "🛒", pool: CLICK_ITEMS, qty: 3, cooldownS: 90 }),
  buyQuest({ id: "buy_auto", tier: "micro", icon: "⚙️", pool: MINE_ITEMS, qty: 2, cooldownS: 90, categoryLabel: "minage" }),
  buyQuest({
    id: "buy_bulk",
    tier: "main",
    icon: "📦",
    pool: MINE_ITEMS,
    qty: (ctx) => byLevel(ctx, 5, 10, 20),
    cooldownS: 420,
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 150), buff: buff("cps", 1.5, 45, "×1,5 minage") }),
  }),
  {
    id: "diversify",
    category: "achat",
    tier: "main",
    icon: "🧩",
    cooldownS: 600,
    eligible: (ctx) => ctx.level !== "early",
    target: (state, ctx) => ({ kinds: byLevel(ctx, 4, 7, 10) }),
    title: (meta) => `Posséder ${meta.kinds} types de Cliqueurs et Mineurs`,
    desc: () => "Un empire équilibré résiste mieux.",
    progress: (state, meta) => {
      const kinds = ITEMS.filter((it) => (state.items[it.id] || 0) > 0).length;
      return { progress: Math.min(kinds, meta.kinds), target: meta.kinds, done: kinds >= meta.kinds };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 200), buff: buff("cps", 1.5, 60, "×1,5 minage") }),
    weight: () => 0.9,
  },
  {
    id: "upgrade_hunter",
    category: "achat",
    tier: "main",
    icon: "⬆️",
    cooldownS: 600,
    eligible: (ctx) => ctx.level !== "early",
    target: (state) => ({ count: 2, ownedAtStart: Object.keys(state.upgrades || {}).length }),
    title: (meta) => `Acheter ${meta.count} améliorations`,
    desc: () => "Les améliorations valent souvent mieux qu'un bâtiment de plus.",
    progress: (state, meta) => {
      const diff = Math.max(0, Object.keys(state.upgrades || {}).length - (meta.ownedAtStart || 0));
      return { progress: Math.min(diff, meta.count), target: meta.count, done: diff >= meta.count };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 240) }),
    weight: () => 1,
  },

  // ============ MINAGE ============
  {
    id: "cps_milestone",
    category: "minage",
    tier: "main",
    icon: "📈",
    cooldownS: 300,
    eligible: (ctx) => ctx.cps > 0,
    target: (state, ctx) => {
      const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 50_000, 250_000, 1e6];
      return { cpsTarget: steps.find((x) => x > ctx.cps) || Math.ceil(ctx.cps * 1.4) };
    },
    title: (meta) => `Miner ${fmt(meta.cpsTarget)} cookies par seconde`,
    desc: () => "Fais monter ton minage automatique.",
    progress: (state, meta, ctx) => ({
      progress: Math.min(ctx.cps, meta.cpsTarget),
      target: meta.cpsTarget,
      done: ctx.cps >= meta.cpsTarget,
    }),
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 120), crmb: 1, discount: { value: 0.25, seconds: 40, label: "-25 % coûts" } }),
    weight: () => 1.2,
  },
  {
    id: "idle_patience",
    category: "minage",
    tier: "micro",
    icon: "🧘",
    cooldownS: 300,
    eligible: (ctx) => ctx.cps >= 5,
    target: (state, ctx) => ({ amount: Math.ceil(ctx.cps * 45), lifetimeAtStart: state.lifetime || 0, clicksAtStart: state.stats.clicks || 0 }),
    title: (meta) => `Produire ${fmt(meta.amount)} sans cliquer`,
    desc: () => "Laisse tes Mineurs travailler. Un seul clic annule la quête.",
    progress: (state, meta) => {
      const clicked = (state.stats.clicks || 0) > (meta.clicksAtStart || 0);
      const gained = Math.max(0, (state.lifetime || 0) - (meta.lifetimeAtStart || 0));
      return {
        progress: Math.min(gained, meta.amount),
        target: meta.amount,
        done: !clicked && gained >= meta.amount,
        failed: clicked,
      };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 150), buff: buff("cps", 2, 30, "×2 minage") }),
    weight: (ctx) => (ctx.level === "early" ? 0.4 : 1),
  },

  // ============ CRYPTO ============
  {
    id: "crypto_first_buy",
    category: "crypto",
    tier: "main",
    icon: "🪙",
    cooldownS: 600,
    eligible: (ctx) => ctx.bank > ctx.crmbPrice * 0.5,
    target: (state) => ({ amount: 0.05, balanceAtStart: state.crypto?.totalBought || 0 }),
    title: () => "Acheter 0,05 CRMB au marché",
    desc: () => "Le marché fluctue. Achète quand le cours baisse.",
    progress: (state, meta) => {
      const diff = Math.max(0, (state.crypto?.totalBought || 0) - (meta.balanceAtStart || 0));
      return { progress: Math.min(diff, meta.amount), target: meta.amount, done: diff >= meta.amount };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 120) }),
    weight: () => 1.1,
  },
  {
    id: "crypto_stake",
    category: "crypto",
    tier: "main",
    icon: "🔒",
    cooldownS: 900,
    eligible: (ctx) => ctx.crmbBalance >= 0.05,
    target: (state) => ({ amount: 0.05, stakedAtStart: (state.crypto?.positions || []).length }),
    title: () => "Ouvrir une position de staking",
    desc: () => "Le staking booste toute ta production. Les paliers longs paient plus.",
    progress: (state, meta) => {
      const diff = Math.max(0, (state.crypto?.positions || []).length - (meta.stakedAtStart || 0));
      return { progress: Math.min(diff, 1), target: 1, done: diff >= 1 };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 180), crmb: 1, buff: buff("cps", 1.5, 60, "×1,5 minage") }),
    weight: () => 1.2,
  },
  {
    id: "crypto_miner",
    category: "crypto",
    tier: "main",
    icon: "⛏️",
    cooldownS: 900,
    eligible: (ctx) => ctx.bank >= MINERS[0].base * 0.6,
    target: (state) => ({ count: 1, minersAtStart: totalMiners(state.crypto?.miners) }),
    title: () => "Installer une machine d'extraction",
    desc: () => "Le matériel extrait du CRMB en continu, même hors-ligne.",
    progress: (state, meta) => {
      const diff = Math.max(0, totalMiners(state.crypto?.miners) - (meta.minersAtStart || 0));
      return { progress: Math.min(diff, meta.count), target: meta.count, done: diff >= meta.count };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 240), crmb: 1 }),
    weight: () => 1.1,
  },
  {
    id: "crypto_trader",
    category: "crypto",
    tier: "daily",
    icon: "📊",
    cooldownS: 3600,
    eligible: (ctx) => ctx.crmbBalance > 0.02 || ctx.bank > ctx.crmbPrice,
    target: (state) => ({ amount: 0.2, soldAtStart: state.crypto?.totalSold || 0 }),
    title: () => "Vendre 0,2 CRMB au marché",
    desc: () => "Achète bas, vends haut. Le spread est de 2 %.",
    progress: (state, meta) => {
      const diff = Math.max(0, (state.crypto?.totalSold || 0) - (meta.soldAtStart || 0));
      return { progress: Math.min(diff, meta.amount), target: meta.amount, done: diff >= meta.amount };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 300), crmb: 1 }),
    weight: () => 0.9,
  },
  {
    id: "crypto_whale",
    category: "crypto",
    tier: "daily",
    icon: "🐋",
    cooldownS: 7200,
    eligible: (ctx) => ctx.crmbBalance >= 0.5 || ctx.crmbStaked >= 0.5,
    target: () => ({ amount: 2 }),
    title: (meta) => `Détenir ${meta.amount} CRMB (portefeuille + staking)`,
    desc: () => "Deviens une baleine du CrumbCoin.",
    progress: (state, meta) => {
      const held = (state.crypto?.balance || 0) + (state.crypto?.positions || []).reduce((s, p) => s + p.amount, 0);
      return { progress: Math.min(held, meta.amount), target: meta.amount, done: held >= meta.amount };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 600), crmb: 5, buff: buff("cps", 2, 120, "×2 minage") }),
    weight: () => 0.7,
  },

  // ============ ÉVÉNEMENTS ============
  {
    id: "golden_hunter",
    category: "événement",
    tier: "main",
    icon: "⭐",
    cooldownS: 600,
    eligible: () => true,
    target: (state, ctx) => ({ count: byLevel(ctx, 1, 2, 3), goldenAtStart: state.stats.goldenClicks || 0 }),
    title: (meta) => `Attraper ${meta.count} cookie${meta.count > 1 ? "s" : ""} doré${meta.count > 1 ? "s" : ""}`,
    desc: () => "Ils apparaissent au hasard et disparaissent vite.",
    progress: (state, meta) => {
      const diff = Math.max(0, (state.stats.goldenClicks || 0) - (meta.goldenAtStart || 0));
      return { progress: Math.min(diff, meta.count), target: meta.count, done: diff >= meta.count };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 200), crmb: 1, buff: buff("cpc", 2, 30, "×2 au clic") }),
    weight: () => 1,
  },
  {
    id: "eat_cookie",
    category: "événement",
    tier: "main",
    icon: "😋",
    cooldownS: 900,
    eligible: (state) => true,
    target: (state) => ({ count: 1, eatenAtStart: state.cookieEatenCount || 0 }),
    title: () => "Croquer un cookie en entier",
    desc: () => "Chaque clic entame le biscuit. Va au bout.",
    progress: (state, meta) => {
      const diff = Math.max(0, (state.cookieEatenCount || 0) - (meta.eatenAtStart || 0));
      return { progress: Math.min(diff, meta.count), target: meta.count, done: diff >= meta.count };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 240), buff: buff("cpc", 1.75, 40, "×1,75 au clic") }),
    weight: () => 0.9,
  },

  // ============ COSMÉTIQUE ============
  {
    id: "skin_collector",
    category: "style",
    tier: "main",
    icon: "🎨",
    cooldownS: 1200,
    eligible: (ctx) => ctx.bank > 800,
    target: (state) => ({ count: Object.values(state.skinsOwned || {}).filter(Boolean).length + 1 }),
    title: (meta) => `Posséder ${meta.count} skins`,
    desc: () => "Change le look de ton cookie.",
    progress: (state, meta) => {
      const owned = Object.values(state.skinsOwned || {}).filter(Boolean).length;
      return { progress: Math.min(owned, meta.count), target: meta.count, done: owned >= meta.count };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 150) }),
    weight: () => 0.6,
  },

  // ============ QUOTIDIENNES ============
  {
    id: "daily_grind",
    category: "quotidien",
    tier: "daily",
    icon: "📅",
    cooldownS: 3600,
    eligible: () => true,
    target: (state, ctx) => ({ amount: Math.max(5000, Math.ceil(ctx.cps * 600)), lifetimeAtStart: state.lifetime || 0 }),
    title: (meta) => `Objectif du jour: ${fmt(meta.amount)} cookies`,
    desc: () => "La grosse récompense quotidienne.",
    progress: (state, meta) => {
      const gained = Math.max(0, (state.lifetime || 0) - (meta.lifetimeAtStart || 0));
      return { progress: Math.min(gained, meta.amount), target: meta.amount, done: gained >= meta.amount };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 900), crmb: 2, buff: buff("cps", 2.5, 120, "×2,5 minage") }),
    weight: () => 1,
  },
  {
    id: "daily_clicks",
    category: "quotidien",
    tier: "daily",
    icon: "🖱️",
    cooldownS: 3600,
    eligible: () => true,
    target: (state, ctx) => ({ clicks: byLevel(ctx, 300, 800, 1500), clicksAtStart: state.stats.clicks || 0 }),
    title: (meta) => `Objectif du jour: ${meta.clicks} clics`,
    desc: () => "Un peu d'huile de coude.",
    progress: (state, meta) => {
      const diff = Math.max(0, (state.stats.clicks || 0) - (meta.clicksAtStart || 0));
      return { progress: Math.min(diff, meta.clicks), target: meta.clicks, done: diff >= meta.clicks };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 600), crmb: 2, buff: buff("cpc", 2.5, 90, "×2,5 au clic") }),
    weight: () => 1,
  },
  {
    id: "daily_builder",
    category: "quotidien",
    tier: "daily",
    icon: "🏗️",
    cooldownS: 3600,
    eligible: () => true,
    target: (state, ctx) => ({
      count: byLevel(ctx, 10, 25, 50),
      ownedAtStart: totalOwned(state.items || {}, ITEMS),
    }),
    title: (meta) => `Objectif du jour: ${meta.count} bâtiments`,
    desc: () => "Construis, encore et encore.",
    progress: (state, meta) => {
      const diff = Math.max(0, totalOwned(state.items || {}, ITEMS) - (meta.ownedAtStart || 0));
      return { progress: Math.min(diff, meta.count), target: meta.count, done: diff >= meta.count };
    },
    reward: (state, ctx) => ({ cookies: cookieReward(ctx, 900), crmb: 2, discount: { value: 0.5, seconds: 120, label: "-50 % coûts" } }),
    weight: () => 1,
  },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export const CATEGORY_STYLE = {
  clic: { color: "sky", icon: "👆" },
  banque: { color: "amber", icon: "🍪" },
  achat: { color: "violet", icon: "🛒" },
  minage: { color: "emerald", icon: "⛏️" },
  crypto: { color: "cyan", icon: "🪙" },
  événement: { color: "yellow", icon: "⭐" },
  style: { color: "pink", icon: "🎨" },
  quotidien: { color: "orange", icon: "📅" },
};

// Résout title/desc qui peuvent être des chaînes ou des fonctions de meta
export const questTitle = (quest, meta) =>
  typeof quest.title === "function" ? quest.title(meta || {}, quest) : quest.title;
export const questDesc = (quest, meta) =>
  typeof quest.desc === "function" ? quest.desc(meta || {}, quest) : quest.desc;
