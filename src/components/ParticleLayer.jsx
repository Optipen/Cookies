import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

// === Couche de particules ===
//
// Point de performance central du jeu. L'ancienne version stockait les
// particules dans un state React et les faisait avancer via deux setInterval
// à 16 ms — ce qui re-rendait TOUT l'arbre (boutique, quêtes, succès) 120 fois
// par seconde, même quand il n'y avait aucune particule à l'écran.
//
// Ici: les particules vivent dans un ref, l'animation écrit directement dans le
// DOM via des transforms, et la boucle rAF s'arrête dès que la scène est vide.
// Aucun rendu React n'est déclenché par l'animation.

const MAX_PARTICLES = 260;
const COLORS = ["#8b5a2b", "#6b4423", "#a0522d", "#7b4a2e", "#c98a3f"];

const ParticleLayer = forwardRef(function ParticleLayer({ reducedMotion = false }, ref) {
  const hostRef = useRef(null);
  const itemsRef = useRef([]);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const frame = useCallback(
    (ts) => {
      const items = itemsRef.current;
      const dt = lastTsRef.current ? Math.min(64, ts - lastTsRef.current) : 16;
      lastTsRef.current = ts;
      // Normalise sur 60 fps: même vitesse sur un écran 60 ou 144 Hz
      const step = dt / 16.67;

      let alive = 0;
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        if (!p.el) continue;
        p.life -= step;
        if (p.life <= 0) {
          p.el.remove();
          p.el = null;
          continue;
        }
        p.vy += p.gravity * step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.rot += p.vr * step;
        const opacity = Math.min(1, p.life / 12);
        p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${p.rot.toFixed(0)}deg)`;
        p.el.style.opacity = opacity.toFixed(2);
        items[alive++] = p;
      }
      items.length = alive;

      if (alive > 0) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        // Plus rien à animer: on rend la main au navigateur
        rafRef.current = 0;
        lastTsRef.current = 0;
      }
    },
    []
  );

  const ensureRunning = useCallback(() => {
    if (!rafRef.current) {
      lastTsRef.current = 0;
      rafRef.current = requestAnimationFrame(frame);
    }
  }, [frame]);

  const spawn = useCallback(
    (particle) => {
      const host = hostRef.current;
      if (!host) return;
      const items = itemsRef.current;
      // Budget dur: sur une machine modeste, au-delà ça saccade
      if (items.length >= MAX_PARTICLES) {
        const dropped = items.shift();
        if (dropped?.el) dropped.el.remove();
      }
      const el = document.createElement("div");
      el.className = particle.className;
      el.style.cssText = particle.css;
      if (particle.text != null) el.textContent = particle.text;
      host.appendChild(el);
      items.push({ ...particle, el });
      ensureRunning();
    },
    [ensureRunning]
  );

  useImperativeHandle(
    ref,
    () => ({
      /** Chiffres flottants « +1,2K » qui montent depuis le cookie. */
      burstText(count, text, origin) {
        if (reducedMotion) return;
        const host = hostRef.current;
        if (!host) return;
        const rect = host.getBoundingClientRect();
        const base = origin || { x: rect.width / 2, y: rect.height / 2 };
        for (let i = 0; i < count; i++) {
          spawn({
            x: base.x + (Math.random() - 0.5) * 70,
            y: base.y + (Math.random() - 0.5) * 50,
            vx: (Math.random() - 0.5) * 1.1,
            vy: -1.6 - Math.random() * 1.4,
            gravity: 0.012,
            rot: 0,
            vr: 0,
            life: 34 + Math.random() * 12,
            text,
            className: "particle-text",
            css: "position:absolute;left:0;top:0;will-change:transform,opacity;pointer-events:none;",
          });
        }
      },
      /** Miettes physiques qui retombent. */
      burstCrumbs(count, origin) {
        if (reducedMotion) return;
        const host = hostRef.current;
        if (!host) return;
        const rect = host.getBoundingClientRect();
        const base = origin || { x: rect.width / 2, y: rect.height / 2 };
        for (let i = 0; i < count; i++) {
          const size = 3 + Math.random() * 6;
          const color = COLORS[Math.floor(Math.random() * COLORS.length)];
          spawn({
            x: base.x + (Math.random() - 0.5) * 60,
            y: base.y + (Math.random() - 0.5) * 60,
            vx: (Math.random() - 0.5) * 3.2,
            vy: -Math.random() * 3.4 - 0.8,
            gravity: 0.09,
            rot: Math.random() * 360,
            vr: (Math.random() - 0.5) * 16,
            life: 40 + Math.random() * 26,
            className: "particle-crumb",
            css: `position:absolute;left:0;top:0;width:${size.toFixed(1)}px;height:${size.toFixed(
              1
            )}px;border-radius:9999px;background:${color};will-change:transform,opacity;pointer-events:none;`,
          });
        }
      },
      /** Gerbe dorée pour les gros événements. */
      burstGold(count, origin) {
        if (reducedMotion) return;
        const host = hostRef.current;
        if (!host) return;
        const rect = host.getBoundingClientRect();
        const base = origin || { x: rect.width / 2, y: rect.height / 2 };
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const speed = 2.5 + Math.random() * 3;
          const size = 4 + Math.random() * 5;
          spawn({
            x: base.x,
            y: base.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            gravity: 0.07,
            rot: Math.random() * 360,
            vr: (Math.random() - 0.5) * 22,
            life: 46 + Math.random() * 20,
            className: "particle-gold",
            css: `position:absolute;left:0;top:0;width:${size.toFixed(1)}px;height:${size.toFixed(
              1
            )}px;border-radius:9999px;background:linear-gradient(135deg,#fde68a,#f59e0b);box-shadow:0 0 8px rgba(245,158,11,.7);will-change:transform,opacity;pointer-events:none;`,
          });
        }
      },
      clear() {
        for (const p of itemsRef.current) p.el?.remove();
        itemsRef.current = [];
        stop();
      },
      count: () => itemsRef.current.length,
    }),
    [spawn, stop, reducedMotion]
  );

  // Met l'animation en pause quand l'onglet passe en arrière-plan
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else if (itemsRef.current.length) {
        ensureRunning();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [ensureRunning, stop]);

  useEffect(() => {
    const host = hostRef.current;
    return () => {
      stop();
      itemsRef.current = [];
      if (host) host.innerHTML = "";
    };
  }, [stop]);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />;
});

export default ParticleLayer;
