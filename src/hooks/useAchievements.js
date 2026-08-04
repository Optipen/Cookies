import { useEffect } from "react";
import { useLatestRef } from "./useLatestRef.js";
import { ACHIEVEMENTS, achievementReward, achievementCrmb } from "../data/achievements.js";
import { deriveStats } from "../utils/selectors.js";
import { fmt } from "../utils/format.js";
import { isFeatureEnabled } from "../utils/state.js";
import { addCrmb } from "../utils/crypto.js";

const CHECK_MS = 1500;

/**
 * Vérifie les succès à intervalle fixe plutôt qu'à chaque changement d'état.
 *
 * L'ancienne version relançait les 8 conditions dans un effet dépendant de
 * `state.cookies`, donc 2 fois par seconde en plus de chaque clic. Ici c'est
 * borné, et un seul `setState` débloque tous les succès atteints d'un coup.
 */
export function useAchievements(state, setState, notify, onUnlock) {
  const stateRef = useLatestRef(state);
  const setStateRef = useLatestRef(setState);
  const notifyRef = useLatestRef(notify);
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
      // Le CRMB ne tombe que pour les succès qui comptent, en nombres entiers.
      const totalCrmb = newly.reduce((sum, a) => sum + achievementCrmb(a.tier), 0);

      setStateRef.current((prev) => {
        const unlocked = { ...prev.unlocked };
        for (const a of newly) unlocked[a.id] = Date.now();
        const next = {
          ...prev,
          unlocked,
          cookies: prev.cookies + totalReward,
          lifetime: prev.lifetime + totalReward,
        };
        if (totalCrmb > 0) {
          next.crypto = {
            ...prev.crypto,
            balance: addCrmb(prev.crypto?.balance, totalCrmb),
            totalEarned: addCrmb(prev.crypto?.totalEarned, totalCrmb),
          };
        }
        return next;
      });

      // Une seule notification, même pour dix succès simultanés: en empiler
      // autant recouvrait la moitié de l'écran.
      const titre =
        newly.length === 1 ? `🏆 ${newly[0].name}` : `🏆 ${newly.length} succès débloqués`;
      const parts = [];
      if (totalReward > 0) parts.push(`+${fmt(totalReward)}`);
      if (totalCrmb > 0) parts.push(`+${totalCrmb} CRMB`);
      notifyRef.current.event(parts.length ? `${titre} · ${parts.join(" · ")}` : titre, "success");
      unlockRef.current?.(newly);
    }, CHECK_MS);

    return () => clearInterval(iv);
  }, [stateRef, setStateRef, notifyRef, unlockRef]);
}
