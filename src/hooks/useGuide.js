import { useEffect, useRef } from "react";
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
export function useGuide(state, setState, onFranchie) {
  const stateRef = useLatestRef(state);
  const setStateRef = useLatestRef(setState);
  const franchieRef = useLatestRef(onFranchie);
  /**
   * Ce qui était DÉJÀ vrai quand le Guide est arrivé, capturé au montage.
   *
   * Une partie avancée remplit d'entrée toutes les conditions — elle possède
   * des Curseurs, un Four, dix bâtiments, des quêtes finies. Payer ces
   * étapes-là reviendrait à verser les sept primes d'un coup à quelqu'un qui
   * n'a rien franchi devant nous, simplement parce que le Guide vient
   * d'apparaître dans sa version du jeu.
   *
   * Une prime récompense un geste VU. Ce qui était déjà acquis est donc
   * verrouillé sans être payé; tout ce qui se franchit ENSUITE est payé.
   */
  const acquisRef = useRef(null);
  if (acquisRef.current === null) {
    acquisRef.current = new Set(ETAPES.filter((e) => e.fait(state)).map((e) => e.id));
  }

  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      // Rien à écrire dans le cas courant: on ne réveille pas React pour rien.
      const nouvelles = ETAPES.filter((e) => !s.guide?.faites?.[e.id] && e.fait(s));
      if (!nouvelles.length) return;

      const acquis = acquisRef.current;
      const franchies = [];
      setStateRef.current((prev) => {
        const faites = { ...(prev.guide?.faites || {}) };
        let change = false;
        let prime = 0;
        for (const e of nouvelles) {
          // Re-vérifié sur `prev`: l'état a pu bouger depuis le calcul.
          if (!faites[e.id] && e.fait(prev)) {
            faites[e.id] = true;
            change = true;
            // Déjà vrai au montage: on verrouille, on ne paie pas.
            if (!acquis.has(e.id)) {
              prime += e.recompense || 0;
              franchies.push(e);
            }
          }
        }
        if (!change) return prev;
        // La récompense est versée ICI, dans la même transition que le verrou:
        // une étape franchie ne peut donc jamais payer deux fois.
        return {
          ...prev,
          cookies: (prev.cookies || 0) + prime,
          lifetime: (prev.lifetime || 0) + prime,
          guide: { ...prev.guide, faites },
        };
      });
      // Hors du `setState`: on n'appelle pas l'interface depuis un réducteur.
      for (const e of franchies) franchieRef.current?.(e);
    }, CHECK_MS);

    return () => clearInterval(iv);
  }, [stateRef, setStateRef, franchieRef]);
}
