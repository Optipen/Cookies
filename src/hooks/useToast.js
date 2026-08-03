import { useCallback, useEffect, useRef } from "react";

// Trois suffisent: au-delà, la pile recouvre la boutique sur mobile.
const MAX_TOASTS = 3;

/**
 * File de notifications bornée.
 *
 * Sans plafond, une avalanche de quêtes ou de succès empilait des dizaines de
 * toasts qui recouvraient le jeu. Ici la file garde les plus récents et les
 * minuteries sont annulées au démontage.
 */
export function useToast(setState) {
  const timersRef = useRef(new Set());

  const toast = useCallback(
    (msg, tone = "info", options = {}) => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = options.ms || 2800;

      setState((s) => {
        const list = s.toasts || [];
        // Évite les doublons visuels quand un même événement se répète vite
        const withoutDupes = list.filter((t) => t.msg !== msg);
        return { ...s, toasts: [...withoutDupes, { id, msg, tone }].slice(-MAX_TOASTS) };
      });

      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setState((s) => ({ ...s, toasts: (s.toasts || []).filter((t) => t.id !== id) }));
      }, duration);
      timersRef.current.add(timer);
    },
    [setState]
  );

  useEffect(
    () => () => {
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current.clear();
    },
    []
  );

  return { toast };
}
