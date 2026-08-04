import { useEffect, useRef } from "react";

/**
 * Garde la dernière valeur d'une prop dans un ref, mis à jour après le commit.
 *
 * Sert aux systèmes pilotés par minuterie (boucle de jeu, quêtes, succès) qui
 * doivent lire l'état courant sans redémarrer leur intervalle à chaque rendu.
 * L'écriture se fait dans un effet et non pendant le rendu: un rendu abandonné
 * par React ne doit pas laisser un ref pointant sur un état qui n'a jamais été
 * affiché.
 */
export function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
