import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "./useLatestRef.js";
import { createNoticeQueue, LEVELS } from "../utils/notices.js";

// La logique vit dans `utils/notices.js`, en fonctions pures: c'est ce qui
// permet de MESURER combien de notifications une session d'une heure produit
// au lieu de l'estimer. Ce fichier ne fait que brancher la file sur React.
//
// Un seul emplacement, en haut de l'écran: une notification ne recouvre jamais
// la boutique ni la navigation, qui vivent sous le pouce.

export { QUIET_MS } from "../utils/notices.js";

/** Cadence à laquelle on demande à la file si quelque chose doit sortir. */
const TICK_MS = 250;

export function useNotify(setState) {
  // Créée une seule fois: la file a sa propre mémoire (silence en cours,
  // déduplication, majeurs récents) et la reconstruire à chaque rendu
  // l'effacerait.
  const [queue] = useState(createNoticeQueue);
  const timerRef = useRef(null);
  const setStateRef = useLatestRef(setState);

  const emit = useCallback(
    (level, msg, tone = "info", options = {}) => {
      queue.push(level, msg, { tone, group: options.group, ms: options.ms });
    },
    [queue]
  );

  const banner = useCallback((msg, tone, options) => emit("banner", msg, tone, options), [emit]);
  const event = useCallback((msg, tone, options) => emit("event", msg, tone, options), [emit]);
  const major = useCallback((msg, tone, options) => emit("major", msg, tone, options), [emit]);

  useEffect(() => {
    const iv = setInterval(() => {
      const suivante = queue.tick();
      if (!suivante) return;

      setStateRef.current((s) => ({
        ...s,
        notice: {
          id: suivante.id,
          msg: suivante.msg,
          tone: suivante.tone,
          level: suivante.level,
          count: suivante.count,
          at: Date.now(),
        },
      }));

      // L'expiration est reprogrammée à chaque sortie: une notification chasse
      // la précédente plutôt que de s'empiler dessus.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => {
          timerRef.current = null;
          setStateRef.current((s) => (s.notice?.id === suivante.id ? { ...s, notice: null } : s));
        },
        suivante.ms || LEVELS.banner.ms
      );
    }, TICK_MS);

    return () => {
      clearInterval(iv);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [queue, setStateRef]);

  return { banner, event, major };
}
