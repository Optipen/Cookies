// === La file des bandeaux ===
//
// Le bandeau est le gros titre qui traverse le haut de l'écran: « Étape
// franchie », « Flocon dépassé », « Cookie croqué ». C'est le canal des
// MOMENTS — celui qu'on ne veut jamais rater.
//
// Il n'y avait qu'un emplacement, et trois systèmes écrivaient dedans. Pendant
// le tutoriel — le seul moment où tout arrive en même temps — le deuxième
// bandeau remplaçait le premier au bout de quelques dixièmes de seconde, et le
// plus beau moment du jeu disparaissait sans laisser de trace. Mesuré en
// navigateur: un débutant dépassait Flocon sans jamais voir « Flocon dépassé ».
//
// La POLITIQUE vit ici, en fonctions pures — comme celle des notifications
// dans `notices.js`. Le composant ne garde que la minuterie: c'est ce qui
// permet de vérifier par des tests qu'un bandeau ne se perd pas, sans avoir à
// faire tourner une horloge.

/**
 * Capacité de la file.
 *
 * Quatre. En fêter huit d'affilée n'est plus une fête, c'est une file
 * d'attente: au-delà, le joueur regarde défiler des titres au lieu de jouer, et
 * le dernier arrive vingt secondes après le geste qui l'a déclenché.
 */
export const MAX_BANNIERES = 4;

export function createFileBannieres({ max = MAX_BANNIERES } = {}) {
  let file = [];

  return {
    /**
     * Met un bandeau en file. Rend `true` s'il a été accepté.
     *
     * Un doublon exact est écarté: deux fois le même titre et le même
     * sous-titre, c'est un appelant qui bégaie, pas deux événements.
     */
    push({ title, sub = "", ms = 2000 } = {}) {
      if (!title) return false;
      if (file.length >= max) return false;
      if (file.some((b) => b.title === title && b.sub === sub)) return false;
      file.push({ title, sub, ms });
      return true;
    },

    /** Le prochain bandeau à afficher, ou `null`. */
    shift() {
      return file.shift() || null;
    },

    taille: () => file.length,
    vider() {
      file = [];
    },
  };
}
