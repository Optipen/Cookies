import { useCallback, useEffect, useState } from "react";
import tuning from "../data/tuning.json";

export function useCookieRain(cpc, ping, setState) {
  const [rainCrumbs, setRainCrumbs] = useState([]);
  const [rainUntil, setRainUntil] = useState(0);

  const startRain = useCallback(() => {
    const mode = (tuning && tuning.mode) || 'standard';
    const rcfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.rain) || {};
    const dur = (rcfg.duration_s ?? 8) * 1000;
    const until = Date.now() + dur; setRainUntil(until);
    const area = document.getElementById("game-area"); const r = area?.getBoundingClientRect();
    const width = r ? r.width : window.innerWidth;
    const arr = Array.from({ length: 50 }).map(() => ({ id: Math.random().toString(36).slice(2), x: Math.random() * (width - 40) + 20, y: -20, vy: 2 + Math.random() * 3 }));
    setRainCrumbs(arr); setTimeout(() => { setRainCrumbs([]); scheduleRain(); }, dur);
  }, []);

  const scheduleRain = useCallback(() => {
    const mode = (tuning && tuning.mode) || 'standard';
    const rcfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.rain) || {};
    const min = rcfg.cooldown_s?.[0] ?? 120;
    const max = rcfg.cooldown_s?.[1] ?? 240;
    const d = (min + Math.random() * (max - min)) * 1000;
    setTimeout(() => startRain(), d);
  }, [startRain]);

  useEffect(() => {
    const mode = (tuning && tuning.mode) || 'standard';
    const stepMs = (tuning && tuning[mode] && tuning[mode].loops && tuning[mode].loops.particles_step_ms) || 16;
    if (!rainCrumbs.length) return; const iv = setInterval(() => { setRainCrumbs((cc) => cc.map((c) => ({ ...c, y: c.y + c.vy * 3 })).filter((c) => c.y < window.innerHeight + 30)); }, stepMs);
    return () => clearInterval(iv);
  }, [rainCrumbs.length]);

  const onCrumbClick = useCallback((id) => {
    setRainCrumbs((cc) => cc.filter((c) => c.id !== id));
    const mode = (tuning && tuning.mode) || 'standard';
    const rcfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.rain) || {};
    const factor = Array.isArray(rcfg.cpc_factor)
      ? (rcfg.cpc_factor[0] + Math.random() * (rcfg.cpc_factor[1] - rcfg.cpc_factor[0]))
      : (rcfg.cpc_factor || 3);
    const gain = cpc * factor;
    setState((s) => ({ ...s, cookies: s.cookies + gain, lifetime: s.lifetime + gain }));
    ping(740, 0.05);
  }, [cpc, ping, setState]);

  return { rainCrumbs, rainUntil, scheduleRain, startRain, onCrumbClick };
}


