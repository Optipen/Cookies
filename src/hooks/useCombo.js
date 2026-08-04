import { useCallback, useEffect, useRef, useState } from "react";
import { COMBO, comboMultiplier } from "../utils/combo.js";

const UI_REFRESH_MS = 100;

/**
 * Chaîne de clics.
 *
 * Cliquer sans interruption fait monter un multiplicateur jusqu'à ×1,75;
 * s'arrêter le fait retomber en quelques secondes. C'est le mécanisme qui
 * récompense le jeu actif — sans lui, la meilleure stratégie serait de laisser
 * tourner l'onglet.
 *
 * La valeur vit dans un ref et n'est publiée à l'interface qu'à 10 Hz: à 15
 * clics par seconde, la mettre dans l'état déclencherait autant de rendus du
 * jeu entier.
 */
export function useCombo() {
  const streakRef = useRef(0);
  const lastClickRef = useRef(0);
  const [display, setDisplay] = useState({ streak: 0, mult: 1 });

  /** Enregistre un clic et rend le multiplicateur à appliquer. */
  const register = useCallback(() => {
    const now = Date.now();
    const since = now - lastClickRef.current;
    lastClickRef.current = now;

    const wasIdle = streakRef.current <= 0;
    if (since > COMBO.windowMs) {
      // Chaîne cassée: on repart d'un clic, pas de zéro, pour ne pas punir
      // le tout premier clic d'une session.
      streakRef.current = 1;
    } else {
      streakRef.current = Math.min(COMBO.streakCap, streakRef.current + 1);
    }
    // La jauge doit apparaître au premier clic, pas jusqu'à 100 ms plus tard.
    // Les clics suivants passent par la publication périodique.
    if (wasIdle) setDisplay({ streak: streakRef.current, mult: comboMultiplier(streakRef.current) });
    return comboMultiplier(streakRef.current);
  }, []);

  const reset = useCallback(() => {
    streakRef.current = 0;
    lastClickRef.current = 0;
    setDisplay({ streak: 0, mult: 1 });
  }, []);

  // Décroissance + publication vers l'interface
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const idle = now - lastClickRef.current;
      if (streakRef.current > 0 && idle > COMBO.windowMs) {
        const lost = (COMBO.decayPerSecond * UI_REFRESH_MS) / 1000;
        streakRef.current = Math.max(0, streakRef.current - lost);
      }
      const streak = streakRef.current;
      const mult = comboMultiplier(streak);
      setDisplay((prev) =>
        Math.abs(prev.mult - mult) < 0.01 && Math.abs(prev.streak - streak) < 0.5 ? prev : { streak, mult }
      );
    }, UI_REFRESH_MS);
    return () => clearInterval(iv);
  }, []);

  return { register, reset, streakRef, display };
}
