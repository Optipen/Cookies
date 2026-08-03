import { useEffect } from "react";
import { useLatestRef } from "./useLatestRef.js";
import { ACHIEVEMENTS, achievementReward } from "../data/achievements.js";
import { deriveStats } from "../utils/selectors.js";
import { fmt } from "../utils/format.js";
import { isFeatureEnabled } from "../utils/state.js";

const CHECK_MS = 1500;

/**
 * Vérifie les succès à intervalle fixe plutôt qu'à chaque changement d'état.
 *
 * L'ancienne version relançait les 8 conditions dans un effet dépendant de
 * `state.cookies`, donc 2 fois par seconde en plus de chaque clic. Ici c'est
 * borné, et un seul `setState` débloque tous les succès atteints d'un coup.
 */
export function useAchievements(state, setState, toast, onUnlock) {
  const stateRef = useLatestRef(state);
  const setStateRef = useLatestRef(setState);
  const toastRef = useLatestRef(toast);
  const unlockRef = useLatestRef(onUnlock);

  useEffect(() => {
    if (!isFeatureEnabled("ENABLE_ACHIEVEMENTS")) return;

    const iv = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;

      const stats = deriveStats(s);
      const newly = [];
      for (const a of ACHIEVEMENTS) {
        if (s.unlocked?.[a.id]) continue;
        try {
          if (a.cond(s, stats)) newly.push(a);
        } catch {
          // Une condition qui lève ne doit jamais bloquer les autres
        }
      }
      if (!newly.length) return;

      const totalReward = newly.reduce((sum, a) => sum + achievementReward(a.tier, stats.cps), 0);

      setStateRef.current((prev) => {
        const unlocked = { ...prev.unlocked };
        for (const a of newly) unlocked[a.id] = Date.now();
        return {
          ...prev,
          unlocked,
          cookies: prev.cookies + totalReward,
          lifetime: prev.lifetime + totalReward,
        };
      });

      // Une seule notification, même pour dix succès simultanés: en empiler
      // autant recouvrait la moitié de l'écran.
      const titre =
        newly.length === 1 ? `🏆 Succès — ${newly[0].name}` : `🏆 ${newly.length} succès débloqués`;
      const gain = totalReward > 0 ? ` · +${fmt(totalReward)} cookies` : "";
      toastRef.current(titre + gain, "success", { ms: 3600 });
      unlockRef.current?.(newly);
    }, CHECK_MS);

    return () => clearInterval(iv);
  }, [stateRef, setStateRef, toastRef, unlockRef]);
}
