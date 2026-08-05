// === Gains d'événements ===
//
// Cookies dorés, pluie de miettes, cookie croqué: les barèmes vivent ici, en
// fonctions pures, et chaque gain sort POSÉ SUR LA RÈGLE des valeurs (quarts
// sous cent, entiers dès cent). Dans les hooks, « banque × 10 % » ou
// « clic × ×2,5 » produisait des nombres qui n'existent pas dans ce jeu —
// 3,125, 12 384,6 — et c'est le montant crédité qui doit être propre, pas
// seulement son affichage.

import { snapDown } from "./grid.js";

/**
 * Doré « Chance »: 10 % de la banque, plancher 25 s de minage, puis le
 * rendement décroissant des dorés enchaînés.
 */
export const gainChance = (state, stats, dr = 1) =>
  snapDown(Math.max((state.cookies || 0) * 0.1, (stats.cps || 0) * 25) * dr);

/** Doré « Jackpot »: soixante clics d'un coup, même rendement décroissant. */
export const gainJackpot = (stats, dr = 1) => snapDown((stats.cpc || 0) * 60 * dr);

/**
 * Miette de pluie: un multiplicateur NET du clic tiré dans une échelle en
 * quarts (×2 · ×2,5 · ×3), plancher deux secondes de minage.
 */
export const gainMiette = (stats, mult) =>
  snapDown(Math.max((stats.cpc || 0) * mult, (stats.cps || 0) * 2));

/**
 * Cookie croqué en entier: quarante clics — cent vingt pour le cinquième —
 * ou quarante-cinq secondes de minage, le plus généreux des deux.
 */
export const gainCroque = (stats, count) =>
  snapDown(
    Math.max((stats.perClick ?? stats.cpc ?? 0) * (count % 5 === 0 ? 120 : 40), (stats.mining ?? stats.cps ?? 0) * 45),
    0.25
  );
