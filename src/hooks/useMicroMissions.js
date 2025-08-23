import { useEffect, useRef } from "react";
import { MICRO_MISSIONS, MISSIONS } from "../data/missions.js";
import { fmt } from "../utils/format.js";

export function useMicroMissions(state, setState, toast) {
  const metaRef = useRef({});
  const awardingRef = useRef(false);

  // Pick a random micro mission different from the current
  const pickNext = (excludeId, forbiddenTags = []) => {
    const pool = MICRO_MISSIONS.filter((m) => m.id !== excludeId && !(m.tags || []).some(t => forbiddenTags.includes(t)));
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Ensure we always have one active
  useEffect(() => {
    if (!state.activeMicroMission || !state.activeMicroMission.id) {
      const m = pickNext(undefined, []);
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
      const rw = m.reward(state) || {};
      const now = Date.now();
      const until = now + ((rw.seconds || 20) * 1000);
      const addCookies = Math.max(25, Math.floor((state.cookies || 0) * 0.05));

      setState((s) => {
        let buffs = { ...s.buffs };
        if (rw.type === "buff") {
          if (rw.kind === "cps") buffs.cpsMulti = (buffs.cpsMulti || 1) * (rw.value || 1.2);
          else buffs.cpcMulti = (buffs.cpcMulti || 1) * (rw.value || 1.2);
          buffs.until = Math.max(buffs.until || 0, until);
          buffs.label = rw.label || "MICRO";
        }
        let flags = { ...s.flags };
        if (rw.type === "discount") {
          flags.discountAll = { value: rw.value || 0.1, until };
        }
        const mainTags = (MISSIONS.find(x => x.id === s.mission?.id)?.tags) || [];
        const nx = pickNext(m.id, mainTags);
        const nextMeta = nx.start ? nx.start(s) : {};
        metaRef.current = nextMeta;
        return {
          ...s,
          buffs,
          flags,
          cookies: s.cookies + addCookies,
          lifetime: s.lifetime + addCookies,
          activeMicroMission: { id: nx.id, startedAt: now, meta: nextMeta, progress: 0, target: undefined },
        };
      });
      toast(`Micro‑mission: ${m.title} ✓ (+${fmt(addCookies)} cookies)`, "success");
      // Libère le verrou après le cycle
      setTimeout(() => { awardingRef.current = false; }, 50);
    }

    return () => {};
  }, [state.cookies, state.items, state.stats.clicks, state.activeMicroMission?.id]);

  // Cleanup on unmount
  useEffect(() => () => {}, []);
}


