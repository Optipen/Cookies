// === Combo ===
//
// Cliquer sans interruption fait monter un multiplicateur qui retombe vite.
// C'est le seul mécanisme du jeu qui récompense la présence — et le seul qui
// puisse déséquilibrer tout le reste s'il monte trop haut.
//
// Quatre crans, et rien d'autre:
//
//     niveau 0 → ×1      niveau 2 → ×1,50
//     niveau 1 → ×1,25   niveau 3 → ×1,75
//
// La formule est littéralement `1 + 0,25 × niveau`, avec le niveau borné à 3.
// Aucune valeur intermédiaire ne peut apparaître: ni ×1,33, ni ×1,67, ni
// ×1,74. Le combo montait auparavant à ×3 en huit crans, ce qui faisait d'un
// joueur en rafale trois fois un joueur posé avant même le premier achat.
//
// Ce fichier est la source unique de la formule. `selectors.js` la ré-exporte
// pour les modules qui la lisaient déjà là; personne ne la recalcule.

/** Cran de multiplicateur. Toujours 0,25, comme toute la grille du jeu. */
const PAS = 0.25;

export const COMBO = {
  /** Niveau maximum. Quatre valeurs au total: 0, 1, 2, 3. */
  steps: 3,
  /** Multiplicateur au niveau maximum. */
  max: 1 + PAS * 3,
  /**
   * Clics nécessaires pour gagner un niveau.
   *
   * Douze clics par niveau, trente-six pour le maximum: 7,2 secondes à cinq
   * clics par seconde. Assez long pour que la montée se ressente, assez court
   * pour que le maximum soit atteignable dans une rafale ordinaire.
   */
  clicksPerStep: 12,
  /** Clics pour atteindre le maximum depuis zéro. */
  clicksToMax: 36,
  /**
   * Sursis avant que la chaîne ne commence à retomber. Couvre une hésitation,
   * un scroll, un changement de main.
   */
  windowMs: 1400,
  /**
   * Clics perdus par seconde une fois le sursis écoulé. Neuf par seconde, soit
   * un niveau toutes les 1,33 s: la chute se voit descendre cran par cran au
   * lieu de s'effondrer d'un coup.
   */
  decayPerSecond: 9,
  /**
   * Plafond de la chaîne. Un cran de réserve au-dessus du maximum: après une
   * longue rafale on garde le ×1,75 pendant le sursis *et* la première seconde
   * de décroissance, sans que la réserve devienne un second combo caché.
   */
  streakCap: 36 + 12,
};

/** Chaîne de clics → niveau, entre 0 et 3. Robuste à toute entrée. */
export function comboStep(streak = 0) {
  const n = Number(streak);
  if (Number.isNaN(n) || n <= 0) return 0;
  if (!Number.isFinite(n)) return COMBO.steps;
  return Math.min(COMBO.steps, Math.floor(n / COMBO.clicksPerStep));
}

/** Niveau → multiplicateur. `1 + 0,25 × niveau`, sans exception. */
export const comboMultiplier = (streak = 0) => 1 + PAS * comboStep(streak);

/**
 * Avancement vers le cran suivant, entre 0 et 1, pour la jauge.
 * Au maximum la jauge est pleine: il n'y a plus de cran suivant à viser.
 */
export function comboProgress(streak = 0) {
  const niveau = comboStep(streak);
  if (niveau >= COMBO.steps) return 1;
  const n = Number(streak);
  if (Number.isNaN(n) || n <= 0) return 0;
  return (n - niveau * COMBO.clicksPerStep) / COMBO.clicksPerStep;
}

/**
 * Ramène un record de combo sur la nouvelle échelle.
 *
 * Une sauvegarde d'avant ce changement contient un `bestCombo` allant jusqu'à
 * 3. Le laisser tel quel afficherait un record devenu inatteignable, et
 * décrocherait un succès que plus personne ne peut obtenir.
 */
export function clampBestCombo(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 1) return 1;
  return Math.min(COMBO.max, n);
}
