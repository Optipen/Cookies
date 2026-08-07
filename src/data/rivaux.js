// === Le Classement ===
//
// Le défaut qu'il corrige: « on ne comprend toujours pas l'intérêt de cliquer,
// il n'y a pas de réel gain au bout ». Le jeu affichait bien, depuis peu, que
// cliquer multiplie la production par 2,6 — mais un multiplicateur est une
// information, pas une raison. Une raison, c'est quelqu'un devant soi.
//
// D'où sept rivaux. Ils ne diffèrent QUE par leur cadence de clic: même
// catalogue, mêmes prix, même façon d'acheter, mêmes renaissances. Monter d'une
// place, c'est donc littéralement appuyer plus qu'eux — le classement est la
// traduction directe de l'effort, et c'est tout ce qu'on lui demande de dire.
//
// TROIS DÉCISIONS, et les raisons de chacune:
//
//  1. **Les rivaux sont des parties simulées, pas des joueurs en ligne**, et le
//     jeu le dit à l'écran. Crumbora est entièrement client: la sauvegarde vit
//     dans le navigateur du joueur et s'y réécrit en dix secondes. Un classement
//     alimenté par ces sauvegardes ne classerait rien — la première personne à
//     ouvrir la console serait première pour toujours, et tous les autres
//     joueraient contre un champ de texte. Servir sept adversaires honnêtes vaut
//     mieux que d'en promettre mille faux.
//
//  2. **Ils avancent au TEMPS DE JEU, pas à l'horloge murale.** Quelqu'un qui
//     joue vingt minutes par jour affronte des rivaux qui ont joué vingt minutes
//     eux aussi. Sur une horloge murale, tout le monde perdrait du terrain en
//     dormant: exactement le contraire de ce qu'un classement doit provoquer.
//
//  3. **Leurs chiffres viennent du moteur du jeu, pas d'une formule inventée.**
//     `scripts/rivaux.mjs` fait jouer sept parties par le simulateur — mêmes
//     prix, mêmes paliers, mêmes renaissances que la partie du joueur — et
//     relève la production cumulée à vingt-huit temps de jeu. La table
//     ci-dessous est ce relevé. Rééquilibrer le catalogue sans rejouer le script
//     rendrait donc les rivaux faux, et c'est volontairement visible: un test
//     vérifie que l'escalier tient toujours.

import { cookiesAVie, tempsDeJeuAVie } from "../utils/state.js";

/**
 * Les sept, du plus lent au plus rapide.
 *
 * `cadence` est la vraie cadence simulée: c'est elle, et rien d'autre, qui
 * explique l'écart entre deux voisins de ce tableau.
 */
export const RIVAUX = [
  {
    id: "flocon",
    nom: "Flocon",
    icone: "moon",
    cadence: 0.25,
    phrase: "Un clic toutes les quatre secondes",
    crmb: 1,
  },
  { id: "nino", nom: "Nino", icone: "smile", cadence: 1, phrase: "Un clic par seconde, tranquille", crmb: 1 },
  { id: "salome", nom: "Salomé", icone: "hand", cadence: 2, phrase: "Deux clics par seconde", crmb: 2 },
  { id: "tarek", nom: "Tarek", icone: "flame", cadence: 3.5, phrase: "Trois clics et demi par seconde", crmb: 2 },
  { id: "iris", nom: "Iris", icone: "bolt", cadence: 5.5, phrase: "Cinq clics et demi par seconde", crmb: 3 },
  { id: "zoe", nom: "Zoé", icone: "rocket", cadence: 8, phrase: "Huit clics par seconde, sans souffler", crmb: 5 },
  {
    id: "crumb9000",
    nom: "CRUMB-9000",
    icone: "robot",
    cadence: 12,
    phrase: "Douze clics par seconde. C'est une machine",
    crmb: 10,
  },
];

export const RIVAL_BY_ID = Object.fromEntries(RIVAUX.map((r) => [r.id, r]));

/**
 * Temps de jeu auxquels les parties simulées ont été relevées.
 *
 * Resserrés là où tout se joue — les vingt premières minutes — et espacés
 * ensuite. Au-delà du dernier (trente jours de jeu EFFECTIF, pas de calendrier),
 * la courbe se prolonge à la pente du dernier segment.
 */
export const PALIERS_MS = [
  30000, 60000, 120000, 180000, 300000, 480000, 720000, 1200000, 1800000, 2700000, 3600000, 5400000, 7200000, 10800000,
  18000000, 28800000, 43200000, 64800000, 86400000, 129600000, 172800000, 259200000, 432000000, 604800000, 864000000,
  1209600000, 1814400000, 2592000000,
];

/**
 * Production cumulée de chaque rival, à chaque palier. GÉNÉRÉE — voir
 * `npx vite-node scripts/rivaux.mjs`, à rejouer après tout changement de prix.
 *
 * Sur les cent quatre-vingt-neuf valeurs relevées, UNE a été remontée de cinq
 * pour cent par le script pour garder l'escalier strict: les achats sont
 * discrets, et un Portail pris une minute plus tôt suffit à faire passer
 * momentanément un rival devant son aîné. Le reste est le relevé brut.
 */
const COURBES = {
  flocon: [
    67.88, 160.3, 529.9, 1135, 3385, 11260, 30740, 143700, 464900, 2189000, 9033000, 50610000, 161100000, 306600000,
    1741000000, 11020000000, 45090000000, 201600000000, 695700000000, 2170000000000, 3752000000000, 8191000000000,
    21630000000000, 35410000000000, 72680000000000, 114200000000000, 238300000000000, 420100000000000,
  ],
  nino: [
    103.5, 273.7, 883.2, 1693, 5404, 15220, 45560, 184100, 602600, 3296000, 13380000, 69240000, 210500000, 495300000,
    3520000000, 14330000000, 50140000000, 218300000000, 730500000000, 2424000000000, 5234000000000, 10260000000000,
    27200000000000, 54710000000000, 91700000000000, 162300000000000, 314000000000000, 659500000000000,
  ],
  salome: [
    174.5, 456.4, 1344, 2733, 8779, 24370, 76890, 296800, 922800, 6456000, 21140000, 114900000, 275700000,
    1152000000, 5130000000, 20010000000, 78920000000, 582700000000, 1323000000000, 4261000000000, 9287000000000,
    21640000000000, 51380000000000, 94070000000000, 148100000000000, 273800000000000, 482200000000000,
    1439000000000000,
  ],
  tarek: [
    282, 772.4, 2326, 5123, 14960, 45570, 143000, 518500, 2402000, 16270000, 50650000, 246800000, 350100000,
    1527000000, 8655000000, 74800000000, 288000000000, 1145000000000, 3499000000000, 11880000000000, 19220000000000,
    40260000000000, 88810000000000, 147700000000000, 242000000000000, 453700000000000, 793400000000000,
    3798000000000000,
  ],
  iris: [
    463.5, 1241, 3949, 9340, 27960, 97280, 286000, 1244000, 8678000, 45860000, 144300000, 335000000, 1409000000,
    5428000000, 20380000000, 137000000000, 904800000000, 3252000000000, 8615000000000, 19670000000000,
    34780000000000, 63180000000000, 137800000000000, 217200000000000, 422800000000000, 714500000000000,
    5093000000000000, 19970000000000000,
  ],
  zoe: [
    732.3, 2059, 7386, 17180, 58510, 205000, 595500, 4890000, 28390000, 140800000, 254200000, 1113000000, 2622000000,
    10720000000, 59680000000, 530000000000, 2446000000000, 8313000000000, 14920000000000, 31610000000000,
    53050000000000, 97650000000000, 207100000000000, 334300000000000, 750900000000000, 3913000000000000,
    19800000000000000, 64070000000000000,
  ],
  crumb9000: [
    1194, 3631, 14060, 36370, 140600, 494200, 2089000, 20770000, 108600000, 324800000, 816300000, 3422000000,
    9182000000, 36470000000, 368400000000, 2018000000000, 6977000000000, 17960000000000, 28530000000000,
    60640000000000, 89130000000000, 159400000000000, 366600000000000, 775600000000000, 6641000000000000,
    20250000000000000, 188900000000000000, 516800000000000000,
  ],
};

const DERNIER = PALIERS_MS.length - 1;

/**
 * L'avance des rivaux: **huit minutes**, et c'est un chiffre mesuré.
 *
 * Le simulateur ne modélise que la mécanique — bâtiments, prix, paliers,
 * renaissances. Un joueur, lui, reçoit en plus, dès sa première minute, les
 * primes des sept étapes du Guide (9 525 cookies), ses premiers succès et ses
 * premières quêtes. Ces cadeaux ne sont pas dans les courbes, et sans
 * correction le résultat mesuré en navigateur était sans appel: un débutant à
 * trois clics par seconde qui suit le Guide passait PREMIER sur huit au bout
 * de quarante-neuf secondes, devant un adversaire simulé à douze clics par
 * seconde. Le seul classement pire qu'aucun classement est celui qui commence
 * par une victoire imméritée.
 *
 * Relevé en navigateur, la courbe réelle d'un débutant:
 *
 *      11 s → 3 314 cookies      49 s → 18 824      2 min 33 → 41 934
 *
 * La même partie SANS les cadeaux (le simulateur, 3 clics/s) met environ huit
 * minutes à atteindre ces valeurs. Les cadeaux de bienvenue valent donc à peu
 * près huit minutes d'avance — et c'est exactement ce qu'on rend aux rivaux.
 *
 * Une avance en TEMPS plutôt qu'une prime en cookies, parce que c'est la seule
 * forme qui a la bonne allure: énorme pendant le premier quart d'heure, où les
 * cadeaux font toute la partie; négligeable au bout de quatre heures (+3 %),
 * où ils ne pèsent plus rien.
 *
 * L'autre piste a été essayée et mesurée: faire jouer les rivaux AVEC la
 * couche d'événements du simulateur. Elle donne à un joueur de trois clics par
 * seconde 2,4 millions de cookies en deux minutes, là où le vrai débutant en a
 * quarante-deux mille. Cinquante-sept fois trop — la couche décrit une
 * espérance mathématique, pas quelqu'un qui joue.
 */
export const AVANCE_MS = 8 * 60_000;

/**
 * Pente de prolongation au-delà du dernier relevé, COMMUNE aux sept.
 *
 * Trente jours de jeu effectif, c'est déjà deux heures par jour pendant un an:
 * au-delà, la table n'a plus rien mesuré. Prolonger chaque rival à SA propre
 * pente finale paraissait plus fidèle — et cassait l'escalier: le dernier
 * segment de Flocon monte d'un facteur 1,98 là où celui de Nino monte de 1,71,
 * si bien que Flocon repassait devant Nino vers le cent-vingtième jour, et le
 * rang du joueur bougeait sans qu'il ait joué. Une pente commune conserve
 * l'ordre exactement, puisqu'elle multiplie tout le monde par le même nombre.
 *
 * C'est la MÉDIANE des sept pentes finales: prendre la plus rapide rendrait le
 * classement infranchissable dans la queue, prendre la plus lente le rendrait
 * gratuit.
 */
const PENTE_FINALE = (() => {
  const pentes = RIVAUX.map((r) => {
    const c = COURBES[r.id];
    return Math.log(c[DERNIER] / c[DERNIER - 1]) / (PALIERS_MS[DERNIER] - PALIERS_MS[DERNIER - 1]);
  }).sort((a, b) => a - b);
  return pentes[Math.floor(pentes.length / 2)];
})();

/**
 * Ce qu'un rival a produit après `tempsMs` de jeu.
 *
 * Entre deux paliers, l'interpolation est GÉOMÉTRIQUE et non linéaire: sur un
 * segment qui va de dix millions à quatre-vingts millions, la droite ferait
 * passer le rival par quarante-cinq millions à mi-parcours là où le jeu, lui,
 * en produit vingt-huit. En interpolant droit, le classement aurait sauté à
 * chaque palier franchi.
 */
export function scoreRival(id, tempsMs) {
  const c = COURBES[id];
  if (!c || !c.length) return 0;
  const brut = Number(tempsMs);
  if (!Number.isFinite(brut) || brut < 0) return 0;
  // L'échelle est peuplée dès la première seconde: le débutant démarre
  // huitième, dépasse Flocon au bout d'une poignée de minutes, et ne monte
  // plus jamais que par son propre travail.
  const t = brut + AVANCE_MS;

  // Au-delà de la table: la pente commune, pour que l'escalier tienne.
  if (t >= PALIERS_MS[DERNIER]) {
    const v = c[DERNIER] * Math.exp(PENTE_FINALE * (t - PALIERS_MS[DERNIER]));
    return Number.isFinite(v) ? v : Number.MAX_VALUE;
  }

  let i = DERNIER - 1;
  for (let k = 0; k < DERNIER; k++) {
    if (t <= PALIERS_MS[k + 1]) {
      i = k;
      break;
    }
  }
  const va = c[i];
  const vb = c[i + 1];
  if (!(va > 0) || !(vb > 0)) return Math.max(0, va || 0);
  const f = (t - PALIERS_MS[i]) / (PALIERS_MS[i + 1] - PALIERS_MS[i]);
  const v = va * Math.pow(vb / va, f);
  return Number.isFinite(v) ? v : Number.MAX_VALUE;
}

/**
 * Le classement complet, joueur compris, du premier au dernier.
 *
 * À égalité stricte le joueur passe DERRIÈRE: au tout premier chargement tout
 * le monde est à zéro, et se voir premier sans avoir rien fait ferait du
 * classement une décoration dès la première seconde.
 */
export function classement(state) {
  const t = tempsDeJeuAVie(state);
  const battus = state?.classement?.battus || {};
  const lignes = RIVAUX.map((r) => ({
    id: r.id,
    nom: r.nom,
    icone: r.icone,
    phrase: r.phrase,
    cadence: r.cadence,
    score: scoreRival(r.id, t),
    battu: !!battus[r.id],
    moi: false,
  }));
  lignes.push({
    id: "moi",
    nom: "Toi",
    icone: "star",
    phrase: "",
    cadence: null,
    score: cookiesAVie(state),
    battu: false,
    moi: true,
  });

  lignes.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // À égalité, le joueur passe derrière (voir plus haut), et les rivaux
    // gardent leur ordre de cadence. Sans cette seconde clé, la toute première
    // seconde — où tout le monde est à zéro — donnait un ordre des sept qui
    // dépendait de l'implémentation du tri.
    if (a.moi) return 1;
    if (b.moi) return -1;
    return (b.cadence || 0) - (a.cadence || 0);
  });
  return lignes.map((l, i) => ({ ...l, rang: i + 1 }));
}

/**
 * Où en est le joueur, et à quelle distance du suivant.
 *
 * `part` est la fraction du score de celui qui précède — c'est ce que remplit
 * la barre du ruban, et c'est la seule mesure d'écart qui reste lisible du
 * premier millier de cookies au dixième de milliard de milliards.
 */
export function positionDuJoueur(state) {
  const lignes = classement(state);
  const i = lignes.findIndex((l) => l.moi);
  if (i < 0) return null;
  const moi = lignes[i];
  const devant = i > 0 ? lignes[i - 1] : null;
  const derriere = i < lignes.length - 1 ? lignes[i + 1] : null;
  const part = devant && devant.score > 0 ? Math.max(0, Math.min(1, moi.score / devant.score)) : 1;
  return { rang: moi.rang, total: lignes.length, score: moi.score, devant, derriere, part, lignes };
}

/** Les rivaux que le joueur devance À CET INSTANT. */
export function rivauxDevances(state) {
  const t = tempsDeJeuAVie(state);
  const moi = cookiesAVie(state);
  if (moi <= 0) return [];
  return RIVAUX.filter((r) => scoreRival(r.id, t) < moi);
}

/** Le ruban n'a rien à dire tant que le joueur n'a dépassé personne. */
export const rubanVisible = (state) => Object.keys(state?.classement?.battus || {}).length > 0;

/**
 * Prime d'un premier dépassement, en cookies: **une minute de la production
 * du moment**, clic compris.
 *
 * Elle est proportionnelle à ce que le joueur produit déjà, et c'est ce qui la
 * rend sûre à tous les stades: soixante cookies à la première minute, une
 * minute d'avance en fin de partie. Une valeur fixe aurait été un cadeau
 * absurde au début et une poussière ensuite.
 */
export function primeDepassement(stats) {
  const minage = Math.max(0, Number(stats?.mining) || 0);
  const parClic = Math.max(0, Number(stats?.perClickNoCombo) || 0);
  return Math.max(50, Math.round(60 * (minage + parClic)));
}
