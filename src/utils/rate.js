// === Cadence créditée ===
//
// Le jeu accepte tous les clics — le cookie réagit, le son joue, les miettes
// volent — mais il ne CRÉDITE qu'un nombre borné de clics par seconde. Sans
// cette borne, un autoclicker à 50 clics/s obtenait deux cents fois plus de
// cookies qu'un joueur en cinq minutes.
//
// La borne est ici, pas dans le composant: la simulation d'équilibrage doit
// mesurer exactement ce que le jeu crédite, sinon elle décrit un autre jeu.

/**
 * Clics crédités par seconde, en régime établi.
 *
 * Quinze: c'est au-dessus de ce qu'on tient durablement à deux pouces (dix à
 * douze), et en dessous du moindre autoclicker (vingt et plus). La borne se
 * mesure sur une fenêtre glissante, pas sur l'intervalle entre deux clics: un
 * humain n'a pas une cadence régulière, et refuser un clic parce qu'il suit le
 * précédent de 60 ms punirait une rafale honnête.
 */
export const CREDIT_MAX_CPS = 15;

/** Fenêtre d'observation de la cadence créditée. */
export const CREDIT_WINDOW_MS = 1000;

/**
 * Réserve de rafale: clics crédités au-delà du régime établi quand la fenêtre
 * précédente était calme. C'est ce qui laisse passer un « double clic » ou une
 * accélération courte sans jamais laisser une cadence constante en profiter.
 */
export const CREDIT_BURST = 8;

/** Cadence réellement créditée pour une cadence brute donnée, en régime établi. */
export const creditedRate = (clicksPerSecond = 0) => {
  const c = Number(clicksPerSecond);
  if (!Number.isFinite(c) || c <= 0) return 0;
  return Math.min(c, CREDIT_MAX_CPS);
};
