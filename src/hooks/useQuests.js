import { useEffect, useCallback } from "react";
import { useLatestRef } from "./useLatestRef.js";
import { buildContext, tickQuests, rerollQuest } from "../quests/engine.js";
import { fmt, fmtCrmb } from "../utils/format.js";
import { isFeatureEnabled } from "../utils/state.js";

const TICK_MS = 700;

/**
 * Pilote le moteur de quêtes.
 *
 * Le moteur étant une fonction pure, ce hook se contente de l'appeler à
 * intervalle fixe depuis un `setState` fonctionnel. Aucun effet ne dépend de
 * l'état des quêtes, donc aucune boucle de rendu — c'était le défaut de
 * l'ancien MissionEngine, qui se relançait à chaque `setState` qu'il produisait.
 */
export function useQuests(state, setState, notify, onCelebrate) {
  const stateRef = useLatestRef(state);
  const setStateRef = useLatestRef(setState);
  const notifyRef = useLatestRef(notify);
  const celebrateRef = useLatestRef(onCelebrate);

  useEffect(() => {
    if (!isFeatureEnabled("ENABLE_QUESTS")) return;

    const iv = setInterval(() => {
      const current = stateRef.current;
      if (!current || !current.ui?.introSeen) return;

      const ctx = buildContext(current);
      const now = Date.now();
      const result = tickQuests(current, ctx, now);
      if (!result.changed) return;

      setStateRef.current((prev) => {
        // Cas courant: l'état n'a pas bougé depuis le calcul, on réutilise le
        // résultat. Sinon (un clic est passé entre-temps) on recalcule sur
        // `prev` pour ne rien écraser.
        if (prev === current) return result.state;
        const fresh = tickQuests(prev, buildContext(prev), now);
        return fresh.changed ? fresh.state : prev;
      });

      // Une seule notification, même si trois quêtes tombent dans le même tick.
      // Les échecs ne s'annoncent plus du tout: la carte de quête l'indique, et
      // interrompre le joueur pour une mauvaise nouvelle qu'il n'a pas provoquée
      // n'apporte rien.
      const finies = result.events.filter((e) => e.type === "completed");
      if (finies.length) {
        const parts = [];
        const cookies = finies.reduce((a, e) => a + (e.reward?.cookies || 0), 0);
        const crmb = finies.reduce((a, e) => a + (e.reward?.crmb || 0), 0);
        if (cookies) parts.push(`+${fmt(cookies)}`);
        if (crmb) parts.push(`+${fmtCrmb(crmb, 0)} CRMB`);

        const titre =
          finies.length === 1
            ? `${finies[0].icon || "✅"} ${finies[0].daily ? "Quête du jour" : "Quête"} terminée`
            : `✅ ${finies.length} quêtes terminées`;
        notifyRef.current.event(parts.length ? `${titre} · ${parts.join(" · ")}` : titre, "success", { group: "quete" });
        for (const ev of finies) celebrateRef.current?.(ev);
      }
    }, TICK_MS);

    return () => clearInterval(iv);
  }, [stateRef, setStateRef, notifyRef, celebrateRef]);

  // Remplacer une quête est une action volontaire: la carte change sous les
  // yeux du joueur, une notification pour le lui annoncer serait du bruit.
  const reroll = useCallback(
    (questId) => {
      setStateRef.current((prev) => rerollQuest(prev, questId, buildContext(prev), Date.now()));
    },
    [setStateRef]
  );

  return { reroll };
}
