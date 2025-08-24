import { useEffect, useRef } from "react";
import { MICRO_MISSIONS, MISSIONS } from "../data/missions.js";
import tuning from "../data/tuning.json";
import { fmt } from "../utils/format.js";
import { rewardAdapter, applyRewards } from "../utils/rewardAdapter.js";
// Adaptatif (optionnel)
import { buildPlayerContext } from "../missions/context.js";
import { selectMicroMission, evaluateProgress } from "../missions/selector.js";
import { isFeatureEnabled } from "../utils/state.js";

export function useMicroMissions(state, setState, toast) {
  const metaRef = useRef({});
  const awardingRef = useRef(false);
  
  // Si state est null/undefined (feature disabled), ne rien faire
  if (!state) {
    return;
  }

  // Pick a random micro mission different from the current (fallback non‑adaptatif)
  const pickNext = (excludeId, forbiddenTags = [], stateRef = state) => {
    const pool = MICRO_MISSIONS.filter((m) => m.id !== excludeId && !(m.tags || []).some(t => forbiddenTags.includes(t)));
    // Early-game bias: privilégie les missions taguées 'early' pendant la fenêtre early
    try {
      const mode = (tuning && tuning.mode) || 'standard';
      const earlyCfg = (tuning && tuning[mode] && tuning[mode].early) || {};
      const earlyActive = stateRef.createdAt && (Date.now() - stateRef.createdAt) / 1000 < (earlyCfg.window_s || 0);
      if (earlyActive) {
        const earlyPool = pool.filter((m) => (m.tags || []).includes('early'));
        if (earlyPool.length) return earlyPool[Math.floor(Math.random() * earlyPool.length)];
      }
    } catch {}
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Sélecteur adaptatif minimal derrière flag
  const ADAPTIVE = isFeatureEnabled('ENABLE_ADAPTIVE_MISSIONS');
  const pickNextAdaptive = (excludeId, forbiddenTags = [], stateRef = state) => {
    try {
      const ctx = buildPlayerContext(stateRef);
      const mainTags = (MISSIONS.find(x => x.id === stateRef.mission?.id)?.tags) || [];
      const history = stateRef.microMissions?.history?.map(h => ({ id: h.missionId })) || [];
      const cooldowns = stateRef.microMissions?.cooldowns || {};
      const sel = selectMicroMission(stateRef, ctx, { excludeId, forbiddenTags: [...forbiddenTags, ...mainTags], history, cooldowns });
      if (sel) {
        return { adaptive: true, ctx, sel };
      }
    } catch {}
    return { adaptive: false };
  };

  // Ensure we always have one active (always, regardless of main mission)
  useEffect(() => {
    // Assure qu'il y a toujours une micro-mission active
    if (!state.activeMicroMission || !state.activeMicroMission.id) {
      const a = ADAPTIVE && pickNextAdaptive(undefined, [], state);
      if (a && a.adaptive) {
        metaRef.current = a.sel.meta;
        setState((s) => ({ ...s, activeMicroMission: { id: a.sel.templateId, startedAt: Date.now(), meta: a.sel.meta, adaptive: true, title: a.sel.title, desc: a.sel.desc } }));
      } else {
        const m = pickNext(undefined, [], state);
        const meta = m.start ? m.start(state) : {};
        metaRef.current = meta;
        setState((s) => ({ ...s, activeMicroMission: { id: m.id, startedAt: Date.now(), meta } }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress and completion
  useEffect(() => {
    const curId = state.activeMicroMission?.id;
    if (!curId) return;
    
    const isAdaptive = !!state.activeMicroMission?.adaptive;
    let res;
    const meta = state.activeMicroMission?.meta || metaRef.current || {};
    if (isAdaptive) {
      res = evaluateProgress(state, { templateId: curId, meta });
    } else {
      const m = MICRO_MISSIONS.find((x) => x.id === curId);
      if (!m) return;
      if (m.checkTimed) res = m.checkTimed(state, meta);
      else if (m.checkDelta) res = m.checkDelta(state, meta);
      else res = m.check(state);
    }

    // Save live progress
    if (res) {
      const prevP = state.activeMicroMission?.progress;
      const prevT = state.activeMicroMission?.target;
      if (prevP !== res.progress || prevT !== res.target) {
        setState((s) => ({ ...s, activeMicroMission: { ...s.activeMicroMission, progress: res.progress, target: res.target } }));
      }
    }

    if (res && res.done && !awardingRef.current) {
      awardingRef.current = true;
      
      // Nouveau système de récompenses adaptatif — utilise le stage détecté
      const missionLike = isAdaptive ? { id: curId } : (MICRO_MISSIONS.find((x) => x.id === curId) || { id: curId });
      const adaptiveRewards = rewardAdapter(state, missionLike);
      
      // Applique les récompenses avec le nouveau système
      applyRewards(state, adaptiveRewards, setState, toast);
      
      // Prépare la prochaine mission (logique existante)
      const now = Date.now();
      setState((s) => {
        const mainTags = (MISSIONS.find(x => x.id === s.mission?.id)?.tags) || [];
        // Applique cooldowns micro à la complétion (tuning.json)
        try {
          const mode = (tuning && tuning.mode) || 'standard';
          const cfg = (tuning && tuning[mode] && tuning[mode].cooldowns && tuning[mode].cooldowns.micro) || {};
          const cd = (cfg && cfg[curId]) ? (cfg[curId] * 1000) : 0;
          if (cd > 0) {
            s = { ...s, microMissions: { ...s.microMissions, cooldowns: { ...(s.microMissions?.cooldowns || {}), [curId]: now + cd } } };
          }
        } catch {}

        if (ADAPTIVE) {
          const a = pickNextAdaptive(curId, mainTags, s);
          if (a && a.adaptive) {
            metaRef.current = a.sel.meta;
            return { ...s, activeMicroMission: { id: a.sel.templateId, startedAt: now, meta: a.sel.meta, progress: 0, target: undefined, adaptive: true, title: a.sel.title, desc: a.sel.desc } };
          }
        }
        const nx = pickNext(curId, mainTags, s);
        const nextMeta = nx.start ? nx.start(s) : {};
        metaRef.current = nextMeta;
        return { ...s, activeMicroMission: { id: nx.id, startedAt: now, meta: nextMeta, progress: 0, target: undefined } };
      });
      
      // Libère le verrou après le cycle
      setTimeout(() => { awardingRef.current = false; }, 50);
    }

    return () => {};
  }, [state.cookies, state.items, state.stats.clicks, state.activeMicroMission?.id, state.mission?.completed, state.mission?.id]);

  // Cleanup on unmount
  useEffect(() => () => {}, []);
}


