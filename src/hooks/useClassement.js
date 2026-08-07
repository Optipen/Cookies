import { useEffect, useRef } from "react";
import { useLatestRef } from "./useLatestRef.js";
import { deriveStats } from "../utils/selectors.js";
import { addCrmb } from "../utils/crypto.js";
import { rivauxDevances, primeDepassement } from "../data/rivaux.js";

/** Même cadence que le Guide et les succès: un dépassement n'a pas besoin
 *  d'être constaté à la milliseconde. */
const CHECK_MS = 1000;

/**
 * Verrouille et récompense les rivaux dépassés.
 *
 * Le classement affiché reste VIVANT — un rival qui repasse devant redevient
 * un rival, et c'est ce qui donne envie de revenir. Mais la PRIME, elle, ne se
 * paie qu'une fois: sans verrou, un joueur posé pile sur la frontière d'un
 * rival encaisserait la prime à chaque oscillation, une fois par seconde.
 *
 * Une minuterie plutôt qu'un effet réagissant à l'état: écrire dans l'état
 * pendant un effet déclenche des rendus en cascade — le même modèle que
 * `useGuide` et `useAchievements`.
 *
 * TOUT SE DÉCIDE AVANT LE `setState`, et c'est le point délicat.
 * La version précédente remplissait la liste des rivaux à fêter DEPUIS le
 * réducteur, puis la parcourait juste après l'appel. React 18 n'exécute pas
 * toujours un réducteur sur-le-champ — il le diffère dès qu'une file de mises
 * à jour est déjà en cours, c'est-à-dire tout le temps dans un jeu qui appelle
 * `setState` deux fois par seconde. La liste était donc encore vide au moment
 * de la parcourir: mesuré en navigateur, les primes tombaient bien (+12 CRMB)
 * et AUCUNE célébration ne s'affichait. Le réducteur ne fait plus qu'écrire.
 */
export function useClassement(state, setState, onDepasse) {
  const stateRef = useLatestRef(state);
  const setStateRef = useLatestRef(setState);
  const depasseRef = useLatestRef(onDepasse);

  /**
   * Qui était DÉJÀ derrière quand le Classement est arrivé, capturé au montage.
   *
   * Une partie avancée devance d'entrée les six premiers rivaux. Les payer
   * reviendrait à verser six primes à quelqu'un qui n'a rien dépassé devant
   * nous, simplement parce que le Classement vient d'apparaître dans sa
   * version du jeu. On verrouille donc sans payer; tout ce qui se dépasse
   * ENSUITE est payé.
   */
  const acquisRef = useRef(null);
  if (acquisRef.current === null) {
    acquisRef.current = new Set(rivauxDevances(state).map((r) => r.id));
  }
  /** Rivaux déjà traités par ce montage, que l'état soit commité ou non: deux
   *  tics rapprochés ne peuvent pas payer deux fois le même dépassement. */
  const traitesRef = useRef(new Set());

  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      // Cas courant: rien de neuf. On ne réveille pas React pour rien.
      const nouveaux = rivauxDevances(s).filter(
        (r) => !s.classement?.battus?.[r.id] && !traitesRef.current.has(r.id)
      );
      if (!nouveaux.length) return;
      for (const r of nouveaux) traitesRef.current.add(r.id);

      // Déjà devancés au montage: on verrouille, on ne paie pas.
      const aFeter = nouveaux.filter((r) => !acquisRef.current.has(r.id));
      const stats = deriveStats(s, Date.now(), 0);
      const cookies = aFeter.length * primeDepassement(stats);
      const crmb = aFeter.reduce((n, r) => n + (r.crmb || 0), 0);

      setStateRef.current((prev) => {
        const battus = { ...(prev.classement?.battus || {}) };
        for (const r of nouveaux) battus[r.id] = true;
        const next = {
          ...prev,
          cookies: (prev.cookies || 0) + cookies,
          lifetime: (prev.lifetime || 0) + cookies,
          classement: { ...prev.classement, battus },
        };
        if (crmb > 0) {
          next.crypto = {
            ...prev.crypto,
            balance: addCrmb(prev.crypto?.balance, crmb),
            totalEarned: addCrmb(prev.crypto?.totalEarned, crmb),
          };
        }
        return next;
      });

      // Hors du réducteur: on n'appelle pas l'interface depuis un réducteur, et
      // surtout on ne dépend pas du moment où React choisit de l'exécuter.
      for (const r of aFeter) depasseRef.current?.(r);
    }, CHECK_MS);

    return () => clearInterval(iv);
  }, [stateRef, setStateRef, depasseRef]);
}
