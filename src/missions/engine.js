// Moteur de missions unifié - gère missions principales et micro-missions de façon cohérente
import { buildPlayerContext } from "./context.js";
import { selectMainMission, selectMicroMission, evaluateMainProgress, evaluateProgress } from "./selector.js";
import { MAIN_TEMPLATES, MICRO_TEMPLATES } from "./templates.js";
import { applyRewards } from "../utils/rewardAdapter.js";
import tuning from "../data/tuning.json";

/**
 * Moteur unifié de missions - gère le cycle complet
 */
export class MissionEngine {
  constructor(state, setState, toast) {
    this.state = state;
    this.setState = setState;
    this.toast = toast;
  }

  /**
   * Initialise ou met à jour les missions actives
   */
  update() {
    const ctx = buildPlayerContext(this.state);
    
    // Gère mission principale
    this.updateMainMission(ctx);
    
    // Gère micro-mission
    this.updateMicroMission(ctx);
  }

  updateMainMission(ctx) {
    const current = this.state.activeMission;
    
    if (!current) {
      // Sélectionne première mission
      this.selectNewMainMission(ctx);
      return;
    }

    try {
      // Évalue progression
      const result = evaluateMainProgress(this.state, ctx, current);
      if (!result) return;

      // Met à jour progression
      this.setState(s => ({
        ...s,
        activeMission: {
          ...s.activeMission,
          progress: result.progress,
          target: result.target
        }
      }));

      // Vérifie complétion
      if (result.done) {
        this.completeMainMission(current, ctx);
      }
    } catch (e) {
      console.error('[ENGINE] Erreur updateMainMission:', e);
    }
  }

  updateMicroMission(ctx) {
    const current = this.state.activeMicroMission;
    
    if (!current) {
      // Sélectionne première micro-mission
      this.selectNewMicroMission(ctx);
      return;
    }

    try {
      // Évalue progression
      const result = evaluateProgress(this.state, current);
      if (!result) return;

      // Met à jour progression sans boucle setState
      const shouldUpdate = 
        result.progress !== current.progress || 
        result.target !== current.target;
      
      if (shouldUpdate) {
        this.setState(s => ({
          ...s,
          activeMicroMission: {
            ...s.activeMicroMission,
            progress: result.progress,
            target: result.target
          }
        }));
      }

      // Vérifie complétion
      if (result.done) {
        this.completeMicroMission(current, ctx);
      }
    } catch (e) {
      console.error('[ENGINE] Erreur updateMicroMission:', e);
    }
  }

  selectNewMainMission(ctx, excludeId = null) {
    const options = {
      excludeId,
      forbiddenTags: this.getForbiddenTags('main'),
      cooldowns: this.state.missionsState?.cooldowns || {},
      history: this.state.missionsState?.history || []
    };

    const selection = selectMainMission(this.state, ctx, options);
    if (!selection) return;

    this.setState(s => ({
      ...s,
      activeMission: {
        templateId: selection.templateId,
        meta: selection.meta,
        title: selection.title,
        desc: selection.desc,
        startedAt: Date.now(),
        progress: 0,
        target: 0
      }
    }));
  }

  selectNewMicroMission(ctx, excludeId = null) {
    const options = {
      excludeId,
      forbiddenTags: this.getForbiddenTags('micro'),
      cooldowns: this.state.missionsState?.microCooldowns || {},
      history: this.state.missionsState?.microHistory || []
    };

    const selection = selectMicroMission(this.state, ctx, options);
    if (!selection) return;

    this.setState(s => ({
      ...s,
      activeMicroMission: {
        templateId: selection.templateId,
        meta: selection.meta,
        title: selection.title,
        desc: selection.desc,
        startedAt: Date.now(),
        progress: 0,
        target: 0
      }
    }));
  }

  completeMainMission(mission, ctx) {
    console.log('[ENGINE] Complétion mission principale:', mission.templateId);
    
    // Une seule setState pour tout
    this.setState(s => {
      let newState = { ...s };
      
      // Applique cooldown
      try {
        const mode = (tuning && tuning.mode) || 'standard';
        const cooldowns = tuning?.[mode]?.cooldowns?.main || {};
        const cooldownSeconds = cooldowns[mission.templateId];
        
        if (cooldownSeconds > 0) {
          const until = Date.now() + (cooldownSeconds * 1000);
          newState.missionsState = {
            ...newState.missionsState,
            cooldowns: {
              ...newState.missionsState?.cooldowns,
              [mission.templateId]: until
            }
          };
        }
      } catch (e) {
        console.warn('[COOLDOWN] Erreur:', e);
      }
      
      // Historique
      const historyEntry = {
        templateId: mission.templateId,
        completedAt: Date.now(),
        duration: Date.now() - mission.startedAt
      };
      
      const currentHistory = newState.missionsState?.history || [];
      newState.missionsState = {
        ...newState.missionsState,
        history: [...currentHistory, historyEntry].slice(-20)
      };
      
      // Sélectionne nouvelle mission
      const options = {
        excludeId: mission.templateId,
        forbiddenTags: this.getForbiddenTags('main'),
        cooldowns: newState.missionsState?.cooldowns || {},
        history: newState.missionsState?.history || []
      };

      const selection = selectMainMission(newState, ctx, options);
      if (selection) {
        newState.activeMission = {
          templateId: selection.templateId,
          meta: selection.meta,
          title: selection.title,
          desc: selection.desc,
          startedAt: Date.now(),
          progress: 0,
          target: 0
        };
      } else {
        newState.activeMission = null;
      }
      
      return newState;
    });
    
    // Récompenses après setState
    try {
      const template = MAIN_TEMPLATES.find(t => t.id === mission.templateId);
      if (template?.reward) {
        const reward = template.reward(this.state, ctx);
        if (reward) {
          const normalizedReward = {
            cookies: 0,
            [reward.type === 'buff' ? 'buff' : 'discount']: reward,
            description: reward.label || 'Mission principale',
            stage: ctx.level
          };
          applyRewards(this.state, normalizedReward, this.setState, this.toast);
        }
      }
    } catch (e) {
      console.warn('[MISSION] Erreur récompense:', e);
    }
  }

  async completeMicroMission(mission, ctx) {
    console.log('[ENGINE] Complétion micro-mission:', mission.templateId);
    
    // Une seule setState pour tout
    this.setState(s => {
      let newState = { ...s };
      
      // Applique cooldown
      try {
        const mode = (tuning && tuning.mode) || 'standard';
        const cooldowns = tuning?.[mode]?.cooldowns?.micro || {};
        const cooldownSeconds = cooldowns[mission.templateId];
        
        if (cooldownSeconds > 0) {
          const until = Date.now() + (cooldownSeconds * 1000);
          newState.missionsState = {
            ...newState.missionsState,
            microCooldowns: {
              ...newState.missionsState?.microCooldowns,
              [mission.templateId]: until
            }
          };
        }
      } catch (e) {
        console.warn('[MICRO COOLDOWN] Erreur:', e);
      }
      
      // Historique
      const historyEntry = {
        templateId: mission.templateId,
        completedAt: Date.now(),
        duration: Date.now() - mission.startedAt
      };
      
      const currentHistory = newState.missionsState?.microHistory || [];
      newState.missionsState = {
        ...newState.missionsState,
        microHistory: [...currentHistory, historyEntry].slice(-20)
      };
      
      // Sélectionne nouvelle micro-mission
      const options = {
        excludeId: mission.templateId,
        forbiddenTags: this.getForbiddenTags('micro'),
        cooldowns: newState.missionsState?.microCooldowns || {},
        history: newState.missionsState?.microHistory || []
      };

      const selection = selectMicroMission(newState, ctx, options);
      if (selection) {
        newState.activeMicroMission = {
          templateId: selection.templateId,
          meta: selection.meta,
          title: selection.title,
          desc: selection.desc,
          startedAt: Date.now(),
          progress: 0,
          target: 0
        };
      } else {
        newState.activeMicroMission = null;
      }
      
      return newState;
    });
    
    // Récompenses après setState
    try {
      const missionLike = { id: mission.templateId };
      const { rewardAdapter } = await import("../utils/rewardAdapter.js");
      const adaptiveRewards = rewardAdapter(this.state, missionLike);
      applyRewards(this.state, adaptiveRewards, this.setState, this.toast);
    } catch (e) {
      console.warn('[MICRO] Erreur récompense:', e);
    }
  }

  // Méthodes applyCooldown et addToHistory intégrées dans les méthodes complete*

  getForbiddenTags(type) {
    // Évite conflits entre mission principale et micro-mission
    const mainMission = this.state.activeMission;
    const microMission = this.state.activeMicroMission;
    
    let forbidden = [];
    
    if (type === 'main' && microMission) {
      const microTemplate = MICRO_TEMPLATES.find(t => t.id === microMission.templateId);
      if (microTemplate?.tags) {
        forbidden.push(...microTemplate.tags);
      }
    } else if (type === 'micro' && mainMission) {
      const mainTemplate = MAIN_TEMPLATES.find(t => t.id === mainMission.templateId);
      if (mainTemplate?.tags) {
        forbidden.push(...mainTemplate.tags);
      }
    }

    return forbidden;
  }
}

/**
 * Hook unifié pour le moteur de missions
 */
export function useMissionsEngine(state, setState, toast) {
  if (!state) return;

  const engine = new MissionEngine(state, setState, toast);
  engine.update();
}
