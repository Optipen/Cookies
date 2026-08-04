// === La grille des nombres propres ===
//
// Un seul principe, appliqué partout: **aucun multiplicateur visible n'est
// calculé, ils sont tous choisis**. Un bonus ne vaut jamais « +2 % par chip »,
// il fait franchir un palier, et franchir un palier ajoute exactement +0,25.
//
// C'est ce qui rend ×1,02 ou ×2,08 impossibles par construction plutôt que par
// arrondi: la valeur affichée EST la valeur calculée.
//
//   ×1 · ×1,25 · ×1,50 · ×1,75 · ×2 · ×2,25 · ×2,50 · ×2,75 · ×3 …
//
// Entre deux paliers le multiplicateur ne bouge pas — à la place, une barre
// montre ce qu'il reste à parcourir. Un bonus continu invisible se remarque
// moins qu'un palier qu'on voit approcher.

/** Pas de la grille. Tout multiplicateur visible en est un multiple. */
export const STEP = 0.25;

/** Multiplicateur d'un nombre de paliers franchis: 0 → ×1, 1 → ×1,25, 4 → ×2. */
export const multOf = (steps = 0) => 1 + STEP * Math.max(0, Math.floor(steps));

/**
 * Échelle de valeurs agréables: 1 · 2,5 · 5 · 10 · 25 · 50 · 100 · 250 …
 *
 * Trois crans par décade. Elle sert aux seuils, aux prix et aux récompenses:
 * partout où il faut « le nombre rond suivant », c'est celui-ci.
 */
const MANTISSES = [1, 2.5, 5];

export function niceAt(index) {
  const i = Math.max(0, Math.floor(index));
  return MANTISSES[i % 3] * Math.pow(10, Math.floor(i / 3));
}

/** Même échelle, arrondie à l'entier — pour les seuils qui comptent des objets. */
export const niceIntAt = (index) => Math.max(1, Math.round(niceAt(index)));

/**
 * Nombre de crans de l'échelle atteints par `value`.
 *
 * 0 → 0 · 1 → 1 · 4 → 2 · 7 → 3 · 10 → 4. C'est la brique des bonus à paliers:
 * la valeur monte comme elle veut, le multiplicateur monte par crans nets.
 */
export function stepsReached(value, first = 0, entier = true) {
  if (!(value > 0)) return 0;
  const seuil = entier ? niceIntAt : niceAt;
  let n = 0;
  while (n < 400 && seuil(first + n) <= value) n++;
  return n;
}

/**
 * Ce qu'il faut afficher d'un bonus à paliers: le multiplicateur actuel, le
 * prochain, et où l'on en est entre les deux.
 *
 * `progress` alimente la barre qui remplace le chiffre qui bougeait tout seul.
 */
export function tierState(value, first = 0, entier = true) {
  const seuil = entier ? niceIntAt : niceAt;
  const steps = stepsReached(value, first, entier);
  const nextAt = seuil(first + steps);
  const prevAt = steps === 0 ? 0 : seuil(first + steps - 1);
  const span = nextAt - prevAt;
  return {
    steps,
    mult: multOf(steps),
    nextMult: multOf(steps + 1),
    at: prevAt,
    nextAt,
    progress: span > 0 ? Math.min(1, Math.max(0, (value - prevAt) / span)) : 1,
    remaining: Math.max(0, nextAt - value),
  };
}

/**
 * Arrondi de sécurité sur la grille.
 *
 * Les multiplicateurs sont censés être propres par construction; ceci rattrape
 * la dérive du flottant (0,25 × 3 = 0,7500000000000001) avant l'affichage.
 */
export const snap = (n) => Math.round(n / STEP) * STEP;

/** Vrai si `n` tombe exactement sur la grille. Utilisé par les tests. */
export const onGrid = (n) => Math.abs(n - snap(n)) < 1e-9;
