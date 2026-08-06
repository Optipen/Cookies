import { useEffect } from "react";
import { useLatestRef } from "./useLatestRef.js";
import { ETAPES } from "../data/guide.js";

/** Même cadence que les succès: une étape franchie n'a pas besoin d'être vue à la milliseconde. */
const CHECK_MS = 1000;

/**
 * Verrouille les étapes du Guide au fur et à mesure qu'elles sont franchies.
 *
 * Pourquoi un verrou plutôt qu'un simple test à l'affichage: trois étapes se
 * mesurent sur le PARC (« achète un Curseur », « prends le Four », « monte à
 * dix bâtiments »), et une Renaissance vide le parc. Sans lui, le jeu
 * réexpliquerait le clic à un joueur de quatre-vingts heures — la seule chose
 * qu'un guide ne doit jamais faire.
 *
 * Une minuterie, et non un effet réagissant à l'état: écrire dans l'état
 * pendant un effet déclenche des rendus en cascade, et c'est exactement le
 * genre de boucle que le reste du jeu a déjà appris à éviter (voir
 * `useAchievements`, bâti sur le même modèle).
 */
export function useGuide(state, setState) {
  const stateRef = useLatestRef(state);
  const setStateRef = useLatestRef(setState);

  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      // Rien à écrire dans le cas courant: on ne réveille pas React pour rien.
      const nouvelles = ETAPES.filter((e) => !s.guide?.faites?.[e.id] && e.fait(s));
      if (!nouvelles.length) return;

      setStateRef.current((prev) => {
        const faites = { ...(prev.guide?.faites || {}) };
        let change = false;
        for (const e of nouvelles) {
          // Re-vérifié sur `prev`: l'état a pu bouger depuis le calcul.
          if (!faites[e.id] && e.fait(prev)) {
            faites[e.id] = true;
            change = true;
          }
        }
        return change ? { ...prev, guide: { ...prev.guide, faites } } : prev;
      });
    }, CHECK_MS);

    return () => clearInterval(iv);
  }, [stateRef, setStateRef]);
}
