// === Moteur de simulation ===
//
// Il ne réimplémente aucune formule: il appelle `deriveStats`, `costOf` et
// `comboMultiplier` du jeu réel. Une simulation qui recalculerait l'économie de
// son côté décrirait un autre jeu que celui qu'on publie — c'est exactement ce
// qui avait laissé passer un rapport actif/passif faux pendant trois audits.
//
// Ce n'est pas un test humain: il ne dit rien du ressenti, de la lisibilité ni
// du plaisir. Il ne mesure que des nombres.

import { createFreshState } from "../utils/state.js";
import { deriveStats, costOf } from "../utils/selectors.js";
import { COMBO, comboMultiplier } from "../utils/combo.js";
import { creditedRate } from "../utils/rate.js";
import { ITEMS } from "../data/items.js";
import { availableUpgrades } from "../data/upgrades.js";
import { chipsFor, PRESTIGE_MIN_LIFETIME, CRMB_PAR_PRESTIGE } from "../data/prestige.js";
import { ascensionEffects, canAscend, starsFor, trackCost, trackLevel } from "../data/ascension.js";

const SECOND = 1000;
export const HORIZONS = [
  ["1 min", 60 * SECOND],
  ["5 min", 300 * SECOND],
  ["15 min", 900 * SECOND],
  ["1 h", 3600 * SECOND],
  ["6 h", 6 * 3600 * SECOND],
  ["1 j", 24 * 3600 * SECOND],
  ["3 j", 3 * 24 * 3600 * SECOND],
  ["7 j", 7 * 24 * 3600 * SECOND],
  ["30 j", 30 * 24 * 3600 * SECOND],
  ["90 j", 90 * 24 * 3600 * SECOND],
  ["365 j", 365 * 24 * 3600 * SECOND],
];

/**
 * Combo tenu à une cadence donnée, en régime établi.
 *
 * Un joueur qui clique sans interruption à `cps` monte de `cps` crans de chaîne
 * par seconde et sature au maximum. On ne suppose pas le combo plein: on le
 * calcule à partir de la chaîne réellement atteinte au bout de `elapsedS`
 * secondes de rafale.
 */
export function comboAfter(clicksPerSecond, elapsedS) {
  const credited = creditedRate(clicksPerSecond);
  if (credited <= 0) return 1;
  return comboMultiplier(Math.min(COMBO.streakCap, credited * elapsedS));
}

/**
 * Combo MOYEN sur une rafale de `burstS` secondes, à `cps` clics par seconde.
 *
 * C'est la seule valeur honnête à utiliser sur un horizon long: sur une heure
 * de jeu haché, le joueur ne passe pas l'heure entière au maximum.
 */
export function comboMoyen(clicksPerSecond, burstS = 60) {
  const credited = creditedRate(clicksPerSecond);
  if (credited <= 0) return 1;
  const parCran = COMBO.clicksPerStep / credited; // secondes par cran
  let somme = 0;
  let reste = burstS;
  for (let niveau = 0; niveau < COMBO.steps && reste > 0; niveau++) {
    const t = Math.min(parCran, reste);
    somme += t * (1 + 0.25 * niveau);
    reste -= t;
  }
  somme += Math.max(0, reste) * COMBO.max;
  return somme / burstS;
}

/** Revenu total par seconde: minage + production des clics. */
export function income(state, clicksPerSecond, combo, now) {
  const d = deriveStats(state, now, 0);
  return d.mining + d.perClickNoCombo * combo * creditedRate(clicksPerSecond);
}

// --- Candidats d'achat ------------------------------------------------------

/**
 * Tous les achats possibles, avec leur prix et le revenu qu'ils ajoutent.
 *
 * Le « revenu ajouté » se mesure à la cadence du profil: un Cliqueur ne vaut
 * rien pour qui ne clique pas, et c'est voulu. C'est ce qui fait qu'un même
 * catalogue produit des parties différentes selon la façon de jouer.
 */
function candidates(state, cps, combo, now, portee = Infinity) {
  const base = income(state, cps, combo, now);
  const out = [];

  // On écarte d'abord ce qui est hors de portée, PUIS on calcule les gains: le
  // gain coûte un `deriveStats` complet, et un Big Bake à 10^13 cookies n'a
  // aucune raison d'être évalué pendant la première heure de jeu.
  for (const item of ITEMS) {
    const price = costOf(state, item.id, 1, now);
    if (!isFinite(price) || price > portee) continue;
    const next = { ...state, items: { ...state.items, [item.id]: (state.items[item.id] || 0) + 1 } };
    out.push({ kind: "item", id: item.id, item, price, gain: income(next, cps, combo, now) - base });
  }

  for (const up of availableUpgrades(state)) {
    if (up.cost > portee || !up.unlock(state)) continue;
    const next = { ...state, upgrades: { ...state.upgrades, [up.id]: true } };
    out.push({ kind: "upgrade", id: up.id, price: up.cost, gain: income(next, cps, combo, now) - base });
  }

  return out;
}

/**
 * Stratégies d'achat. Chacune décrit un vrai joueur, pas un optimum théorique.
 *
 * Chaque stratégie reçoit la liste des candidats qui rapportent quelque chose et
 * rend celui qu'elle veut. Le moteur, lui, applique une règle commune à tous les
 * joueurs: on achète d'abord ce qu'on peut se payer, et on n'épargne que
 * lorsqu'on ne peut rien s'offrir du tout.
 */
export const STRATEGIES = {
  /** Le meilleur rendement par cookie dépensé. Le plafond du jeu. */
  optimiser: (list) => pick(list, (c) => c.gain / Math.max(1, c.price)),

  /** Achète ce qui rapporte le plus, sans regarder le prix. Le réflexe courant. */
  gourmand: (list) => pick(list, (c) => c.gain),

  /**
   * Alterne consciencieusement un achat de clic, un achat de minage. C'est le
   * schéma humain le plus répandu: on veut « progresser des deux côtés ».
   */
  equilibre: (list, seed) => {
    const mode = seed % 2 === 0 ? "click" : "mine";
    const prefere = list.filter((c) => c.kind === "item" && c.item.mode === mode);
    return pick(prefere.length ? prefere : list, (c) => c.gain / Math.max(1, c.price));
  },

  /** Ne jure que par le passif: n'achète jamais un Cliqueur. */
  mineur: (list) => pick(sansFamille(list, "click"), (c) => c.gain / Math.max(1, c.price)),

  /** Ne jure que par le clic. */
  cliqueur: (list) => pick(sansFamille(list, "mine"), (c) => c.gain / Math.max(1, c.price)),

  /**
   * Mauvaise répartition: achète toujours le moins cher, donc empile les rangs
   * bas et ne débloque jamais rien. C'est le profil qu'il faut pouvoir rattraper.
   */
  mauvaise: (list) => pick(list, (c) => -c.price),

  /** Achats au hasard. Déterministe: une simulation doit être rejouable. */
  aleatoire: (list, seed) => (list.length ? list[Math.floor(pseudo(seed) * list.length) % list.length] : null),
};

const sansFamille = (list, mode) => {
  const filtre = list.filter((c) => c.kind !== "item" || c.item.mode !== mode);
  return filtre.length ? filtre : list;
};

const pick = (list, score) => {
  let best = null;
  let bestScore = -Infinity;
  for (const c of list) {
    const s = score(c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
};

// Générateur déterministe: une simulation doit être rejouable à l'identique.
const pseudo = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// --- Boucle -----------------------------------------------------------------

/**
 * Joue une partie.
 *
 * La boucle est pilotée par les ÉVÉNEMENTS et non par un pas fixe: on calcule
 * le temps qu'il faut pour s'offrir le prochain achat et on y saute. Un pas de
 * 100 ms aurait demandé trois cents millions d'itérations pour couvrir un an.
 *
 * @param {object} opts
 * @param {number} opts.clicksPerSecond cadence brute du joueur (avant bornage)
 * @param {number} opts.activeFraction  part du temps réellement passée à cliquer
 * @param {string} opts.strategy        clé de STRATEGIES
 * @param {number} opts.durationMs      horizon
 * @param {number} opts.burstS          durée d'une rafale, pour le combo moyen
 */
export function play({
  clicksPerSecond = 5,
  activeFraction = 1,
  strategy = "optimiser",
  durationMs = 3600 * SECOND,
  burstS = 60,
  prestige = true,
  ascension = true,
  ordreVoies = ["horizon", "echo", "eclat"],
  patienceS = 600,
  maxSteps = 200_000,
} = {}) {
  const state = createFreshState(0);
  state.ui.introSeen = true;
  state.createdAt = 0;

  const combo = comboMoyen(clicksPerSecond, burstS);
  const cpsEffectif = clicksPerSecond * Math.max(0, Math.min(1, activeFraction));
  const choisir = STRATEGIES[strategy] || STRATEGIES.optimiser;

  let now = 0;
  let achats = 0;
  let prestiges = 0;
  let ascensions = 0;
  let crmb = 0;
  const decisions = []; // horodatage de chaque achat, pour mesurer le rythme
  const jalons = {}; // première fois qu'un contenu apparaît
  // Le rapport actif/passif relevé APRÈS chaque achat. Un relevé unique à
  // l'horizon tombe au hasard juste après un gros achat et saute de 3,2 à 4,6
  // sans que l'équilibre ait bougé: c'est la médiane sur la période qui décrit
  // ce que le joueur vit.
  const releves = [];
  // Production maximale atteinte au cours de la partie. Sur une partie qui
  // renaît, un relevé unique à l'horizon tombe souvent juste après une remise à
  // zéro et décrit un parc vide: le sommet dit ce que le joueur a réellement
  // construit.
  let sommet = 0;

  const jalon = (nom) => {
    if (jalons[nom] === undefined) jalons[nom] = now;
  };

  for (let step = 0; step < maxSteps && now < durationMs; step++) {
    // Horizon d'épargne. Un joueur se fixe un objectif et attend de pouvoir se
    // l'offrir, mais il n'attend pas indéfiniment: au-delà de dix minutes
    // d'attente il se rabat sur quelque chose de plus proche. Sans cette borne,
    // un profil « achète le plus gros gain » épargnerait un an pour un Portail
    // et la simulation décrirait un joueur qui n'existe pas.
    const parSeconde = income(state, cpsEffectif, combo, now);
    const portee = state.cookies + parSeconde * patienceS;
    const liste = candidates(state, cpsEffectif, combo, now, portee).filter((c) => c.gain > 0);

    // Rien à portée: on regarde alors tout le catalogue pour trouver l'objectif
    // le moins cher, quitte à épargner plus longtemps.
    const cible =
      (liste.length ? choisir(liste, step) : null) ||
      pick(
        candidates(state, cpsEffectif, combo, now).filter((c) => c.gain > 0),
        (c) => -c.price
      );

    // Plus rien à acheter qui rapporte: on laisse simplement tourner le temps.
    if (!cible) {
      now = durationMs;
      break;
    }

    const manque = cible.price - state.cookies;
    if (manque > 0) {
      if (parSeconde <= 0) {
        now = durationMs;
        break;
      }
      const attente = (manque / parSeconde) * 1000;
      const saut = Math.min(attente, durationMs - now);
      state.cookies += (parSeconde * saut) / 1000;
      state.lifetime += (parSeconde * saut) / 1000;
      now += saut;
      if (now >= durationMs) break;
      // Arrondi: on complète le centime manquant plutôt que de boucler.
      state.cookies = Math.max(state.cookies, cible.price);
    }

    state.cookies -= cible.price;
    // Un achat est « marquant » quand il apporte du NOUVEAU: un bâtiment jamais
    // possédé, un palier, un bonus global. Le quarante-deuxième Curseur ne
    // marque personne, et compter tous les achats faisait croire à sept
    // événements par minute là où il y en avait deux.
    let marquant = cible.kind !== "item";
    if (cible.kind === "item") {
      marquant = !state.items[cible.id];
      state.items[cible.id] = (state.items[cible.id] || 0) + 1;
      jalon(`bâtiment:${cible.id}`);
    } else {
      state.upgrades[cible.id] = true;
      jalon(`amélioration:${cible.id.split(":")[0]}`);
    }
    achats++;
    decisions.push({ t: now, prix: cible.price, kind: cible.kind, id: cible.id, marquant });
    {
      const d = deriveStats(state, now, 0);
      const pc = d.perClickNoCombo * combo * creditedRate(cpsEffectif);
      releves.push({ t: now, ratio: d.mining > 0 ? (d.mining + pc) / d.mining : Infinity });
      sommet = Math.max(sommet, d.mining + pc);
    }

    // Prestige: quand la renaissance rapporterait au moins la moitié des chips
    // déjà possédées, c'est le moment où elle cesse d'être anecdotique.
    if (prestige && state.lifetime >= PRESTIGE_MIN_LIFETIME) {
      const gagne = chipsFor(state.lifetime, ascensionEffects(state).chipMult);
      const actuels = state.prestige.chips;
      if (gagne >= Math.max(1, actuels * 1.5)) {
        const garde = state.prestige;
        const asc = state.ascension;
        Object.assign(state, createFreshState(now), {
          createdAt: 0,
          prestige: { chips: gagne, spent: garde.spent, upgrades: { ...garde.upgrades } },
          ascension: asc,
        });
        state.ui.introSeen = true;
        prestiges++;
        crmb += CRMB_PAR_PRESTIGE;
        jalon("prestige");
      }
    }

    // Ascension. On ne la prend pas dès qu'elle est possible: comme le
    // prestige, elle ne vaut le coup que si la moisson est notable au regard de
    // ce qu'on possède déjà. Ascendre pour une étoile quand on en a cinquante,
    // c'est perdre son parc pour rien.
    if (ascension && canAscend(state) && starsFor(state.prestige.chips) >= Math.max(1, (state.ascension?.stars || 0) * 0.5)) {
      const etoiles = starsFor(state.prestige.chips);
      const asc = {
        stars: (state.ascension?.stars || 0) + etoiles,
        spent: state.ascension?.spent || 0,
        tracks: { ...(state.ascension?.tracks || {}) },
        count: (state.ascension?.count || 0) + 1,
      };
      Object.assign(state, createFreshState(now), { createdAt: 0, ascension: asc });
      state.ui.introSeen = true;
      ascensions++;
      jalon("ascension");

      // Dépense: on ouvre l'Horizon en priorité — c'est le seul levier qui
      // apporte du CONTENU — puis on alterne Écho et Éclat.
      let libres = asc.stars - asc.spent;
      let progresse = true;
      while (libres > 0 && progresse) {
        progresse = false;
        for (const t of ordreVoies) {
          const niveau = trackLevel(state, t);
          const prix = trackCost(t, niveau);
          if (isFinite(prix) && prix <= libres) {
            state.ascension.tracks[t] = niveau + 1;
            state.ascension.spent += prix;
            libres -= prix;
            progresse = true;
            jalon(`voie:${t}`);
          }
        }
      }
    }
  }

  const d = deriveStats(state, now, 0);
  const prodClics = d.perClickNoCombo * combo * creditedRate(cpsEffectif);
  return {
    now,
    state,
    achats,
    prestiges,
    ascensions,
    sommet,
    crmb,
    decisions,
    releves,
    jalons,
    combo,
    stats: {
      cookies: state.cookies,
      lifetime: state.lifetime,
      parClic: d.perClickNoCombo * combo,
      cadence: creditedRate(cpsEffectif),
      prodClics,
      minage: d.mining,
      total: d.mining + prodClics,
      ratio: d.mining > 0 ? (d.mining + prodClics) / d.mining : Infinity,
      batiments: ITEMS.filter((i) => (state.items[i.id] || 0) > 0).length,
      paliers: Object.keys(state.upgrades).length,
      chips: state.prestige.chips,
      etoiles: state.ascension?.stars || 0,
      voies: { ...(state.ascension?.tracks || {}) },
    },
  };
}

const mediane = (xs) => {
  if (!xs.length) return NaN;
  const t = [...xs].sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)];
};

/**
 * Rapport actif/passif médian sur une tranche de la partie.
 *
 * On prend la seconde moitié de la période: la première contient encore l'effet
 * de la période précédente. Faute de relevé dans la fenêtre, on rend le dernier
 * relevé connu — le rapport ne bouge pas quand on n'achète rien.
 */
export function ratioMedian(releves, jusqu) {
  const depuis = jusqu / 2;
  const dans = releves.filter((r) => r.t >= depuis && r.t <= jusqu).map((r) => r.ratio);
  if (dans.length) return mediane(dans);
  const avant = releves.filter((r) => r.t <= jusqu);
  return avant.length ? avant[avant.length - 1].ratio : Infinity;
}

/**
 * Écart médian entre deux achats, en secondes. Mesure le rythme perçu.
 * `seulementMarquants` ne retient que les achats qui apportent du nouveau.
 */
export function ecartMedian(decisions, depuis = 0, jusqu = Infinity, seulementMarquants = false) {
  const t = decisions
    .filter((d) => d.t >= depuis && d.t <= jusqu && (!seulementMarquants || d.marquant))
    .map((d) => d.t);
  if (t.length < 2) return Infinity;
  const ecarts = [];
  for (let i = 1; i < t.length; i++) ecarts.push((t[i] - t[i - 1]) / 1000);
  return mediane(ecarts);
}

/** Premier achat réellement payé. Le bâtiment offert au démarrage ne compte pas. */
export const premierAchatPaye = (decisions) => decisions.find((d) => d.prix > 0)?.t ?? Infinity;

/** Nombre d'achats marquants sur une période. */
export const marquantsEntre = (decisions, depuis, jusqu) =>
  decisions.filter((d) => d.marquant && d.t >= depuis && d.t <= jusqu).length;
