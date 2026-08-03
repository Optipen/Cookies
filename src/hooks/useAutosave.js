import { useEffect, useRef } from "react";
import tuning from "../data/tuning.json";

/**
 * Sauvegarde périodique + sauvegarde de sortie.
 *
 * L'écriture passe par un timer plutôt que par un effet dépendant de l'état:
 * la boucle de jeu modifie l'état 2 fois par seconde, ce qui déclenchait
 * autant de `JSON.stringify` sur l'objet complet.
 */
export function useAutosave(state, saveFn, { enabled = true } = {}) {
  const stateRef = useRef(state);
  const saveRef = useRef(saveFn);
  stateRef.current = state;
  saveRef.current = saveFn;

  useEffect(() => {
    if (!enabled) return;
    const cfg = tuning?.[tuning?.mode || "standard"]?.loops || {};
    const autosaveMs = cfg.autosave_ms || 5000;

    const persist = () => {
      const s = stateRef.current;
      if (!s) return;
      // On ne sérialise jamais les toasts ni les effets visuels en cours
      const { toasts, fx, ...persistable } = s;
      saveRef.current({ ...persistable, toasts: [], fx: { banner: null, shakeUntil: 0, tag: null }, lastTs: Date.now() });
    };

    const iv = setInterval(persist, autosaveMs);

    // `pagehide` est le seul événement fiable sur iOS Safari; `beforeunload`
    // n'y est pas déclenché quand l'utilisateur ferme l'onglet.
    const onHide = () => persist();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persist();
    };

    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(iv);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      persist();
    };
  }, [enabled]);
}
