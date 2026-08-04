import { useCallback, useEffect, useRef } from "react";

// Une seule notification à l'écran, et rarement.
//
// L'ancienne version empilait jusqu'à trois toasts en bas à gauche, c'est-à-dire
// pile sur la boutique en mobile, et le jeu récompensait tant de petites choses
// qu'elle était pleine en permanence. Trois règles la remplacent:
//
//  1. **Un seul emplacement**, en haut. Une notification ne recouvre plus jamais
//     un bouton: la boutique et la navigation vivent en dessous.
//  2. **Une par tranche de dix secondes.** Ce qui arrive trop tôt est écarté, pas
//     mis en file — une file ne fait que retarder l'avalanche.
//  3. **Trois niveaux.** Ce qui est petit ne passe pas par ici du tout: un achat
//     s'annonce par un chiffre qui monte sur sa propre carte.

/** Délai minimal entre deux bandeaux ordinaires. */
export const QUIET_MS = 10_000;

const LEVELS = {
  // Petite information: n'apparaît que si le calme est revenu.
  banner: { ms: 2600, priority: 1 },
  // Déblocage, gros palier: mérite d'interrompre un bandeau ordinaire.
  event: { ms: 3400, priority: 2 },
  // Prestige, cookie doré, renaissance: toujours affiché, grande animation.
  major: { ms: 4200, priority: 3 },
};

export function useNotify(setState) {
  const timerRef = useRef(null);
  const lastRef = useRef(0);
  const shownRef = useRef(0);

  const emit = useCallback(
    (level, msg, tone = "info", options = {}) => {
      const cfg = LEVELS[level] || LEVELS.banner;
      const now = Date.now();

      // Le silence prime, sauf pour ce qui compte vraiment.
      if (cfg.priority < LEVELS.major.priority && now - lastRef.current < QUIET_MS) {
        if (cfg.priority <= shownRef.current) return;
      }
      lastRef.current = now;
      shownRef.current = cfg.priority;

      const id = `${now.toString(36)}-${(shownRef.current + msg.length).toString(36)}`;
      const duration = options.ms || cfg.ms;
      setState((s) => ({ ...s, notice: { id, msg, tone, level, at: now } }));

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        shownRef.current = 0;
        setState((s) => (s.notice?.id === id ? { ...s, notice: null } : s));
      }, duration);
    },
    [setState]
  );

  const banner = useCallback((msg, tone, options) => emit("banner", msg, tone, options), [emit]);
  const event = useCallback((msg, tone, options) => emit("event", msg, tone, options), [emit]);
  const major = useCallback((msg, tone, options) => emit("major", msg, tone, options), [emit]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { banner, event, major };
}
