import { getInitialMission } from "../data/missions.js";

// === Feature Flags ===
export const FEATURES = {
  ENABLE_MICRO_MISSIONS: true,
  ENABLE_SOUNDS: true,
  ENABLE_RAF_PARTICLES: true,
  ENABLE_COOKIE_EAT: true,
  ENABLE_CRYPTO: true,
  ENABLE_PRESTIGE: true,
  ENABLE_SKINS: true,
  ENABLE_MISSIONS: true,
  ENABLE_ACHIEVEMENTS: true,
  ENABLE_GOLDEN_COOKIES: false,
  ENABLE_EVENTS: true, // rain, flash sales, etc.
  ENABLE_RAIN: false,  // pluie de cookies désactivée
};

// === Default State ===
export const DEFAULT_STATE = {
  version: 4,
  cookies: 0,
  lifetime: 0,
  cpcBase: 1,
  items: {},
  upgrades: {},
  
  // Skins state
  skin: "default",
  skinsOwned: { default: true, starter: false, early: false, caramel: false, noir: false, ice: false, fire: false },

  lastTs: Date.now(),
  createdAt: Date.now(),
  stats: { clicks: 0, lastPurchaseTs: Date.now(), goldenClicks: 0 },
  flags: { offlineCollected: false, flash: null, cryptoFlashUntil: 0, goldenLastTs: 0, goldenStacks: 0 },
  buffs: { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" },
  combo: { value: 1, lastClickTs: 0, lastRushTs: 0 },
  prestige: { chips: 0 },
  // Accessibilité & UI
  // Mode contraste élevé désactivé par défaut
  ui: { sounds: true, introSeen: false, highContrast: false },
  toasts: [],
  unlocked: {},
  fx: { banner: null, shakeUntil: 0 },
  crypto: { 
    name: "CrumbCoin", 
    symbol: "CRMB", 
    balance: 0, 
    staked: 0, 
    mintedUnits: 0, 
    perCookies: 20000, 
    perAmount: 0.001 
  },
  
  // Feature flags d'état (peuvent être modifiées à runtime)
  cookieEatEnabled: true,
  
  // Cookie eat progress & counters
  cookieEatenCount: 0,
  cookieBites: [],
  mission: null, // Sera initialisé par migrate()
  activeMicroMission: null,
  
  // Micro missions state
  microMissions: {
    lastCompletedAt: 0,
    cooldownUntil: 0,
    attempted: [],
    history: [],
    lastRewardAt: 0,
  },
  
  // Settings avec feature flags runtime
  settings: {
    soundEnabled: true,
    particlesEnabled: true,
    eventsEnabled: true,
  },
};

// === Storage Keys ===
export const SAVE_KEY = "cookieCrazeSaveV4";
export const PENDING_RESET_KEY = "cookieCrazePendingReset";

// === Safe State Loading ===
export function loadState() {
  try {
    // Essaie de charger depuis différentes versions
    const raw = localStorage.getItem(SAVE_KEY) 
      || localStorage.getItem("cookieCrazeSaveV3") 
      || localStorage.getItem("cookieCrazeSaveV2") 
      || localStorage.getItem("cookieCrazeSaveV1");
    
    if (!raw) {
      console.log("[STATE] Aucune sauvegarde trouvée, état par défaut");
      return migrate(null);
    }

    const parsed = JSON.parse(raw);
    console.log("[STATE] Sauvegarde chargée, version:", parsed?.version || "inconnue");
    return migrate(parsed);
    
  } catch (error) {
    console.error("[STATE] Erreur lors du chargement de la sauvegarde:", error);
    console.log("[STATE] Retour à l'état par défaut");
    
    // Sauvegarde corrompue - on la sauvegarde avant de la remplacer
    try {
      const corruptedData = localStorage.getItem(SAVE_KEY);
      if (corruptedData) {
        localStorage.setItem(`${SAVE_KEY}_corrupted_${Date.now()}`, corruptedData);
        console.log("[STATE] Sauvegarde corrompue archivée");
      }
    } catch (archiveError) {
      console.error("[STATE] Impossible d'archiver la sauvegarde corrompue:", archiveError);
    }
    
    return migrate(null);
  }
}

// === Robust Migration ===
export function migrate(savedState) {
  console.log("[MIGRATE] Début de la migration");
  
  // Si pas d'état sauvé, retourne l'état par défaut avec mission initiale
  if (!savedState) {
    const defaultWithMission = { ...DEFAULT_STATE };
    try {
      defaultWithMission.mission = getInitialMission();
    } catch (error) {
      console.error("[MIGRATE] Erreur lors de l'initialisation de la mission:", error);
      defaultWithMission.mission = { id: "first_click", startedAt: Date.now(), completed: false };
    }
    console.log("[MIGRATE] État par défaut créé");
    return defaultWithMission;
  }
  
  try {
    // Merge avec l'état par défaut pour assurer toutes les propriétés
    let merged = { ...DEFAULT_STATE, ...savedState };
    
    // === Migrations essentielles ===
    
    // Items et stats de base
    merged.items = merged.items || {};
    merged.stats = merged.stats || { clicks: 0, lastPurchaseTs: Date.now(), goldenClicks: 0 };
    
    // Flags critiques
    merged.flags = { 
      offlineCollected: false, 
      flash: null, 
      cryptoFlashUntil: 0, 
      goldenLastTs: 0, 
      goldenStacks: 0, 
      ...(merged.flags || {}) 
    };
    
    // Buffs et combo
    merged.buffs = merged.buffs || { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" };
    merged.combo = merged.combo || { value: 1, lastClickTs: 0, lastRushTs: 0 };
    
    // Prestige et UI
    merged.prestige = merged.prestige || { chips: 0 };
    merged.ui = { sounds: true, introSeen: false, highContrast: false, ...(merged.ui || {}) };
    
    // Upgrades et achievements
    merged.upgrades = merged.upgrades || {};
    merged.unlocked = merged.unlocked || {};
    
    // FX et crypto
    merged.fx = merged.fx || { banner: null, shakeUntil: 0 };
    merged.crypto = merged.crypto || { 
      name: "CrumbCoin", 
      symbol: "CRMB", 
      balance: 0, 
      staked: 0, 
      mintedUnits: 0, 
      perCookies: 20000, 
      perAmount: 0.001 
    };
    
    // === Migrations spécifiques aux nouvelles features ===
    
    // Skins
    merged.skin = merged.skin || "default";
    merged.skinsOwned = { 
      default: true, 
      starter: false,
      early: false,
      caramel: false, 
      noir: false, 
      ice: false, 
      fire: false, 
      ...(merged.skinsOwned || {}) 
    };
    
    // Cookie eating feature
    merged.cookieEatEnabled = merged.cookieEatEnabled ?? true;
    merged.cookieEatenCount = merged.cookieEatenCount ?? 0;
    merged.cookieBites = Array.isArray(merged.cookieBites) ? merged.cookieBites : [];
    
    // Missions
    if (!merged.mission) {
      try {
        merged.mission = getInitialMission();
      } catch (error) {
        console.error("[MIGRATE] Erreur lors de l'initialisation de la mission:", error);
        merged.mission = { id: "first_click", startedAt: Date.now(), completed: false };
      }
    }
    
    // Micro missions
    merged.activeMicroMission = merged.activeMicroMission || null;
    merged.microMissions = {
      lastCompletedAt: 0,
      cooldownUntil: 0,
      attempted: [],
      history: [],
      lastRewardAt: 0,
      ...(merged.microMissions || {})
    };
    
    // Assure les nouveaux champs de micro missions
    if (!merged.microMissions.history) {
      merged.microMissions.history = [];
    }
    if (!merged.microMissions.lastRewardAt) {
      merged.microMissions.lastRewardAt = 0;
    }
    
    // Settings avec feature flags
    merged.settings = {
      soundEnabled: true,
      particlesEnabled: true,
      eventsEnabled: true,
      ...(merged.settings || {})
    };
    
    // Assure la compatibilité des timestamps
    merged.lastTs = merged.lastTs || Date.now();
    merged.createdAt = merged.createdAt || Date.now();
    
    // Assure la version
    merged.version = 4;
    
    console.log("[MIGRATE] Migration réussie");
    return merged;
    
  } catch (error) {
    console.error("[MIGRATE] Erreur critique pendant la migration:", error);
    console.log("[MIGRATE] Retour à l'état par défaut en cas d'échec");
    
    // En cas d'erreur, retourne l'état par défaut
    const fallbackState = { ...DEFAULT_STATE };
    try {
      fallbackState.mission = getInitialMission();
    } catch (missionError) {
      console.error("[MIGRATE] Erreur lors de l'initialisation de la mission de fallback:", missionError);
      fallbackState.mission = { id: "first_click", startedAt: Date.now(), completed: false };
    }
    
    return fallbackState;
  }
}

// === Safe State Saving ===
export function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("[STATE] Erreur lors de la sauvegarde:", error);
    return false;
  }
}

// === Feature Flag Helpers ===
export function isFeatureEnabled(featureName) {
  return FEATURES[featureName] ?? false;
}

export function withFeatureFlag(featureName, component, fallback = null) {
  return isFeatureEnabled(featureName) ? component : fallback;
}

// === Reset Helpers ===
export function createResetState(preservePrestige = true, preserveSounds = true, prestigeChips = 0) {
  const resetState = { ...DEFAULT_STATE };
  
  try {
    resetState.mission = getInitialMission();
  } catch (error) {
    console.error("[RESET] Erreur lors de l'initialisation de la mission:", error);
    resetState.mission = { id: "first_click", startedAt: Date.now(), completed: false };
  }
  
  if (preservePrestige) {
    resetState.prestige = { chips: prestigeChips };
  }
  
  if (preserveSounds) {
    resetState.ui.sounds = true;
    resetState.settings.soundEnabled = true;
  }
  
  return resetState;
}

// === Validation Helpers ===
export function validateState(state) {
  if (!state || typeof state !== 'object') {
    return false;
  }
  
  // Vérifications critiques
  const requiredFields = ['cookies', 'items', 'stats', 'ui'];
  for (const field of requiredFields) {
    if (!(field in state)) {
      console.warn(`[VALIDATE] Champ manquant: ${field}`);
      return false;
    }
  }
  
  // Vérification des types
  if (typeof state.cookies !== 'number' || isNaN(state.cookies)) {
    console.warn('[VALIDATE] Cookies invalides');
    return false;
  }
  
  if (!state.items || typeof state.items !== 'object') {
    console.warn('[VALIDATE] Items invalides');
    return false;
  }
  
  return true;
}

// === Dev Tools ===
export function createIncompleteSave() {
  return {
    version: 2,
    cookies: 1000,
    items: { cursor: 5 },
    // Manque plein de champs pour tester la migration
  };
}

export function createCorruptedSave() {
  return JSON.stringify({ corrupted: true, data: "invalid" }).slice(0, 20) + "...truncated";
}
