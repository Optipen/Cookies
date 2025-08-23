import { useEffect, useRef } from "react";

export function useSound(enabled) {
  const ctxRef = useRef(null);
  const buffersRef = useRef({});

  const ensureCtx = async () => {
    if (!enabled) return null;
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
    return ctx;
  };

  const load = async (url) => {
    if (!enabled) return null;
    if (buffersRef.current[url]) return buffersRef.current[url];
    const ctx = await ensureCtx(); if (!ctx) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buf = await new Promise((resolve, reject) => {
        try { ctx.decodeAudioData(arr, (b) => resolve(b), (e) => reject(e)); } catch (e) { reject(e); }
      });
      buffersRef.current[url] = buf;
      return buf;
    } catch { return null; }
  };

  const play = async (url, volume = 0.4) => {
    if (!enabled) return;
    try {
      const ctx = await ensureCtx(); if (!ctx) return;
      const buf = await load(url); if (!buf) return;
      const src = ctx.createBufferSource();
      const g = ctx.createGain(); g.gain.value = volume;
      src.buffer = buf; src.connect(g); g.connect(ctx.destination); src.start(0);
    } catch {}
  };

  useEffect(() => () => { try { ctxRef.current?.close(); } catch {}; ctxRef.current = null; buffersRef.current = {}; }, []);

  return { play };
}


