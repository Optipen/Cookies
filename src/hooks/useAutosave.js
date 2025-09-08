import { useEffect, useRef } from "react";
import tuning from "../data/tuning.json";
import { useAuth, useCSRF } from "./useAuth.jsx";
import { validateStateOperation } from "../utils/secureState.js";

export function useAutosave(state, saveFn) {
  const lastSaveRef = useRef(0);
  const { isAuthenticated } = useAuth();
  const { getToken } = useCSRF();

  // Secure save function that includes authentication checks
  const secureSaveFn = async (stateToSave) => {
    if (!isAuthenticated) {
      console.warn('[AUTOSAVE] Skipping save: user not authenticated');
      return;
    }

    if (!(await validateStateOperation('autosave', 'game:save'))) {
      console.warn('[AUTOSAVE] Skipping save: insufficient permissions');
      return;
    }

    try {
      const csrfToken = getToken();
      await saveFn(stateToSave, csrfToken);
    } catch (error) {
      console.error('[AUTOSAVE] Secure save failed:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const saveAsync = async () => {
      const now = Date.now();
      const mode = (tuning && tuning.mode) || 'standard';
      const autosaveMs = (tuning && tuning[mode] && tuning[mode].loops && tuning[mode].loops.autosave_ms) || 3000;
      if (now - (lastSaveRef.current || 0) > autosaveMs) {
        lastSaveRef.current = now;
        await secureSaveFn(state);
      }
    };

    saveAsync();
  }, [state, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const onVis = () => { 
      if (document.visibilityState !== 'visible') { 
        secureSaveFn(state);
      } 
    };
    const onUnload = () => { secureSaveFn(state); };
    
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [state, isAuthenticated]);
}


