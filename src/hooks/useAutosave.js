import { useEffect } from "react";
import { useLatestRef } from "./useLatestRef.js";
import tuning from "../data/tuning.json";

/**
 * Sauvegarde périodique + sauvegarde de sortie.
 *
 * L'écriture passe par un timer plutôt que par un effet dépendant de l'état:
 * la boucle de jeu modifie l'état 2 fois par seconde, ce qui déclenchait
 * autant de `JSON.stringify` sur l'objet complet.
 */
export function useAutosave(state, saveFn, { enabled = true, onEchec } = {}) {
  const stateRef = useLatestRef(state);
  const saveRef = useLatestRef(saveFn);
  const echecRef = useLatestRef(onEchec);

  useEffect(() => {
    if (!enabled) return;
    const cfg = tuning?.[tuning?.mode || "standard"]?.loops || {};
    const autosaveMs = cfg.autosave_ms || 5000;

    const persist = () => {
      const s = stateRef.current;
      if (!s) return;
      // On ne sérialise jamais la notification ni les effets visuels en cours
      const { notice, fx, ...persistable } = s;
      const ok = saveRef.current({ ...persistable, notice: null, fx: { banner: null, shakeUntil: 0, tag: null }, lastTs: Date.now() });
      // Une sauvegarde qui échoue doit se voir. Elle était jusqu'ici avalée en
      // silence: le jeu continuait, et la partie disparaissait au rechargement.
      if (ok === false) echecRef.current?.();
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
  }, [enabled, stateRef, saveRef, echecRef]);
}
