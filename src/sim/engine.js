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
import { chipsFor, PRESTIGE_MIN_LIFETIME, CRMB_PAR_PRESTIGE, prestigeEffects } from "../data/prestige.js";
import { ascensionEffects, canAscend, starsFor, trackCost, trackLevel } from "../data/ascension.js";
import { buildContext, tickQuests } from "../quests/engine.js";
import { ACHIEVEMENTS, achievementReward, achievementCrmb } from "../data/achievements.js";
import { gainChance, gainJackpot, gainMiette } from "../utils/gains.js";
import { offlineGains } from "../utils/offline.js";
import { MINERS, minerCost, addCrmb, accrueCrmb } from "../utils/crypto.js";
import tuning from "../data/tuning.json";

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

// --- Couche d'événements -----------------------------------------------------
//
// Ce que le simulateur précédent ne voyait pas: les quêtes, les cookies dorés,
// la pluie, les succès, le CRMB gagné en jouant. La couche est OPT-IN — les
// familles historiques restent comparables — et chaque morceau dit ce qu'il
// est: moteur RÉEL pour les quêtes et les succès, ESPÉRANCE mathématique pour
// les événements aléatoires, vraie fonction du jeu pour le hors-ligne.
//
// Ce qui n'est PAS modélisé, et pourquoi:
//   · les quêtes chronométrées échouent souvent ici (les tranches de temps
//     dépassent leur chrono): un joueur simulé qui les ignore, c'est honnête;
//   · le TRADING du marché CRMB: la marche est centrée et les frais font 2 %
//     par sens — l'espérance de toute stratégie d'échange est négative, on ne
//     crédite donc aucun gain de trading;
//   · la vérification humaine: elle ne retire rien à un joueur honnête;
//   · les apparences: aucun effet sur l'économie.

const CFG_EVENEMENTS = tuning?.[tuning?.mode || "standard"]?.events || {};

/** Espérance de cookies d'UN doré attrapé, buffs convertis en production. */
function esperanceDore(state, d, revenuParSeconde) {
  const g = CFG_EVENEMENTS.golden || {};
  const moyenne = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // 35 %: buff de minage (25 s) · 30 %: buff de clic (15 s) · 23 %: chance ·
  // 12 %: jackpot. Les multiplicateurs décroissants des dorés enchaînés se
  // moyennent — un profil qui les attrape tous vit surtout les premiers crans.
  const dr = moyenne((g.lucky_mults || [1, 0.5, 0.25, 0.1]).slice(0, 2));
  const evBuffMine = (moyenne(g.cps_mults || [5, 3, 2]) - 1) * d.mining * 25;
  const evBuffClic = (moyenne(g.cpc_mults || [10, 5, 3]) - 1) * Math.max(0, revenuParSeconde - d.mining) * 15;
  return 0.35 * evBuffMine + 0.3 * evBuffClic + 0.23 * gainChance(state, d, dr) + 0.12 * gainJackpot(d, dr);
}

/**
 * Avance la couche d'événements sur une tranche de temps déjà « minée ».
 * Rend les cookies et le CRMB supplémentaires crédités.
 */
function avancerEvenements(state, now, trancheMs, ev, cpsCredite, revenuParSeconde, compteurs) {
  if (!ev) return 0;
  const d = deriveStats(state, now, 0);
  let bonus = 0;

  // --- Clics accumulés: les quêtes et succès de clics en dépendent ---------
  state.stats.clicks = (state.stats.clicks || 0) + Math.round((cpsCredite * trancheMs) / 1000);

  // --- Cookies dorés, pluie, volant: en espérance ---------------------------
  if (trancheMs > 0 && ev.dores > 0) {
    const g = CFG_EVENEMENTS.golden || {};
    const cadenceSpawnS = ((g.cooldown_s || [45, 90])[0] + (g.cooldown_s || [45, 90])[1]) / 2;
    const attrapes = (trancheMs / 1000 / cadenceSpawnS) * ev.dores * (prestigeEffects(state).goldenRate || 1);
    bonus += attrapes * esperanceDore(state, d, revenuParSeconde);
    state.stats.goldenClicks = (state.stats.goldenClicks || 0) + Math.round(attrapes);
    const avantDores = Math.floor(compteurs.dores);
    compteurs.dores += attrapes;
    for (let k = avantDores; k < Math.floor(compteurs.dores); k++) compteurs.moments.push(now);
  }
  if (trancheMs > 0 && ev.pluie > 0) {
    const p = CFG_EVENEMENTS.rain || {};
    const cadenceS = ((p.cooldown_s || [90, 160])[0] + (p.cooldown_s || [90, 160])[1]) / 2;
    const vagues = trancheMs / 1000 / cadenceS;
    const parVague = (p.count || 26) * ev.pluie;
    const multMoyen = ((p.cpc_mults || [2, 2.5, 3]).reduce((a, b) => a + b, 0)) / (p.cpc_mults || [2, 2.5, 3]).length;
    bonus += vagues * parVague * gainMiette(d, multMoyen);
    compteurs.miettes += vagues * parVague;
  }

  // --- Quêtes: le VRAI moteur, tranche par tranche --------------------------
  if (ev.quetes) {
    const ctx = buildContext(state);
    const resultat = tickQuests(state, ctx, now, ev.rng);
    if (resultat.changed) {
      Object.assign(state, resultat.state);
      for (const e of resultat.events) {
        if (e.type !== "completed") continue;
        compteurs.quetes += 1;
        compteurs.moments.push(now);
        compteurs.crmbQuetes += e.reward?.crmb || 0;
        // Le buff de la récompense expirerait pendant le prochain saut de
        // temps: on le convertit en son espérance de cookies, tout de suite.
        const b = e.reward?.buff;
        if (b) {
          const revenu = b.kind === "cps" ? d.mining : Math.max(0, revenuParSeconde - d.mining);
          bonus += (b.value - 1) * revenu * (b.seconds || 20);
        }
      }
    }
  }

  // --- Succès: les VRAIES conditions ---------------------------------------
  if (ev.succes) {
    for (const a of ACHIEVEMENTS) {
      if (state.unlocked[a.id]) continue;
      let atteint = false;
      try {
        atteint = a.cond(state, d);
      } catch {
        /* une condition qui lève ne bloque pas les autres */
      }
      if (atteint) {
        state.unlocked[a.id] = now || 1;
        bonus += achievementReward(a.tier, d.cps);
        const crmb = achievementCrmb(a.tier);
        if (crmb > 0) {
          state.crypto.balance = addCrmb(state.crypto.balance, crmb);
          compteurs.crmbSucces += crmb;
        }
        compteurs.succes += 1;
        compteurs.moments.push(now);
      }
    }
  }

  // --- CRMB: extraction réelle du matériel, achat simple de machines --------
  if (ev.crypto) {
    if (d.crmbRate > 0) {
      const brut = d.crmbRate * (trancheMs / 1000);
      const avant = state.crypto.balance;
      state.crypto = accrueCrmb(state.crypto, brut);
      compteurs.crmbExtraction += state.crypto.balance - avant;
    }
    // Il achète une machine quand elle coûte moins d'un dixième de la banque:
    // le comportement du profil « spécialiste » observé en campagne.
    for (const m of MINERS) {
      const possede = state.crypto.miners[m.id] || 0;
      if (possede >= 3) continue;
      const prix = minerCost(m.id, possede);
      if (prix <= state.cookies * 0.1) {
        state.cookies -= prix;
        state.crypto.miners[m.id] = possede + 1;
        compteurs.machines += 1;
      }
      break; // une seule par tranche, la moins chère d'abord
    }
  }

  return bonus;
}

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
  // Temps de DÉCISION entre deux achats, en secondes. Un humain repère la
  // carte, lit le prix, tape — huit à quinze secondes au téléphone. Sans ce
  // délai, le simulateur convertit chaque récompense en production à vitesse
  // infinie et décrit une borne supérieure théorique, pas un joueur.
  decisionS = 0,
  // Couche d'événements (quêtes, dorés, pluie, succès, CRMB). Opt-in pour que
  // la famille « mécanique » historique reste comparable d'un audit à l'autre.
  evenements = null,
  // Reprise d'une partie existante: sert au mode « onglet fermé » qui alterne
  // sessions réelles et gains hors-ligne.
  etatInitial = null,
} = {}) {
  const state = etatInitial || createFreshState(0);
  state.ui.introSeen = true;
  if (!etatInitial) state.createdAt = 0;

  const combo = comboMoyen(clicksPerSecond, burstS);
  const cpsEffectif = clicksPerSecond * Math.max(0, Math.min(1, activeFraction));
  const choisir = STRATEGIES[strategy] || STRATEGIES.optimiser;

  // Les compteurs de la couche d'événements, et son générateur semé: une
  // simulation se rejoue à l'identique, événements compris.
  // `moments` horodate chaque battement intéressant hors achat — une quête
  // rendue, un doré attrapé, un succès — pour mesurer le rythme VÉCU, pas
  // seulement le rythme des achats.
  const compteurs = { quetes: 0, succes: 0, dores: 0, miettes: 0, machines: 0, crmbQuetes: 0, crmbSucces: 0, crmbExtraction: 0, moments: [] };
  let ev = null;
  if (evenements) {
    let graine = (evenements.graine ?? 1) >>> 0;
    const rng = () => {
      graine = (graine * 1664525 + 1013904223) >>> 0;
      return graine / 4294967296;
    };
    ev = { quetes: true, dores: 0.6, pluie: 0.5, succes: true, crypto: true, ...evenements, rng };
  }
  const cpsCredite = creditedRate(cpsEffectif);

  let now = 0;
  let achats = 0;
  let prestiges = 0;
  let ascensions = 0;
  let crmb = 0;
  // Production cumulée à TRAVERS les renaissances: `lifetime` est remis à zéro
  // par chaque prestige, ce cumul ne l'est jamais. C'est lui qui permet de
  // comparer des sources de cookies (hors-ligne, événements) à la partie entière.
  let produitTotal = 0;
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
      let saut = Math.min(attente, durationMs - now);
      if (!ev) {
        state.cookies += (parSeconde * saut) / 1000;
        state.lifetime += (parSeconde * saut) / 1000;
        now += saut;
      } else {
        // La couche d'événements avance par tranches: assez fines pour que les
        // quêtes courtes se résolvent en début de partie, assez larges pour
        // qu'un an de jeu reste calculable. Un événement peut rendre l'achat
        // payable AVANT la fin de l'attente — c'est tout l'objet de la mesure
        // de rythme: les quêtes et les dorés densifient les premières minutes.
        while (saut > 0 && state.cookies < cible.price) {
          const tranche = Math.min(saut, Math.max(30 * SECOND, saut / 8));
          state.cookies += (parSeconde * tranche) / 1000;
          state.lifetime += (parSeconde * tranche) / 1000;
          now += tranche;
          saut -= tranche;
          const bonus = avancerEvenements(state, now, tranche, ev, cpsCredite, parSeconde, compteurs);
          if (bonus > 0) {
            state.cookies += bonus;
            state.lifetime += bonus;
          }
        }
      }
      if (now >= durationMs) break;
      // Arrondi: on complète le centime manquant plutôt que de boucler.
      state.cookies = Math.max(state.cookies, cible.price);
    } else if (ev) {
      // Même sans attente, le monde continue entre deux achats immédiats.
      avancerEvenements(state, now, 0, ev, 0, parSeconde, compteurs);
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

    // Le temps de décision: la production tourne pendant que le joueur
    // repère son prochain achat — huit à quinze secondes chez un humain.
    if (decisionS > 0 && now < durationMs) {
      const pause = Math.min(decisionS * SECOND, durationMs - now);
      const revenu = income(state, cpsEffectif, combo, now);
      state.cookies += (revenu * pause) / 1000;
      state.lifetime += (revenu * pause) / 1000;
      now += pause;
      if (ev) {
        const bonus = avancerEvenements(state, now, pause, ev, cpsCredite, revenu, compteurs);
        if (bonus > 0) {
          state.cookies += bonus;
          state.lifetime += bonus;
        }
      }
    }

    // Prestige: quand la renaissance rapporterait au moins la moitié des chips
    // déjà possédées, c'est le moment où elle cesse d'être anecdotique.
    if (prestige && state.lifetime >= PRESTIGE_MIN_LIFETIME) {
      const gagne = chipsFor(state.lifetime, ascensionEffects(state).chipMult);
      const actuels = state.prestige.chips;
      if (gagne >= Math.max(1, actuels * 1.5)) {
        produitTotal += state.lifetime;
        const garde = state.prestige;
        const asc = state.ascension;
        // Comme dans le jeu: le portefeuille CRMB, le matériel, le Registre et
        // les succès SURVIVENT à la renaissance — et elle rapporte ses 5 CRMB.
        const cryptoGarde = state.crypto;
        const succesGardes = state.unlocked;
        Object.assign(state, createFreshState(now), {
          createdAt: 0,
          prestige: { chips: gagne, spent: garde.spent, upgrades: { ...garde.upgrades } },
          ascension: asc,
          crypto: cryptoGarde,
          unlocked: succesGardes,
        });
        state.crypto.balance = addCrmb(state.crypto.balance, CRMB_PAR_PRESTIGE);
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
      produitTotal += state.lifetime;
      const etoiles = starsFor(state.prestige.chips);
      const asc = {
        stars: (state.ascension?.stars || 0) + etoiles,
        spent: state.ascension?.spent || 0,
        tracks: { ...(state.ascension?.tracks || {}) },
        count: (state.ascension?.count || 0) + 1,
      };
      // L'ascension emporte chips et arbre, mais garde CRMB, Registre, succès.
      const cryptoGarde = state.crypto;
      const succesGardes = state.unlocked;
      Object.assign(state, createFreshState(now), {
        createdAt: 0,
        ascension: asc,
        crypto: cryptoGarde,
        unlocked: succesGardes,
      });
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
    produitTotal: produitTotal + state.lifetime,
    compteurs,
    crmbDetail: {
      prestige: prestiges * CRMB_PAR_PRESTIGE,
      quetes: compteurs.crmbQuetes,
      succes: compteurs.crmbSucces,
      extraction: Math.round(compteurs.crmbExtraction * 100) / 100,
      solde: state.crypto?.balance || 0,
    },
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

/**
 * Écart médian entre deux MOMENTS INTÉRESSANTS: un achat marquant, une quête
 * rendue, un doré attrapé, un succès décroché. C'est la définition élargie du
 * rythme vécu — un joueur ne vit pas que d'achats.
 */
export function ecartMomentsInteressants(r, depuis = 0, jusqu = Infinity) {
  // Trois récompenses dans la même seconde se VIVENT comme un seul moment
  // (le jeu les regroupe d'ailleurs en une notification): on déduplique à la
  // seconde avant de mesurer les écarts.
  const temps = [
    ...new Set(
      [...r.decisions.filter((d) => d.marquant).map((d) => d.t), ...(r.compteurs?.moments || [])]
        .filter((t) => t >= depuis && t <= jusqu)
        .map((t) => Math.round(t / 1000))
    ),
  ].sort((a, b) => a - b);
  if (temps.length < 2) return Infinity;
  const ecarts = [];
  for (let i = 1; i < temps.length; i++) ecarts.push(temps[i] - temps[i - 1]);
  return mediane(ecarts);
}

/**
 * Le joueur qui FERME l'onglet: sessions réelles, et entre elles la vraie
 * fonction de retour hors-ligne du jeu — pas un minage continu idéalisé.
 *
 * La famille « vraies sessions » modélise un onglet ouvert en permanence où
 * seul le clic s'interrompt; celle-ci modélise l'autre joueur, celui pour qui
 * `offlineGains` a été écrit: plafond de deux heures, rendement dégressif.
 */
export function playFermetures({
  clicksPerSecond = 5,
  strategy = "equilibre",
  durationMs = 24 * 3600 * SECOND,
  sessionsParJour = 3,
  sessionMin = 10,
  burstS = 30,
  decisionS = 10,
  evenements = { graine: 1 },
} = {}) {
  const sessionMs = sessionMin * 60 * SECOND;
  const gapMs = Math.max(0, (24 * 3600 * SECOND - sessionsParJour * sessionMs) / sessionsParJour);
  let etat = null;
  let horloge = 0;
  let horsLigneCookies = 0;
  let horsLigneCrmb = 0;
  let sessions = 0;
  let dernier = null;
  // Production des SESSIONS, cumulée à travers prestiges et fermetures — le
  // seul dénominateur honnête pour « quelle part vient du hors-ligne ».
  let produitSessions = 0;

  while (horloge < durationMs) {
    const duree = Math.min(sessionMs, durationMs - horloge);
    const entrant = etat ? etat.lifetime : 0;
    dernier = play({
      clicksPerSecond,
      strategy,
      durationMs: duree,
      burstS,
      decisionS,
      evenements: evenements ? { ...evenements, graine: (evenements.graine ?? 1) + sessions } : null,
      etatInitial: etat,
    });
    etat = dernier.state;
    produitSessions += dernier.produitTotal - entrant;
    horloge += duree;
    sessions += 1;
    if (horloge >= durationMs) break;

    // L'onglet se ferme: pas de minage, puis le rapport du retour.
    const gains = offlineGains(etat, gapMs, horloge);
    etat.cookies += gains.cookies;
    etat.lifetime += gains.cookies;
    if (gains.crmb > 0) etat.crypto.balance = addCrmb(etat.crypto.balance, gains.crmb);
    horsLigneCookies += gains.cookies;
    horsLigneCrmb += gains.crmb;
    etat.stats.playtimeMs = (etat.stats.playtimeMs || 0) + gapMs;
    horloge += gapMs;
  }

  return {
    ...dernier,
    sessions,
    horsLigneCookies,
    horsLigneCrmb,
    produitSessions,
    produitTotal: produitSessions + horsLigneCookies,
    now: horloge,
  };
}
