import { useEffect, useState } from "react";

/**
 * Horloge partagée à basse fréquence.
 *
 * Les compteurs (buffs, ventes flash, chronos de quête) ont besoin de l'heure
 * courante. Appeler `Date.now()` pendant le rendu du composant principal
 * obligeait à re-rendre tout le jeu pour rafraîchir un chiffre; ici seuls les
 * petits composants qui consomment ce hook se re-rendent.
 *
 * Une seule minuterie sert tous les abonnés d'une même période.
 */
const subscribers = new Map(); // periodMs -> { timer, listeners:Set }

function subscribe(periodMs, listener) {
  let entry = subscribers.get(periodMs);
  if (!entry) {
    entry = { timer: null, listeners: new Set() };
    subscribers.set(periodMs, entry);
  }
  entry.listeners.add(listener);
  if (!entry.timer) {
    entry.timer = setInterval(() => {
      const now = Date.now();
      for (const l of entry.listeners) l(now);
    }, periodMs);
  }
  return () => {
    entry.listeners.delete(listener);
    if (!entry.listeners.size && entry.timer) {
      clearInterval(entry.timer);
      entry.timer = null;
    }
  };
}

export function useClock(periodMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    return subscribe(periodMs, setNow);
  }, [periodMs, enabled]);
  return now;
}

/** Temps restant avant `until`, rafraîchi automatiquement. */
export function useTimeLeft(until, periodMs = 200) {
  const enabled = !!until;
  const now = useClock(periodMs, enabled);
  if (!until) return 0;
  return Math.max(0, until - now);
}
