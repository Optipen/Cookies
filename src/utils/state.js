import { defaultCryptoState, CRMB, addCrmb } from "./crypto.js";
import { clampBestCombo } from "./combo.js";
import { getUpgrade } from "../data/upgrades.js";
import { TRACK_BY_ID } from "../data/ascension.js";
import { ITEM_BY_ID } from "../data/items.js";

// === Feature flags ===
// Un flag à false doit désactiver la feature *entièrement* — apparition comprise.
export const FEATURES = {
  ENABLE_SOUNDS: true,
  ENABLE_PARTICLES: true,
  ENABLE_COOKIE_EAT: true,
  ENABLE_CRYPTO: true,
  ENABLE_PRESTIGE: true,
  ENABLE_SKINS: true,
  ENABLE_QUESTS: true,
  ENABLE_ACHIEVEMENTS: true,
  ENABLE_GOLDEN_COOKIES: true,
  ENABLE_EVENTS: true,
  ENABLE_RAIN: true,
  ENABLE_FLYING_COOKIE: true,
};

export const STATE_VERSION = 5;

// === État neuf ===
// Fonction (et non constante) pour que chaque appel produise des objets frais:
// une constante partagée faisait fuiter des mutations entre parties.
export function createFreshState(now = Date.now()) {
  return {
    version: STATE_VERSION,
    cookies: 0,
    lifetime: 0,
    cpcBase: 1,
    items: {},
    upgrades: {},

    skin: "default",
    skinsOwned: { default: true, starter: false, early: false, caramel: false, noir: false, ice: false, fire: false },

    lastTs: now,
    createdAt: now,

    stats: {
      clicks: 0,
      lastPurchaseTs: now,
      goldenClicks: 0,
      totalSpent: 0,
      bestCps: 0,
      playtimeMs: 0,
      prestigeCount: 0,
      handmade: 0,
      bestCombo: 1,
    },

    flags: {
      offlineCollected: false,
      flash: null,
      discountAll: null,
      cryptoFlashUntil: 0,
      goldenLastTs: 0,
      goldenStacks: 0,
      freeFirstAutoGiven: false,
      freeFirstAutoItemId: null,
    },

    buffs: { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" },

    prestige: { chips: 0, spent: 0, upgrades: {} },
    // L'Ascension se place au-dessus du prestige: elle survit à tout, sauf à
    // une remise à zéro complète demandée par le joueur.
    ascension: { stars: 0, spent: 0, tracks: {}, count: 0 },

    ui: {
      sounds: true,
      introSeen: false,
      highContrast: false,
      reducedMotion: false,
      volume: 0.6,
    },

    notice: null,
    unlocked: {},
    fx: { banner: null, shakeUntil: 0, tag: null },

    crypto: defaultCryptoState(now),

    quests: {
      active: [],
      daily: [],
      cooldowns: {},
      completed: {},
      dailyResetAt: 0,
      streak: 0,
      lastDailyClaim: 0,
    },

    cookieEatEnabled: true,
    cookieEatenCount: 0,
    cookieBites: [],
  };
}

// === Clés de stockage ===
export const SAVE_KEY = "cookieCrazeSaveV5";
export const LEGACY_KEYS = ["cookieCrazeSaveV4", "cookieCrazeSaveV3", "cookieCrazeSaveV2", "cookieCrazeSaveV1"];
export const PENDING_RESET_KEY = "cookieCrazePendingReset";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Fusion profonde: la valeur sauvegardée gagne, la valeur par défaut comble les trous. */
function deepMerge(base, override) {
  if (!isObj(override)) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    const b = out[key];
    const o = override[key];
    out[key] = isObj(b) && isObj(o) ? deepMerge(b, o) : o;
  }
  return out;
}

const num = (v, fallback = 0) => (typeof v === "number" && isFinite(v) ? v : fallback);

// === Chargement ===
export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
  } catch {
    // localStorage indisponible (navigation privée, quota, iframe sandboxée)
    return createFreshState();
  }

  if (!raw) return createFreshState();

  try {
    return migrate(JSON.parse(raw));
  } catch {
    // Sauvegarde illisible: on l'archive avant de repartir à neuf
    try {
      localStorage.setItem(`${SAVE_KEY}_corrupted_${Date.now()}`, raw);
    } catch {
      // Stockage plein ou interdit: on repart à neuf sans archive
    }
    return createFreshState();
  }
}

// === Migration ===
export function migrate(savedState, now = Date.now()) {
  const fresh = createFreshState(now);
  if (!isObj(savedState)) return fresh;

  try {
    let merged = deepMerge(fresh, savedState);

    // --- Champs toujours reconstruits ---
    merged.version = STATE_VERSION;
    merged.notice = null;
    merged.fx = { banner: null, shakeUntil: 0, tag: null };
    // Les quantités sont assainies une par une: une sauvegarde bricolée avec
    // `{ oven: -20 }` donnait un minage de -40 /s, et la part reversée tirait
    // la puissance de clic en négatif avec elle.
    merged.items = {};
    if (isObj(savedState.items)) {
      for (const id of Object.keys(savedState.items)) {
        const n = Math.floor(num(savedState.items[id]));
        if (n > 0 && ITEM_BY_ID[id]) merged.items[id] = n;
      }
    }
    // Les améliorations sont générées: on écarte les identifiants qui ne
    // correspondent plus à rien (anciens `cursor_10`, `share:2`, `cpc:1`…),
    // sinon ils gonfleraient les compteurs sans produire d'effet.
    merged.upgrades = {};
    if (isObj(savedState.upgrades)) {
      for (const id of Object.keys(savedState.upgrades)) {
        if (savedState.upgrades[id] && getUpgrade(id)) merged.upgrades[id] = true;
      }
    }
    merged.unlocked = isObj(savedState.unlocked) ? { ...savedState.unlocked } : {};
    merged.cookieBites = Array.isArray(savedState.cookieBites) ? savedState.cookieBites : [];

    // --- Valeurs numériques défensives ---
    merged.cookies = Math.max(0, num(merged.cookies));
    merged.lifetime = Math.max(merged.cookies, num(merged.lifetime));
    merged.cpcBase = Math.max(1, num(merged.cpcBase, 1));
    merged.cookieEatenCount = Math.max(0, num(merged.cookieEatenCount));
    merged.lastTs = num(merged.lastTs, now);
    merged.createdAt = num(merged.createdAt, now);

    // Le combo allait jusqu'à ×3; il s'arrête à ×1,75. Un record hérité de
    // l'ancienne échelle afficherait une valeur devenue inatteignable.
    merged.stats.bestCombo = clampBestCombo(savedState.stats?.bestCombo);

    // --- Prestige: l'arbre céleste arrive en v5 ---
    merged.prestige = {
      chips: Math.max(0, num(savedState.prestige?.chips)),
      spent: Math.max(0, num(savedState.prestige?.spent)),
      upgrades: isObj(savedState.prestige?.upgrades) ? { ...savedState.prestige.upgrades } : {},
    };
    // Un `spent` supérieur aux chips gagnés viendrait d'une sauvegarde trafiquée
    if (merged.prestige.spent > merged.prestige.chips) merged.prestige.spent = merged.prestige.chips;

    // --- Ascension: arrive après la v5, absente de toutes les sauvegardes
    //     existantes. Les valeurs par défaut la rendent simplement inactive.
    const oldAsc = isObj(savedState.ascension) ? savedState.ascension : {};
    const tracks = {};
    if (isObj(oldAsc.tracks)) {
      for (const id of Object.keys(oldAsc.tracks)) {
        // Un niveau négatif ou fractionnaire donnerait un rang de bâtiment
        // fantôme et un multiplicateur global hors grille.
        const n = Math.floor(num(oldAsc.tracks[id]));
        if (n > 0 && TRACK_BY_ID[id]) tracks[id] = Math.min(n, TRACK_BY_ID[id].maxLevel);
      }
    }
    merged.ascension = {
      stars: Math.max(0, Math.floor(num(oldAsc.stars))),
      spent: Math.max(0, Math.floor(num(oldAsc.spent))),
      tracks,
      count: Math.max(0, Math.floor(num(oldAsc.count))),
    };
    if (merged.ascension.spent > merged.ascension.stars) merged.ascension.spent = merged.ascension.stars;

    // --- Crypto: v4 n'avait que balance/staked/mintedUnits ---
    const oldCrypto = isObj(savedState.crypto) ? savedState.crypto : {};
    merged.crypto = {
      ...defaultCryptoState(now),
      ...oldCrypto,
      name: CRMB.name,
      symbol: CRMB.symbol,
      balance: addCrmb(num(oldCrypto.balance), 0),
      // Contrats du Registre: un entier positif, quoi qu'il y ait eu dans la
      // sauvegarde. Un compteur bricolé donnerait un multiplicateur global
      // négatif, donc une production négative sur les deux axes à la fois.
      ledger: Math.max(0, Math.floor(num(oldCrypto.ledger))),
      // `mintedUnits`, `perCookies` et `perAmount` pilotaient le faucet, qui
      // n'existe plus: les garder ferait croire à une source de CRMB disparue.
      mintedUnits: undefined,
      perCookies: undefined,
      perAmount: undefined,
      totalEarned: addCrmb(num(oldCrypto.totalEarned), 0),
      price: num(oldCrypto.price, CRMB.basePrice),
      priceHistory: Array.isArray(oldCrypto.priceHistory) && oldCrypto.priceHistory.length
        ? oldCrypto.priceHistory.filter((p) => isFinite(p)).slice(-CRMB.historyLength)
        : [num(oldCrypto.price, CRMB.basePrice)],
      miners: isObj(oldCrypto.miners) ? { ...oldCrypto.miners } : {},
      positions: Array.isArray(oldCrypto.positions) ? oldCrypto.positions.filter(isObj) : [],
      lastMarketTs: num(oldCrypto.lastMarketTs, now),
      lastYieldTs: num(oldCrypto.lastYieldTs, now),
    };
    // Le staking « à plat » de la v4 devient une position flexible
    const legacyStaked = num(oldCrypto.staked);
    if (legacyStaked > 0 && !merged.crypto.positions.length) {
      merged.crypto.positions = [
        { id: "legacy", amount: legacyStaked, tierId: "flex", startedAt: now, unlockAt: 0 },
      ];
    }
    delete merged.crypto.staked;

    // --- Quêtes: remplacent missions/micro-missions de la v4 ---
    const oldQuests = isObj(savedState.quests) ? savedState.quests : {};
    merged.quests = {
      active: Array.isArray(oldQuests.active) ? oldQuests.active.filter(isObj) : [],
      daily: Array.isArray(oldQuests.daily) ? oldQuests.daily.filter(isObj) : [],
      cooldowns: isObj(oldQuests.cooldowns) ? { ...oldQuests.cooldowns } : {},
      completed: isObj(oldQuests.completed) ? { ...oldQuests.completed } : {},
      dailyResetAt: num(oldQuests.dailyResetAt),
      streak: Math.max(0, num(oldQuests.streak)),
      lastDailyClaim: num(oldQuests.lastDailyClaim),
    };
    // Champs morts des anciennes versions
    delete merged.mission;
    delete merged.activeMission;
    delete merged.activeMicroMission;
    delete merged.missionsState;
    delete merged.microMissions;
    delete merged.combo;
    delete merged.settings;

    // --- Flags volatils: on ne rejoue pas un état d'événement périmé ---
    merged.flags = {
      ...fresh.flags,
      ...(isObj(savedState.flags) ? savedState.flags : {}),
      flash: null,
      discountAll: null,
      cryptoFlashUntil: 0,
      offlineCollected: false,
    };
    merged.buffs = { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" };

    return merged;
  } catch {
    return fresh;
  }
}

// === Sauvegarde ===
export function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Quota dépassé ou stockage interdit: le jeu continue en mémoire
    return false;
  }
}

// === Feature flags ===
export const isFeatureEnabled = (name) => FEATURES[name] ?? false;

// === Reset ===
/**
 * Nouvelle partie. `preservePrestige` garde les chips et l'arbre céleste.
 * Chaque appel repart d'un état frais: aucune mutation partagée possible.
 */
export function createResetState({
  preservePrestige = true,
  prestige = null,
  ascension = null,
  sounds = true,
  // Un joueur qui relance une partie a déjà vu l'écran d'accueil: le lui
  // réimposer n'apporte rien. Seule une toute première partie l'affiche.
  introSeen = true,
  now = Date.now(),
} = {}) {
  const s = createFreshState(now);
  if (preservePrestige && prestige) {
    s.prestige = {
      chips: Math.max(0, num(prestige.chips)),
      spent: Math.max(0, num(prestige.spent)),
      upgrades: isObj(prestige.upgrades) ? { ...prestige.upgrades } : {},
    };
  }
  // L'Ascension survit au prestige: c'est la couche du dessus.
  if (ascension) {
    s.ascension = {
      stars: Math.max(0, Math.floor(num(ascension.stars))),
      spent: Math.max(0, Math.floor(num(ascension.spent))),
      tracks: isObj(ascension.tracks) ? { ...ascension.tracks } : {},
      count: Math.max(0, Math.floor(num(ascension.count))),
    };
  }
  s.ui.sounds = !!sounds;
  s.ui.introSeen = !!introSeen;
  return s;
}

// === Validation ===
export function validateState(state) {
  if (!isObj(state)) return false;
  for (const field of ["cookies", "items", "stats", "ui"]) {
    if (!(field in state)) return false;
  }
  if (typeof state.cookies !== "number" || !isFinite(state.cookies)) return false;
  if (!isObj(state.items)) return false;
  return true;
}

// === Import / export ===
export function exportSave(state) {
  return JSON.stringify({ game: "cookie-craze", version: STATE_VERSION, exportedAt: Date.now(), state });
}

/** Accepte le format v5, un état nu, ou l'ancien base64 de la v3. */
export function importSave(text) {
  const attempt = (raw) => {
    const parsed = JSON.parse(raw);
    const candidate = parsed && parsed.game === "cookie-craze" ? parsed.state : parsed;
    if (!validateState(candidate)) throw new Error("état invalide");
    return migrate(candidate);
  };
  try {
    return attempt(String(text));
  } catch {
    try {
      return attempt(decodeURIComponent(escape(atob(String(text)))));
    } catch {
      return null;
    }
  }
}
