import { useCallback, useEffect, useMemo, useRef } from "react";

// Une seule table de sons, résolue via BASE_URL pour marcher aussi
// sous-répertoire (GitHub Pages, preview Vercel, iframe).
const base = () => {
  const b = import.meta?.env?.BASE_URL || "/";
  return b.endsWith("/") ? b : b + "/";
};

const SOUNDS = {
  crunch: ["crunch.mp3", "crunch-1.mp3", "crunch-2.mp3"],
  buy: ["crunch-1.mp3"],
  bigBuy: ["crunch-2.mp3"],
  golden: ["sounds/golden_appear.mp3"],
  error: ["crunch.mp3"],
};

/**
 * Audio WebAudio avec décodage mis en cache.
 *
 * Le contexte n'est créé qu'au premier geste utilisateur: les navigateurs
 * refusent l'audio avant interaction, et créer le contexte trop tôt le laissait
 * bloqué en `suspended`.
 */
export function useAudio(enabled, volume = 0.6) {
  const ctxRef = useRef(null);
  const buffersRef = useRef(new Map());
  const pendingRef = useRef(new Map());
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);

  enabledRef.current = enabled;
  volumeRef.current = volume;

  const ensureCtx = useCallback(async () => {
    if (!enabledRef.current) return null;
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctxRef.current) {
      try {
        ctxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }
    return ctx;
  }, []);

  const load = useCallback(
    async (url) => {
      if (buffersRef.current.has(url)) return buffersRef.current.get(url);
      if (pendingRef.current.has(url)) return pendingRef.current.get(url);

      const task = (async () => {
        const ctx = await ensureCtx();
        if (!ctx) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const arr = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(arr);
          buffersRef.current.set(url, buf);
          return buf;
        } catch {
          buffersRef.current.set(url, null); // échec mémorisé: on ne retente pas
          return null;
        } finally {
          pendingRef.current.delete(url);
        }
      })();

      pendingRef.current.set(url, task);
      return task;
    },
    [ensureCtx]
  );

  /** Bip de secours quand un fichier audio manque. */
  const beep = useCallback(
    async (freq = 520, duration = 0.05) => {
      const ctx = await ensureCtx();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.value = 0.06 * volumeRef.current;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.stop(ctx.currentTime + duration);
      } catch {}
    },
    [ensureCtx]
  );

  const play = useCallback(
    async (name, gainValue = 0.4) => {
      if (!enabledRef.current) return;
      const files = SOUNDS[name];
      if (!files) return;
      const file = files[Math.floor(Math.random() * files.length)];
      try {
        const ctx = await ensureCtx();
        if (!ctx) return;
        const buf = await load(base() + file);
        if (!buf) {
          beep(name === "golden" ? 880 : 520, 0.05);
          return;
        }
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = gainValue * volumeRef.current;
        src.buffer = buf;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);
      } catch {}
    },
    [beep, ensureCtx, load]
  );

  // Précharge au premier geste: le son du premier clic n'est plus en retard
  useEffect(() => {
    if (!enabled) return;
    const warm = () => {
      for (const files of Object.values(SOUNDS)) {
        for (const f of files) load(base() + f);
      }
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
    window.addEventListener("pointerdown", warm, { once: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, [enabled, load]);

  useEffect(
    () => () => {
      try {
        ctxRef.current?.close();
      } catch {}
      ctxRef.current = null;
      buffersRef.current.clear();
    },
    []
  );

  return useMemo(() => ({ play, beep }), [play, beep]);
}
