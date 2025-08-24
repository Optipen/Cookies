import { useEffect, useRef } from "react";
import tuning from "../data/tuning.json";

export function useAutosave(state, saveFn) {
  const lastSaveRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const mode = (tuning && tuning.mode) || 'standard';
    const autosaveMs = (tuning && tuning[mode] && tuning[mode].loops && tuning[mode].loops.autosave_ms) || 3000;
    if (now - (lastSaveRef.current || 0) > autosaveMs) {
      lastSaveRef.current = now;
      try { saveFn(state); } catch {}
    }
  }, [state, saveFn]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState !== 'visible') { try { saveFn(state); } catch {} } };
    const onUnload = () => { try { saveFn(state); } catch {} };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [state, saveFn]);
}


