import { cpsFrom } from "./calc.js";
import { fmt } from "./format.js";

/**
 * Adaptation intelligente des récompenses de micro-missions selon le stade du jeu
 * @param {Object} state - État complet du jeu
 * @param {Object} mission - Mission complétée
 * @returns {Object} Pack de récompenses { cookies, buff, discount, description }
 */
export function rewardAdapter(state, mission) {
  const gameStage = detectGameStage(state);
  
  console.log(`[REWARD] Mission "${mission.id}" - Stage: ${gameStage.stage}`);
  
  switch (gameStage.stage) {
    case 'early':
      return calculateEarlyGameReward(state, mission, gameStage);
    case 'mid':
      return calculateMidGameReward(state, mission, gameStage);
    case 'late':
      return calculateLateGameReward(state, mission, gameStage);
    default:
      return calculateEarlyGameReward(state, mission, gameStage);
  }
}

/**
 * Détecte le stade du jeu basé sur différents indicateurs
 */
function detectGameStage(state) {
  const cookies = state.cookies || 0;
  const lifetime = state.lifetime || 0;
  const gameAge = Date.now() - (state.createdAt || Date.now());
  const gameAgeMinutes = gameAge / (1000 * 60);
  
  // Calcul CPS pour évaluer la progression
  const stakeMulti = 1 + (state.crypto?.staked || 0) * 0.5;
  const currentCPS = cpsFrom(state.items || {}, state.upgrades || {}, state.prestige?.chips || 0, stakeMulti);
  
  // Indicateurs de progression
  const totalItems = Object.values(state.items || {}).reduce((sum, count) => sum + count, 0);
  const upgradesCount = Object.keys(state.upgrades || {}).length;
  
  // Seuils adaptatifs
  if (
    lifetime < 10000 ||           // Moins de 10k cookies total
    currentCPS < 10 ||            // Moins de 10 CPS
    gameAgeMinutes < 30 ||        // Moins de 30 minutes
    totalItems < 20               // Moins de 20 objets
  ) {
    return {
      stage: 'early',
      cookies,
      lifetime,
      cps: currentCPS,
      age: gameAgeMinutes,
      items: totalItems,
      upgrades: upgradesCount
    };
  }
  
  if (
    lifetime < 1000000 ||         // Moins de 1M cookies total
    currentCPS < 500 ||           // Moins de 500 CPS
    gameAgeMinutes < 180 ||       // Moins de 3 heures
    totalItems < 100              // Moins de 100 objets
  ) {
    return {
      stage: 'mid',
      cookies,
      lifetime,
      cps: currentCPS,
      age: gameAgeMinutes,
      items: totalItems,
      upgrades: upgradesCount
    };
  }
  
  return {
    stage: 'late',
    cookies,
    lifetime,
    cps: currentCPS,
    age: gameAgeMinutes,
    items: totalItems,
    upgrades: upgradesCount
  };
}

/**
 * Récompenses early game (0-30min, <10k lifetime)
 */
function calculateEarlyGameReward(state, mission, gameStage) {
  const cookies = state.cookies || 0;
  
  // Cookies: min 25, max 2% des cookies actuels, plafonné à 500
  const cookieReward = Math.min(500, Math.max(25, Math.floor(cookies * 0.02)));
  
  // Buff léger: +10-15% pendant 15-20s
  const buffValue = 1.1 + Math.random() * 0.05; // 1.10 à 1.15
  const buffDuration = 15 + Math.random() * 5;   // 15-20s
  const buffType = Math.random() > 0.5 ? 'cpc' : 'cps';
  
  return {
    cookies: cookieReward,
    buff: {
      type: 'buff',
      kind: buffType,
      value: buffValue,
      seconds: Math.round(buffDuration),
      label: `+${Math.round((buffValue - 1) * 100)}% ${buffType.toUpperCase()}`
    },
    description: `+${fmt(cookieReward)} cookies + ${Math.round((buffValue - 1) * 100)}% ${buffType.toUpperCase()} (${Math.round(buffDuration)}s)`,
    stage: 'early'
  };
}

/**
 * Récompenses mid game (30min-3h, 10k-1M lifetime)
 */
function calculateMidGameReward(state, mission, gameStage) {
  const cookies = state.cookies || 0;
  const currentCPS = gameStage.cps;
  
  // Cookies: 1.5% des cookies actuels, min 100, plafonné selon CPS
  const cpsBasedCap = Math.max(1000, currentCPS * 60); // Au moins 1 minute de CPS
  const cookieReward = Math.min(cpsBasedCap, Math.max(100, Math.floor(cookies * 0.015)));
  
  // Buff moyen: +15-25% pendant 25-35s
  const buffValue = 1.15 + Math.random() * 0.10; // 1.15 à 1.25
  const buffDuration = 25 + Math.random() * 10;   // 25-35s
  const buffType = Math.random() > 0.3 ? 'cps' : 'cpc'; // Favorise CPS
  
  return {
    cookies: cookieReward,
    buff: {
      type: 'buff',
      kind: buffType,
      value: buffValue,
      seconds: Math.round(buffDuration),
      label: `+${Math.round((buffValue - 1) * 100)}% ${buffType.toUpperCase()}`
    },
    description: `+${fmt(cookieReward)} cookies + ${Math.round((buffValue - 1) * 100)}% ${buffType.toUpperCase()} (${Math.round(buffDuration)}s)`,
    stage: 'mid'
  };
}

/**
 * Récompenses late game (3h+, 1M+ lifetime)
 */
function calculateLateGameReward(state, mission, gameStage) {
  const cookies = state.cookies || 0;
  const currentCPS = gameStage.cps;
  
  // Cookies: 1% des cookies actuels, min selon CPS, plafonné raisonnablement
  const cpsBasedMin = Math.max(500, currentCPS * 30);  // Au moins 30s de CPS
  const cpsBasedCap = currentCPS * 300; // Max 5 minutes de CPS
  const cookieReward = Math.min(cpsBasedCap, Math.max(cpsBasedMin, Math.floor(cookies * 0.01)));
  
  // Alternance entre buff fort et discount
  const rewardType = Math.random();
  
  if (rewardType < 0.6) {
    // Buff fort: +25-40% pendant 40-60s
    const buffValue = 1.25 + Math.random() * 0.15; // 1.25 à 1.40
    const buffDuration = 40 + Math.random() * 20;   // 40-60s
    const buffType = Math.random() > 0.4 ? 'cps' : 'cpc';
    
    return {
      cookies: cookieReward,
      buff: {
        type: 'buff',
        kind: buffType,
        value: buffValue,
        seconds: Math.round(buffDuration),
        label: `+${Math.round((buffValue - 1) * 100)}% ${buffType.toUpperCase()}`
      },
      description: `+${fmt(cookieReward)} cookies + ${Math.round((buffValue - 1) * 100)}% ${buffType.toUpperCase()} (${Math.round(buffDuration)}s)`,
      stage: 'late'
    };
  } else {
    // Discount: -10-20% sur les achats pendant 45-90s
    const discountValue = 0.10 + Math.random() * 0.10; // 10% à 20%
    const discountDuration = 45 + Math.random() * 45;   // 45-90s
    
    return {
      cookies: cookieReward,
      discount: {
        type: 'discount',
        value: discountValue,
        seconds: Math.round(discountDuration),
        label: `-${Math.round(discountValue * 100)}% coûts`
      },
      description: `+${fmt(cookieReward)} cookies + ${Math.round(discountValue * 100)}% réduction (${Math.round(discountDuration)}s)`,
      stage: 'late'
    };
  }
}

/**
 * Applique les récompenses à l'état du jeu avec merge intelligent des buffs
 */
export function applyRewards(state, rewards, setState, toast) {
  const now = Date.now();
  
  setState((s) => {
    const newState = { ...s };
    
    // Ajoute les cookies
    if (rewards.cookies > 0) {
      newState.cookies = s.cookies + rewards.cookies;
      newState.lifetime = s.lifetime + rewards.cookies;
    }
    
    // Applique les buffs avec merge intelligent
    if (rewards.buff) {
      let buffs = { ...s.buffs };
      const until = now + (rewards.buff.seconds * 1000);
      
      if (rewards.buff.kind === 'cps') {
        buffs.cpsMulti = (buffs.cpsMulti || 1) * rewards.buff.value;
        // Limite la durée cumulée à 3 minutes max
        buffs.until = Math.min(now + 180000, Math.max(buffs.until || 0, until));
      } else {
        buffs.cpcMulti = (buffs.cpcMulti || 1) * rewards.buff.value;
        buffs.until = Math.min(now + 180000, Math.max(buffs.until || 0, until));
      }
      
      buffs.label = rewards.buff.label;
      newState.buffs = buffs;
    }
    
    // Applique les discounts
    if (rewards.discount) {
      const until = now + (rewards.discount.seconds * 1000);
      newState.flags = {
        ...s.flags,
        discountAll: {
          value: rewards.discount.value,
          until: until
        }
      };
    }
    
    // Historique des missions (optionnel)
    if (!newState.microMissions) {
      newState.microMissions = { history: [], lastRewardAt: 0 };
    }
    if (!newState.microMissions.history) {
      newState.microMissions.history = [];
    }
    
    // Ajoute à l'historique avec limite
    newState.microMissions.history.push({
      timestamp: now,
      missionId: state.activeMicroMission?.id,
      rewards: rewards,
      stage: rewards.stage
    });
    
    // Garde seulement les 20 dernières récompenses
    if (newState.microMissions.history.length > 20) {
      newState.microMissions.history = newState.microMissions.history.slice(-20);
    }
    
    newState.microMissions.lastRewardAt = now;
    
    return newState;
  });
  
  // Toast avec description complète
  toast(`Micro‑mission ✓ ${rewards.description}`, "success", { ms: 3500 });
  
  console.log(`[REWARD] Applied: ${rewards.description} (stage: ${rewards.stage})`);
}
