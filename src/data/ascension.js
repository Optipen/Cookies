// === L'Ascension ===
//
// Le problème qu'elle résout, mesuré avant de l'écrire:
//
//   · tout le contenu du jeu était découvert en 3 h 54. Trois cent soixante
//     jours plus tard, il n'y avait toujours rien de neuf à attendre;
//   · la production passait de 1,07e9/s au trentième jour à 5,69e9/s au
//     trois-cent-soixante-cinquième — un facteur 2,8 en onze mois.
//
// Le prestige ne pouvait pas corriger ça, et pour une raison structurelle: les
// chips valent la racine cubique de la production totale, et leur bonus est
// logarithmique en chips. Le levier s'aplatit donc deux fois. Ajouter des
// prestiges plus généreux n'aurait fait que déplacer le mur.
//
// Ce qu'il fallait, c'est du CONTENU — des bâtiments qui n'existaient pas —, et
// c'est ce que l'Ascension débloque. Elle se place au-dessus du prestige:
//
//   clics → bâtiments → paliers → prestige (chips) → ASCENSION (étoiles)
//
// Une ascension remet à zéro la partie ET les chips ET l'arbre céleste. Elle
// garde: les étoiles, le portefeuille CRMB, le Registre, les apparences et les
// succès. C'est une renaissance de renaissance.

import { niceIntAt } from "../utils/grid.js";

/**
 * Chips nécessaires pour une première ascension.
 *
 * Cinq mille chips: entre le huitième et le dixième jour de jeu régulier, une
 * fois que le prestige a cessé d'apporter grand-chose. Arriver plus tôt aurait
 * empilé deux boucles de renaissance sur un joueur qui découvre encore la
 * première.
 */
export const ASCENSION_MIN_CHIPS = 5_000;

/**
 * Étoiles que rapporterait une ascension immédiate.
 *
 * Racine cubique, comme les chips, et pour la même raison: les étoiles
 * multiplient la production, qui nourrit les chips, qui redonnent des étoiles.
 * En racine carrée cette boucle divergeait.
 */
export const starsFor = (chips = 0) => {
  const n = Number(chips);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(Math.cbrt(n / 50));
};

/** Étoiles disponibles = gagnées − dépensées. */
export const availableStars = (state) =>
  Math.max(0, (state.ascension?.stars || 0) - (state.ascension?.spent || 0));

export const canAscend = (state) =>
  (state.prestige?.chips || 0) >= ASCENSION_MIN_CHIPS &&
  starsFor(state.prestige?.chips || 0) > 0;

/**
 * Les trois voies de la Voûte.
 *
 * Trois choix qui ne font pas la même chose: du contenu, de la puissance brute,
 * et de la vitesse de boucle. Un joueur qui met tout dans une seule voie a une
 * partie différente d'un joueur qui répartit — c'est le but.
 */
export const TRACKS = [
  {
    id: "horizon",
    name: "Horizon",
    emoji: "🌅",
    desc: "Débloque un nouveau rang de Cliqueur ET de Mineur.",
    detail:
      "C'est du contenu, pas un multiplicateur: de nouveaux bâtiments apparaissent en boutique, avec leurs propres paliers à conquérir.",
    maxLevel: 4,
    // 1, 2, 4, 8 étoiles: doubler à chaque fois, comme les paliers de bâtiment.
    cost: (level) => Math.pow(2, level),
  },
  {
    id: "eclat",
    name: "Éclat",
    emoji: "✨",
    desc: "+0,25 à la puissance de clic et au minage, par niveau.",
    detail:
      "Le même cran sur les deux axes: l'Éclat rend tout plus fort sans jamais déplacer l'équilibre entre cliquer et laisser tourner.",
    maxLevel: Infinity,
    // 1, 2, 3, 4 … linéaire: c'est la voie qu'on peut toujours continuer.
    cost: (level) => level + 1,
  },
  {
    id: "echo",
    name: "Écho",
    emoji: "🔔",
    desc: "+25 % de chips à chaque renaissance, par niveau.",
    detail:
      "Accélère la boucle du dessous. Sans lui, chaque ascension repartirait au même rythme que la première.",
    maxLevel: 8,
    // 2, 4, 6, 8 … deux fois le niveau: plus cher que l'Éclat, parce qu'il
    // agit sur la vitesse d'acquisition et non sur une seule partie.
    cost: (level) => 2 * (level + 1),
  },
];

export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));

export const trackLevel = (state, id) => Math.max(0, Math.floor(state.ascension?.tracks?.[id] || 0));

export const trackCost = (id, level) => {
  const t = TRACK_BY_ID[id];
  if (!t) return Infinity;
  if (level >= t.maxLevel) return Infinity;
  return t.cost(level);
};

export const isEndlessTrack = (id) => TRACK_BY_ID[id]?.maxLevel === Infinity;

/** Tous les effets de la Voûte, agrégés. */
export function ascensionEffects(state) {
  const horizon = Math.min(TRACK_BY_ID.horizon.maxLevel, trackLevel(state, "horizon"));
  const eclat = trackLevel(state, "eclat");
  const echo = Math.min(TRACK_BY_ID.echo.maxLevel, trackLevel(state, "echo"));
  return {
    // Rang maximal débloqué au-delà des huit rangs de base.
    horizon,
    // Crans de grille, additionnés à ceux des chips, du staking, de l'arbre
    // céleste et du Registre. Jamais multipliés entre eux.
    eclatSteps: eclat,
    // Multiplicateur de chips au prestige. Un quart par niveau, sur la grille.
    chipMult: 1 + 0.25 * echo,
  };
}

/**
 * Coût du n-ième palier de la Voûte, toutes voies confondues, pour l'affichage
 * du prochain objectif. Sur l'échelle des nombres agréables.
 */
export const nextVaultGoal = (spent = 0) => niceIntAt(Math.max(0, Math.floor(spent)));
