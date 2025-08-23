import { useEffect, useRef } from "react";
import { MICRO_MISSIONS, MISSIONS } from "../data/missions.js";
import tuning from "../data/tuning.json";
import { fmt } from "../utils/format.js";
import { rewardAdapter, applyRewards } from "../utils/rewardAdapter.js";

export function useMicroMissions(state, setState, toast) {
  const metaRef = useRef({});
  const awardingRef = useRef(false);
  
  // Si state est null/undefined (feature disabled), ne rien faire
  if (!state) {
    return;
  }

  // Pick a random micro mission different from the current
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

  // Ensure we always have one active (always, regardless of main mission)
  useEffect(() => {
    // Assure qu'il y a toujours une micro-mission active
    if (!state.activeMicroMission || !state.activeMicroMission.id) {
      const m = pickNext(undefined, [], state);
      const meta = m.start ? m.start(state) : {};
      metaRef.current = meta;
      setState((s) => ({ ...s, activeMicroMission: { id: m.id, startedAt: Date.now(), meta } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress and completion
  useEffect(() => {
    const curId = state.activeMicroMission?.id;
    if (!curId) return;
    
    const m = MICRO_MISSIONS.find((x) => x.id === curId);
    if (!m) return;

    let res;
    const meta = state.activeMicroMission?.meta || metaRef.current || {};
    if (m.checkTimed) res = m.checkTimed(state, meta);
    else if (m.checkDelta) res = m.checkDelta(state, meta);
    else res = m.check(state);

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
      
      // Nouveau système de récompenses adaptatif
      const adaptiveRewards = rewardAdapter(state, m);
      
      // Applique les récompenses avec le nouveau système
      applyRewards(state, adaptiveRewards, setState, toast);
      
      // Prépare la prochaine mission (logique existante)
      const now = Date.now();
      setState((s) => {
        const mainTags = (MISSIONS.find(x => x.id === s.mission?.id)?.tags) || [];
        const nx = pickNext(m.id, mainTags, s);
        const nextMeta = nx.start ? nx.start(s) : {};
        metaRef.current = nextMeta;
        
        return {
          ...s,
          activeMicroMission: { id: nx.id, startedAt: now, meta: nextMeta, progress: 0, target: undefined },
        };
      });
      
      // Libère le verrou après le cycle
      setTimeout(() => { awardingRef.current = false; }, 50);
    }

    return () => {};
  }, [state.cookies, state.items, state.stats.clicks, state.activeMicroMission?.id, state.mission?.completed, state.mission?.id]);

  // Cleanup on unmount
  useEffect(() => () => {}, []);
}


