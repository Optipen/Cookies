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
export function useQuests(state, setState, toast, onCelebrate) {
  const stateRef = useLatestRef(state);
  const setStateRef = useLatestRef(setState);
  const toastRef = useLatestRef(toast);
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

      for (const ev of result.events) {
        if (ev.type === "completed") {
          const parts = [];
          if (ev.reward?.cookies) parts.push(`+${fmt(ev.reward.cookies)} cookies`);
          if (ev.reward?.crmb) parts.push(`+${fmtCrmb(ev.reward.crmb)} CRMB`);
          if (ev.reward?.buff) parts.push(ev.reward.buff.label);
          if (ev.reward?.discount) parts.push(ev.reward.discount.label);
          toastRef.current(
            `${ev.icon || "✅"} ${ev.daily ? "Quête du jour" : "Quête"} — ${ev.title}${parts.length ? " · " + parts.join(" · ") : ""}`,
            "success",
            { ms: 4000 }
          );
          celebrateRef.current?.(ev);
        } else if (ev.type === "failed") {
          toastRef.current(`⌛ Quête échouée — ${ev.title}`, "warn", { ms: 2500 });
        }
      }
    }, TICK_MS);

    return () => clearInterval(iv);
  }, [stateRef, setStateRef, toastRef, celebrateRef]);

  const reroll = useCallback(
    (questId) => {
      setStateRef.current((prev) => rerollQuest(prev, questId, buildContext(prev), Date.now()));
      toastRef.current("Quête remplacée", "info", { ms: 1500 });
    },
    [setStateRef, toastRef]
  );

  return { reroll };
}
