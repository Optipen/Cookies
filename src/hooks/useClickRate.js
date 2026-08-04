import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cadence de clic réellement mesurée, en clics par seconde.
 *
 * Le jeu affichait « 5 clics/s » partout — mais c'était `REF_CLICKS_PER_SECOND`,
 * une constante de calibration, jamais une mesure. Le joueur ne pouvait donc pas
 * savoir à quelle vitesse il cliquait, ni ce que ses clics lui rapportaient
 * vraiment par seconde.
 *
 * Choix de mesure, et pourquoi:
 *
 * · **Fenêtre glissante de 3 s.** Assez longue pour qu'un clic manqué ne fasse
 *   pas chuter l'affichage de moitié, assez courte pour réagir quand on
 *   accélère. À 1 s le nombre sautait à chaque clic, à 10 s il ne bougeait plus.
 * · **Publication à 5 Hz.** Le chiffre reste lisible; publier à chaque clic
 *   re-rendrait le jeu quinze fois par seconde.
 * · **Retour à zéro après 1,5 s sans clic.** Sinon la cadence resterait
 *   affichée alors que le joueur a lâché le cookie, et la « production des
 *   clics » mentirait.
 * · **Aucun plafond.** La cadence affichée est la cadence réelle, même à
 *   50 clics/s: c'est une mesure, pas une récompense. Le plafond anti-triche
 *   vit dans le crédit des cookies, pas ici.
 *
 * La valeur brute est irrégulière par nature (4,3333…). L'interface l'arrondit
 * au quart et la préfixe d'un « ≈ » — c'est une moyenne, l'annoncer autrement
 * serait malhonnête.
 */
export const RATE_WINDOW_MS = 3000;
export const RATE_IDLE_MS = 1500;
const PUBLISH_MS = 200;

export function useClickRate() {
  // Horodatages des clics récents. Un tableau simple suffit: il ne contient
  // jamais plus que la fenêtre, et on l'élague à chaque publication.
  const clicksRef = useRef([]);
  const [rate, setRate] = useState(0);

  const register = useCallback((now = Date.now()) => {
    clicksRef.current.push(now);
  }, []);

  const reset = useCallback(() => {
    clicksRef.current = [];
    setRate(0);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const clics = clicksRef.current;
      // Élagage: tout ce qui sort de la fenêtre ne compte plus.
      let i = 0;
      while (i < clics.length && clics[i] < now - RATE_WINDOW_MS) i++;
      if (i > 0) clics.splice(0, i);

      const dernier = clics.length ? clics[clics.length - 1] : 0;
      const inactif = now - dernier > RATE_IDLE_MS;
      // La fenêtre effective démarre au premier clic: sans cela, une rafale de
      // dix clics en une demi-seconde afficherait 3,3 clics/s au lieu de 20.
      const debut = clics.length ? Math.max(clics[0], now - RATE_WINDOW_MS) : now;
      const duree = Math.max(0.001, (now - debut) / 1000);
      const valeur = inactif || clics.length < 2 ? 0 : clics.length / duree;

      setRate((prev) => (Math.abs(prev - valeur) < 0.05 ? prev : valeur));
    }, PUBLISH_MS);
    return () => clearInterval(iv);
  }, []);

  return { register, reset, rate };
}
