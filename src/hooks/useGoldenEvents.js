import { useEffect, useRef, useState } from "react";
import tuning from "../data/tuning.json";
import { cpsFrom } from "../utils/calc.js";
import { fmt } from "../utils/format.js";

export function useGoldenEvents(state, setState, { isFeatureEnabled, toast, burstParticles, ping, play, cpc }) {
  const goldenTimerRef = useRef(null);
  const goldenHideTimerRef = useRef(null);
  const goldenClickLockRef = useRef(0);
  const [showGolden, setShowGolden] = useState(false);
  const goldenRef = useRef({ left: "50%", top: "50%" });

  const scheduleGolden = () => {
    if (!isFeatureEnabled('ENABLE_GOLDEN_COOKIES')) return;
    try { if (goldenTimerRef.current) { clearTimeout(goldenTimerRef.current); goldenTimerRef.current = null; } } catch {}
    const mode = (tuning && tuning.mode) || 'standard';
    const cfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.golden) || null;
    const ecfg = (tuning && tuning[mode] && tuning[mode].early && tuning[mode].early.golden) || null;
    const earlyActive = state.createdAt && (Date.now() - state.createdAt) / 1000 < ((tuning && tuning[mode] && tuning[mode].early && tuning[mode].early.window_s) || 0);
    const baseMin = cfg ? (cfg.cooldown_s?.[0] ?? 100) : 100;
    const baseMax = cfg ? (cfg.cooldown_s?.[1] ?? 150) : 150;
    const min = earlyActive && ecfg ? (ecfg.cooldown_s?.[0] ?? baseMin) : baseMin;
    const max = earlyActive && ecfg ? (ecfg.cooldown_s?.[1] ?? baseMax) : baseMax;
    const d = (min + Math.random() * (max - min)) * 1000;
    goldenTimerRef.current = setTimeout(() => {
      try { play('/sounds/golden_appear.mp3', 0.25); } catch {}
      setState((s) => ({
        ...s,
        fx: {
          ...s.fx,
          banner: { title: 'Cookie doré !', sub: 'Clique vite ✨', until: Date.now() + 1400, anim: { style: 'slide', inMs: 160, outMs: 160 } },
        },
      }));
      setShowGolden(true);
    }, d);
  };

  useEffect(() => {
    if (!isFeatureEnabled('ENABLE_GOLDEN_COOKIES')) return;
    if (!isFeatureEnabled('ENABLE_EVENTS')) return;
    scheduleGolden();
    return () => { try { if (goldenTimerRef.current) clearTimeout(goldenTimerRef.current); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isFeatureEnabled('ENABLE_GOLDEN_COOKIES')) return;
    if (showGolden) {
      const area = document.getElementById("game-area");
      if (area) {
        const r = area.getBoundingClientRect();
        const left = Math.random() * (r.width - 120) + 60 + r.left;
        const top  = Math.random() * (r.height - 200) + 120 + r.top;
        goldenRef.current = { left: `${left}px`, top: `${top}px` };
      }
      goldenHideTimerRef.current = setTimeout(() => { setShowGolden(false); scheduleGolden(); }, 10000);
      return () => { try { if (goldenHideTimerRef.current) clearTimeout(goldenHideTimerRef.current); } catch {} };
    }
  }, [showGolden]);

  const onGoldenClick = () => {
    if (!isFeatureEnabled('ENABLE_GOLDEN_COOKIES')) return;
    const nowClick = Date.now();
    if (nowClick < goldenClickLockRef.current) return; // anti double-click
    goldenClickLockRef.current = nowClick + 800;
    setShowGolden(false); scheduleGolden();

    // Enhanced golden sounds and effects
    ping(880, 0.1);
    try { play('/sounds/golden_appear.mp3', 0.6); } catch {}
    if (isFeatureEnabled('ENABLE_RAF_PARTICLES')) {
      burstParticles(50);
    }

    const now = Date.now();
    const mode = (tuning && tuning.mode) || 'standard';
    const gcfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.golden) || {};
    const drWindow = (gcfg.dr_window_s ?? 120) * 1000;
    const recent = now - (state.flags.goldenLastTs || 0) < drWindow;
    const stacks = recent ? (state.flags.goldenStacks || 0) + 1 : 0;
    const drBase = gcfg.dr_factor ?? 0.85;
    const dr = Math.pow(drBase, stacks);
    const roll = Math.random();

    const updateState = (additionalUpdates = {}) => {
      setState((s) => ({
        ...s,
        stats: { ...s.stats, goldenClicks: (s.stats.goldenClicks || 0) + 1 },
        flags: { ...s.flags, goldenLastTs: now, goldenStacks: stacks },
        ...additionalUpdates
      }));
    };

    if (roll < 0.35) {
      const cpsMax = gcfg.cps_mult_max ?? 5;
      const m = Math.max(1, Math.min(cpsMax, cpsMax * dr));
      applyBuff({ cpsMulti: m, cpcMulti: 1, seconds: 20, label: `FRENZY x${Math.round(m)}` });
      updateState();
      toast(`FRENZY: CPS x${Math.round(m)} pendant 20s !`, "success");
    }
    else if (roll < 0.65) {
      const cpcMax = gcfg.cpc_mult_max ?? 10;
      const m = Math.max(1, Math.min(cpcMax, cpcMax * dr));
      applyBuff({ cpsMulti: 1, cpcMulti: m, seconds: 12, label: `CLICK FRENZY x${Math.round(m)}` });
      updateState();
      toast(`CLICK FRENZY: CPC x${Math.round(m)} pendant 12s !`, "success");
    }
    else if (roll < 0.85) {
      const stakeM = 1 + (state.crypto?.staked || 0) * 0.5;
      const cpsNow = cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeM);
      const bankMin = gcfg.lucky_bank_min ?? 0.10;
      const cpsMult = gcfg.lucky_cps_mult ?? 12;
      const base = Math.max(state.cookies * bankMin, cpsNow * cpsMult);
      const bonus = base * dr;
      updateState({ cookies: state.cookies + bonus, lifetime: state.lifetime + bonus });
      toast(`Lucky +${fmt(bonus)} !`, "success");
    }
    else {
      burstParticles(30);
      const bonus = cpc * 30;
      updateState({ cookies: state.cookies + bonus, lifetime: state.lifetime + bonus });
      toast(`Pluie de miettes +${fmt(bonus)} !`, "success");
    }
  };

  const applyBuff = ({ cpsMulti = 1, cpcMulti = 1, seconds = 10, label = "" }) => {
    const until = Date.now() + seconds * 1000;
    setState((s) => ({ ...s, buffs: { cpsMulti, cpcMulti, until, label } }));
  };

  return { showGolden, setShowGolden, goldenRef, onGoldenClick, scheduleGolden };
}


