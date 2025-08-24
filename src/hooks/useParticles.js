import { useEffect, useMemo, useRef, useState } from "react";
import tuning from "../data/tuning.json";

export function useParticles(cpc, fmt) {
  const [particles, setParticles] = useState([]);
  const [crumbs, setCrumbs] = useState([]);
  const cookieWrapRef = useRef(null);
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => { mousePos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const burstParticles = useMemo(() => (n = 10, at = null, labelText = null) => {
    const rect = cookieWrapRef.current?.getBoundingClientRect();
    const base = at || (rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 });
    const arr = Array.from({ length: n }).map(() => ({
      id: Math.random().toString(36).slice(2),
      x: base.x + (Math.random() - 0.5) * 80,
      y: base.y + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -Math.random() * 2 - 1,
      life: 16 + Math.random() * 10,
      text: labelText != null ? labelText : `+${fmt(cpc)}`
    }));
    setParticles((p) => [...p, ...arr]);
  }, [cpc, fmt]);

  useEffect(() => {
    const mode = (tuning && tuning.mode) || 'standard';
    const stepMs = (tuning && tuning[mode] && tuning[mode].loops && tuning[mode].loops.particles_step_ms) || 16;
    const speed = (tuning && tuning[mode] && tuning[mode].particles && tuning[mode].particles.burst_speed) || 4;
    const iv = setInterval(() => {
      setParticles((pp) => pp
        .map((p) => ({ ...p, x: p.x + p.vx * speed, y: p.y + p.vy * speed, life: p.life - 1 }))
        .filter((p) => p.life > 0));
    }, stepMs);
    return () => clearInterval(iv);
  }, []);

  const burstCrumbs = useMemo(() => (n = 12, at = null) => {
    const rect = cookieWrapRef.current?.getBoundingClientRect();
    const base = at || (rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 });
    const colors = ["#8b5a2b", "#6b4423", "#a0522d", "#7b4a2e"]; // bruns variés
    const arr = Array.from({ length: n }).map(() => ({
      id: Math.random().toString(36).slice(2),
      x: base.x + (Math.random() - 0.5) * 40,
      y: base.y + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 2.2,
      vy: -Math.random() * 2.8 - 0.6,
      life: 22 + Math.random() * 14,
      size: 3 + Math.random() * 6,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setCrumbs((p) => [...p, ...arr]);
  }, []);

  useEffect(() => {
    const mode = (tuning && tuning.mode) || 'standard';
    const stepMs = (tuning && tuning[mode] && tuning[mode].loops && tuning[mode].loops.particles_step_ms) || 16;
    const speed = (tuning && tuning[mode] && tuning[mode].particles && tuning[mode].particles.crumbs_speed) || 3.6;
    const gravity = (tuning && tuning[mode] && tuning[mode].particles && tuning[mode].particles.crumbs_gravity) || 0.04;
    const iv = setInterval(() => {
      setCrumbs((pp) => pp
        .map((p) => ({ ...p, x: p.x + p.vx * speed, y: p.y + p.vy * speed, vy: p.vy + gravity, life: p.life - 1, rot: p.rot + p.vr }))
        .filter((p) => p.life > 0));
    }, stepMs);
    return () => clearInterval(iv);
  }, []);

  return { particles, setParticles, crumbs, setCrumbs, cookieWrapRef, burstParticles, burstCrumbs };
}


