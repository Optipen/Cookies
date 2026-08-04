// === Protection contre l'automatisation ===
//
// AVERTISSEMENT, à lire avant d'écrire quoi que ce soit d'autre ici.
//
// Cette protection est ENTIÈREMENT CÔTÉ CLIENT. Le jeu n'a pas de serveur: la
// partie vit dans le localStorage du navigateur, et tout le code tourne sur la
// machine du joueur. Quelqu'un qui veut tricher peut donc:
//
//   · modifier la sauvegarde à la main dans les outils de développement;
//   · appeler directement les fonctions du jeu depuis la console;
//   · recompiler le bundle sans ce fichier.
//
// Rien de ce qui suit n'empêche cela, et rien ne le peut sans validation
// serveur. Ce que ce fichier fait vraiment, et c'est tout ce qu'il prétend
// faire: rendre inutile l'autoclicker ORDINAIRE — celui qu'on installe en
// extension ou qu'on branche sur la souris. C'est la triche que 99 % des
// joueurs rencontrent, parce qu'elle ne demande aucune compétence.
//
// Deux mécanismes, et ils ne servent pas à la même chose:
//
//   1. Le SEAU À JETONS borne ce que le jeu crédite. Il ne juge personne: il
//      compte. Un joueur rapide ne le touche jamais, un autoclicker s'y heurte
//      en permanence. C'est la vraie défense, et elle est passive.
//   2. Le SCORE DE SUSPICION observe la FORME du clic — sa régularité, ses
//      pauses, sa provenance. Il ne retire jamais rien: au-delà d'un seuil, il
//      demande une vérification humaine d'un seul geste. Il ne bannit jamais.
//
// Aucun bannissement, aucune monnaie effacée, aucune sauvegarde touchée. Sans
// preuve serveur, punir un joueur sur un soupçon calculé chez lui serait punir
// des innocents.

import { CREDIT_MAX_CPS, CREDIT_BURST } from "./rate.js";

/** Score au-delà duquel on demande une vérification humaine. */
export const SEUIL_VERIFICATION = 100;

/**
 * Le score retombe tout seul, d'un point par seconde.
 *
 * Un joueur qui a déclenché un signal en jouant vite doit pouvoir revenir à
 * zéro simplement en jouant normalement. Sans décroissance, le score ne ferait
 * que monter au fil des heures et finirait par accuser tout le monde.
 */
export const DECROISSANCE_PAR_SECONDE = 1;

/**
 * Fenêtre d'analyse de la forme du geste, en millisecondes.
 *
 * Élaguée par le TEMPS et non par le nombre: à soixante clics par seconde, une
 * mémoire de soixante-quatre clics ne couvre qu'une seconde, et la détection
 * de cadence surhumaine — qui exige trois secondes — ne se déclenchait jamais.
 * C'est exactement l'inverse de ce qu'on veut.
 */
const FENETRE_MS = 5000;

/** Garde-fou mémoire: au-delà, on jette les plus vieux quoi qu'il arrive. */
const HISTORIQUE_MAX = 512;

/**
 * Un même signal ne peut se déclencher qu'une fois toutes les dix secondes.
 *
 * Sans cette limite, un signal PAR CLIC transformait une caractéristique en
 * accusation: un joueur dont l'extension d'accessibilité produit des
 * événements non fiables accumulait deux points par clic, soit huit points par
 * seconde à quatre clics par seconde — au seuil en un quart de minute, sans
 * rien avoir fait de mal. Un signal décrit un ÉTAT, pas un événement.
 */
const REARMEMENT_MS = 10_000;

/**
 * Poids de chaque signal.
 *
 * Aucun ne suffit seul à déclencher une vérification: il en faut plusieurs, ou
 * un seul répété. Un signal isolé se produit chez des joueurs honnêtes — une
 * extension d'accessibilité émet des événements non fiables, un onglet en
 * arrière-plan reçoit encore des clics sur certains navigateurs.
 */
export const POIDS = {
  /** Événement synthétique: `isTrusted` faux. Très faible — voir plus bas. */
  synthetique: 2,
  /** Intervalles identiques à la milliseconde sur trente clics d'affilée. */
  regularite: 30,
  /** Cadence brute soutenue au-delà du double de ce qui est humainement tenable. */
  surhumain: 25,
  /** Clics reçus alors que l'onglet n'est pas visible. */
  ongletCache: 20,
  /** Aucune pause de plus de deux secondes sur dix minutes de clic continu. */
  sansPause: 20,
  /** Deux rafales séparées à la même fréquence exacte. */
  frequenceRepetee: 20,
};

// `isTrusted` pèse presque rien, et c'est délibéré. Le drapeau est trivial à
// contourner (un vrai autoclicker matériel produit des événements fiables) et
// il est faux chez des joueurs légitimes: extensions d'accessibilité, outils de
// pilotage, certains claviers programmables. En faire un rejet sec bloquerait
// des innocents sans gêner qui que ce soit d'autre. Il ne sert donc que de
// petit appoint quand d'autres signaux sont déjà présents.

const moyenne = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const ecartType = (xs) => {
  if (xs.length < 2) return Infinity;
  const m = moyenne(xs);
  return Math.sqrt(moyenne(xs.map((x) => (x - m) * (x - m))));
};

/**
 * Le garde-fou d'une partie.
 *
 * Tout passe par `enregistrer`, qui reçoit l'instant et le contexte du clic et
 * répond ce qu'il faut en faire. Aucun accès au DOM ni à l'horloge: la
 * simulation et les tests peuvent le piloter au millième.
 */
export function createGuard({
  max = CREDIT_MAX_CPS,
  burst = CREDIT_BURST,
  seuil = SEUIL_VERIFICATION,
} = {}) {
  let jetons = burst;
  let dernierJeton = null;

  let clics = []; // horodatages récents
  let score = 0;
  let dernierScore = null; // instant du dernier calcul, pour la décroissance
  let derniereRafale = null; // fréquence de la dernière rafale close
  let debutSerie = null; // début de la série de clics sans vraie pause
  let verification = false;

  const signaux = new Set();
  const dernierDeclenchement = new Map();

  /** Le seau se remplit à `max` jetons par seconde, plafonné à `burst`. */
  function prendreJeton(now) {
    if (dernierJeton === null) dernierJeton = now;
    const dt = Math.max(0, now - dernierJeton) / 1000;
    dernierJeton = now;
    jetons = Math.min(burst, jetons + dt * max);
    if (jetons >= 1) {
      jetons -= 1;
      return true;
    }
    return false;
  }

  function decroitre(now) {
    if (dernierScore === null) {
      dernierScore = now;
      return;
    }
    const dt = Math.max(0, now - dernierScore) / 1000;
    dernierScore = now;
    score = Math.max(0, score - dt * DECROISSANCE_PAR_SECONDE);
  }

  /** Un signal ne compte qu'une fois par période de réarmement. */
  function ajouter(nom, poids, now) {
    signaux.add(nom);
    const dernier = dernierDeclenchement.get(nom);
    if (dernier !== undefined && now - dernier < REARMEMENT_MS) return;
    dernierDeclenchement.set(nom, now);
    score += poids;
  }

  function analyser(now, { trusted, hidden, touches }) {
    const intervalles = [];
    for (let i = 1; i < clics.length; i++) intervalles.push(clics[i] - clics[i - 1]);

    if (trusted === false) ajouter("synthetique", POIDS.synthetique, now);
    if (hidden === true) ajouter("ongletCache", POIDS.ongletCache, now);

    // Plus de doigts que la main n'en a: un vrai multitouch monte à cinq, une
    // injection d'événements n'a aucune raison de s'arrêter là.
    if (typeof touches === "number" && touches > 5) ajouter("multitouch", POIDS.surhumain, now);

    // Régularité: un humain a de la gigue, même entraîné — vingt à quatre-vingts
    // millisecondes d'écart-type sur une rafale ordinaire. Trente intervalles
    // qui tiennent sous cinq millisecondes ne viennent pas d'une main. On exige
    // trente clics pour ne pas accuser une rafale courte tapée en rythme.
    if (intervalles.length >= 30 && ecartType(intervalles.slice(-30)) < 5) {
      ajouter("regularite", POIDS.regularite, now);
    }

    // Cadence brute soutenue: au-delà du double de la borne créditée, sur au
    // moins trois secondes. Une pointe courte ne déclenche rien.
    const duree = clics.length >= 3 ? (now - clics[0]) / 1000 : 0;
    if (duree >= 3 && clics.length / duree > max * 2) ajouter("surhumain", POIDS.surhumain, now);

    // Aucune pause: dix minutes de clic sans jamais s'arrêter deux secondes.
    if (debutSerie !== null && now - debutSerie > 600_000) {
      ajouter("sansPause", POIDS.sansPause, now);
      debutSerie = now; // on ne recompte pas la même série indéfiniment
    }

    // Deux rafales distinctes à la même fréquence exacte: un humain ne
    // reproduit pas sa cadence au millième après une pause.
    if (intervalles.length >= 10) {
      const derniers = intervalles.slice(-10);
      const f = Math.round(1000 / Math.max(1, moyenne(derniers)));
      if (derniereRafale !== null && f === derniereRafale && ecartType(derniers) < 5) {
        ajouter("frequenceRepetee", POIDS.frequenceRepetee, now);
      }
    }
  }

  return {
    /**
     * Enregistre un clic.
     *
     * @returns {{credite: boolean, score: number, verification: boolean, signaux: string[]}}
     */
    enregistrer(now, contexte = {}) {
      decroitre(now);

      const precedent = clics.length ? clics[clics.length - 1] : null;
      // Une pause de deux secondes clôt la série et la rafale en cours.
      if (precedent === null || now - precedent > 2000) {
        if (clics.length >= 10) {
          const intervalles = [];
          for (let i = 1; i < clics.length; i++) intervalles.push(clics[i] - clics[i - 1]);
          derniereRafale = Math.round(1000 / Math.max(1, moyenne(intervalles.slice(-10))));
        }
        debutSerie = now;
      }

      clics.push(now);
      // Élagage par le temps d'abord — c'est lui qui donne son sens à la
      // fenêtre — puis par le nombre, uniquement pour borner la mémoire.
      const limite = now - FENETRE_MS;
      let i = 0;
      while (i < clics.length && clics[i] < limite) i++;
      if (i > 0) clics = clics.slice(i);
      if (clics.length > HISTORIQUE_MAX) clics = clics.slice(-HISTORIQUE_MAX);

      analyser(now, contexte);
      if (score >= seuil) verification = true;

      // Pendant une vérification, plus aucun gain manuel n'est crédité. Le
      // minage, lui, continue: il ne dépend pas des doigts du joueur.
      const credite = !verification && prendreJeton(now);

      return { credite, score, verification, signaux: [...signaux] };
    },

    /** Le joueur a répondu correctement: on repart d'une page blanche. */
    resoudre() {
      verification = false;
      score = 0;
      signaux.clear();
      dernierDeclenchement.clear();
      clics = [];
      jetons = burst;
      debutSerie = null;
      derniereRafale = null;
    },

    /** Remise à zéro complète (nouvelle partie, prestige). */
    reset() {
      this.resoudre();
      dernierJeton = null;
      dernierScore = null;
    },

    etat() {
      return { score, verification, jetons, signaux: [...signaux] };
    },
  };
}

/**
 * Une question à laquelle un humain répond d'un geste.
 *
 * Volontairement triviale: le but n'est pas de prouver l'intelligence du
 * joueur, c'est d'exiger UNE décision qu'un autoclicker ne peut pas prendre
 * — il ne sait pas lire, il tape toujours au même endroit. Trois cibles,
 * atteignables au clavier comme au doigt, et l'énoncé est du texte: un lecteur
 * d'écran le lit.
 *
 * @param {number} graine entier quelconque; la même graine rend la même question
 */
export function fabriquerDefi(graine = 0) {
  const n = Math.abs(Math.floor(graine)) || 1;
  // Trois valeurs distinctes entre 2 et 9, réparties par des pas premiers pour
  // qu'aucune ne retombe sur une autre.
  const premier = (n % 8) + 2;
  const options = [premier, ((premier + 1) % 8) + 2, ((premier + 4) % 8) + 2];
  // Puis on désigne l'une des trois positions. C'est la LECTURE de l'énoncé qui
  // fait le tri, pas le calcul: un autoclicker tape toujours au même endroit.
  const reponse = n % 3;
  return {
    question: `Pour continuer, appuie sur le nombre ${options[reponse]}.`,
    options,
    reponse,
  };
}
