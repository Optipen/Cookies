import { useEffect, useState } from "react";
import tuning from "../data/tuning.json";

export function useFlyingCookie(play, applyBuff, toast, setState) {
  const [flyingCookie, setFlyingCookie] = useState(null);

  useEffect(() => {
    const mode = (tuning && tuning.mode) || 'standard';
    const checkMs = (tuning && tuning[mode] && tuning[mode].loops && tuning[mode].loops.flying_cookie_check_ms) || 4000;
    const iv = setInterval(() => {
      if (flyingCookie) return;
      if (Math.random() < 0.035) {
        const area = document.getElementById('game-area'); const r = area?.getBoundingClientRect();
        const left = (r ? (Math.random() * (r.width - 120) + 60) : (Math.random() * 400 + 60));
        const top = (r ? (Math.random() * (r.height - 260) + 120) : (Math.random() * 240 + 120));
        setFlyingCookie({ id: Math.random().toString(36).slice(2), left, top, until: Date.now() + 3000 });
        try { play('/sounds/golden_appear.mp3', 0.35); } catch {}
      }
    }, checkMs);
    return () => clearInterval(iv);
  }, [flyingCookie, play]);

  useEffect(() => {
    if (!flyingCookie) return; const t = setTimeout(() => setFlyingCookie(null), Math.max(0, flyingCookie.until - Date.now()));
    return () => clearTimeout(t);
  }, [flyingCookie]);

  const onFlyingCookieClick = () => {
    if (!flyingCookie) return;
    setFlyingCookie(null);
    applyBuff({ cpsMulti: 1, cpcMulti: 1.2, seconds: 15, label: 'VITESSE +20% CPC' });
    toast('Vitesse: +20% CPC (15s)', 'success');
    setState((s) => ({ ...s, stats: { ...s.stats, goldenClicks: (s.stats.goldenClicks || 0) + 1 } }));
  };

  return { flyingCookie, setFlyingCookie, onFlyingCookieClick };
}


