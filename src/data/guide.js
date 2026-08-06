// === Le Guide ===
//
// Le problème qu'il résout, et c'est le plus grave qu'un jeu puisse avoir:
// un joueur qui ouvre Crumbora voit un cookie, un solde, une boutique — et
// aucune raison de continuer. Il clique dix fois, ne comprend pas où ça mène,
// et referme l'onglet. Tout le reste du jeu — les paliers, les quêtes, le
// CRMB, la Renaissance — est derrière ce mur de trente secondes.
//
// Le Guide dit trois choses, toujours dans cet ordre:
//
//   1. **Quoi faire**, en un geste précis et atteignable maintenant;
//   2. **Pourquoi**, en une phrase qui promet quelque chose de concret;
//   3. **Où on en est**, par une barre qui avance pendant qu'on joue.
//
// Il ne bloque rien, ne superpose rien, ne se met jamais en travers du cookie.
// Il se tait dès que le joueur n'en a plus besoin — les sept étapes franchies,
// il laisse la place à l'objectif du moment, et le joueur peut le masquer.
//
// Entièrement PUR: aucune de ces fonctions ne touche à React, au DOM ni à
// l'horloge. C'est ce qui permet de vérifier par des tests qu'un joueur neuf
// reçoit bien la première étape, et qu'un vétéran ne se fait pas expliquer le
// clic après quatre-vingts heures de jeu.

import { ITEMS, MINER_ITEMS } from "./items.js";
import { availableUpgrades, nextMilestone } from "./upgrades.js";
import { PRESTIGE_MIN_LIFETIME } from "./prestige.js";
import { fmt } from "../utils/format.js";

const mineursPossedes = (s) => MINER_ITEMS.reduce((n, it) => n + (s.items?.[it.id] || 0), 0);
const batimentsPossedes = (s) => ITEMS.reduce((n, it) => n + (s.items?.[it.id] || 0), 0);
const ameliorations = (s) => Object.keys(s.upgrades || {}).length;

// Les compteurs À VIE quand ils existent: sinon la Renaissance renverrait le
// joueur à « appuie sur le cookie » après quatre-vingts minutes de jeu.
const clics = (s) => Math.max(s.lifetimeStats?.clicks || 0, s.stats?.clicks || 0);
const dores = (s) => Math.max(s.lifetimeStats?.goldenClicks || 0, s.stats?.goldenClicks || 0);
const quetes = (s) =>
  Math.max(
    s.lifetimeStats?.questsCompleted || 0,
    Object.values(s.quests?.completed || {}).reduce((a, b) => a + b, 0)
  );

/**
 * Les sept premières minutes, découpées.
 *
 * Chaque étape ouvre EXACTEMENT un mécanisme, et dans l'ordre où le jeu les
 * rend utiles: on ne parle du CrumbCoin qu'à quelqu'un qui possède déjà une
 * boutique. `but` reste petit — une étape qu'on ne franchit pas en deux
 * minutes cesse d'être un guide et devient une corvée.
 */
export const ETAPES = [
  {
    id: "clic",
    titre: "Appuie sur le cookie",
    pourquoi: "Chaque appui tombe direct dans ta banque. Pour l'instant c'est ta seule source — ça ne va pas durer.",
    ou: "Le grand cookie, au centre",
    onglet: null,
    fait: (s) => clics(s) >= 10,
    progres: (s) => ({ fait: Math.min(10, clics(s)), but: 10 }),
  },
  {
    id: "curseur",
    titre: "Achète ton premier Curseur",
    pourquoi: "Il ajoute +0,25 à CHAQUE appui, définitivement. Dix Curseurs et ton clic vaut quatre fois plus.",
    ou: "Boutique → Cliqueurs",
    onglet: "shop",
    fait: (s) => (s.items?.cursor || 0) >= 1,
    progres: (s) => ({ fait: Math.min(1, s.items?.cursor || 0), but: 1 }),
  },
  {
    id: "four",
    titre: "Prends le Four — il est offert",
    pourquoi: "Le Four cuit tout seul, même quand tu ne touches à rien. C'est là que le jeu se met à jouer pour toi.",
    ou: "Boutique → Minage",
    onglet: "shop",
    fait: (s) => mineursPossedes(s) >= 1,
    progres: (s) => ({ fait: Math.min(1, mineursPossedes(s)), but: 1 }),
  },
  {
    id: "parc",
    titre: "Monte à dix bâtiments",
    pourquoi: "Rien ne plafonne: le dixième rapporte autant que le premier. À dix, ta banque grimpe pendant que tu regardes.",
    ou: "Boutique",
    onglet: "shop",
    fait: (s) => batimentsPossedes(s) >= 10,
    progres: (s) => ({ fait: Math.min(10, batimentsPossedes(s)), but: 10 }),
  },
  {
    id: "palier",
    titre: "Achète une amélioration",
    pourquoi: "Un palier DOUBLE d'un coup tout ce que rapporte un bâtiment. C'est le meilleur rapport du jeu, de loin.",
    ou: "Onglet Améliorations",
    onglet: "upgrades",
    fait: (s) => ameliorations(s) >= 1,
    progres: (s) => ({ fait: Math.min(1, ameliorations(s)), but: 1 }),
  },
  {
    id: "quete",
    titre: "Termine une quête",
    pourquoi: "Elles paient en cookies ET en CrumbCoin — la monnaie qui achète des bonus que rien ne t'enlève jamais.",
    ou: "Onglet Quêtes",
    onglet: "quests",
    fait: (s) => quetes(s) >= 1,
    progres: (s) => ({ fait: Math.min(1, quetes(s)), but: 1 }),
  },
  {
    id: "dore",
    titre: "Attrape un cookie doré",
    pourquoi: "Il apparaît au hasard et file en dix secondes. Un seul peut multiplier ta production par cinq.",
    ou: "N'importe où à l'écran",
    onglet: null,
    fait: (s) => dores(s) >= 1,
    progres: (s) => ({ fait: Math.min(1, dores(s)), but: 1 }),
  },
];

export const ETAPE_BY_ID = Object.fromEntries(ETAPES.map((e) => [e.id, e]));

/** Une étape franchie le reste: le latch survit à la remise à zéro du parc. */
export const etapeFaite = (state, etape) => !!state?.guide?.faites?.[etape.id] || etape.fait(state);

/**
 * L'étape en cours, ou `null` si le joueur les a toutes franchies.
 *
 * On ne stocke pas d'index: la première étape non faite EST l'étape courante.
 * Un compteur aurait fini par désigner une étape déjà accomplie sur une
 * sauvegarde importée ou bricolée.
 */
export function etapeCourante(state) {
  if (state?.guide?.masque) return null;
  const i = ETAPES.findIndex((e) => !etapeFaite(state, e));
  if (i < 0) return null;
  return { etape: ETAPES[i], index: i, total: ETAPES.length, ...ETAPES[i].progres(state) };
}

/** Étapes déjà franchies, pour l'affichage « 3 / 7 ». */
export const etapesFaites = (state) => ETAPES.filter((e) => etapeFaite(state, e)).length;

/**
 * Ce qu'il reste à viser une fois le guide terminé.
 *
 * Trois réponses, par ordre de ce qui change le plus la partie tout de suite.
 * L'objectif n'est jamais « rien »: un écran sans horizon est exactement ce
 * qui fait fermer l'onglet.
 */
export function prochainObjectif(state, stats = {}) {
  const vie = state.lifetime || 0;

  // 1. La Renaissance est POSSIBLE. C'est le plus gros moment du jeu et il
  //    passe inaperçu: rien à l'écran ne dit qu'un bouton vient de s'allumer
  //    dans un onglet qu'on n'ouvre pas souvent.
  if (vie >= PRESTIGE_MIN_LIFETIME) {
    return {
      cle: "renaissance-prete",
      titre: "Tu peux renaître",
      pourquoi:
        "Tout recommencer, mais avec des chips célestes: des bonus permanents que ni la Renaissance suivante ni rien d'autre ne t'enlèvera.",
      ou: "Onglet Prestige",
      onglet: "prestige",
      fait: 1,
      but: 1,
    };
  }

  // 2. Une amélioration payable MAINTENANT. C'est toujours le meilleur achat
  //    disponible, et c'est celui que les joueurs oublient le plus.
  let payable = null;
  try {
    for (const up of availableUpgrades(state)) {
      if (!up.unlock(state)) continue;
      if ((state.cookies || 0) < up.cost) continue;
      if (!payable || up.cost < payable.cost) payable = up;
    }
  } catch {
    // Un catalogue illisible ne doit pas priver le joueur d'objectif
  }
  if (payable) {
    return {
      cle: `amelioration:${payable.id}`,
      titre: `${payable.name} est à ta portée`,
      pourquoi: `${payable.desc} Tu as de quoi te l'offrir maintenant.`,
      ou: "Onglet Améliorations",
      onglet: "upgrades",
      fait: 1,
      but: 1,
    };
  }

  // 3. Le palier de bâtiment le plus proche. C'est l'objectif qui donne envie
  //    d'acheter le bâtiment suivant plutôt que de regarder le compteur monter.
  const palier = nextMilestone(state);
  if (palier) {
    return {
      cle: `palier:${palier.upgrade.id}`,
      titre: `${palier.left} ${palier.item.name} avant le palier`,
      pourquoi: `Au ${palier.upgrade.threshold}ᵉ, chaque ${palier.item.name} rapporte deux fois plus. Pour toujours.`,
      ou: "Boutique",
      onglet: "shop",
      fait: palier.owned,
      but: palier.upgrade.threshold,
    };
  }

  // 4. À défaut, l'horizon long: la Renaissance et le chemin qui y mène. Ce
  //    cas est rare — il reste presque toujours un palier à viser — mais il
  //    garantit qu'aucun écran ne se retrouve sans rien à montrer.
  if (vie > 0) {
    return {
      cle: "renaissance",
      titre: "Vise la Renaissance céleste",
      pourquoi: `À ${fmt(PRESTIGE_MIN_LIFETIME)} cookies cuits, tu peux tout recommencer avec des chips célestes — des bonus permanents que plus rien ne t'enlève.`,
      ou: "Onglet Prestige",
      onglet: "prestige",
      fait: Math.min(vie, PRESTIGE_MIN_LIFETIME),
      but: PRESTIGE_MIN_LIFETIME,
    };
  }

  return null;
}

/**
 * Ce que le Guide doit afficher, étapes et objectif confondus.
 *
 * Un seul point d'entrée pour l'interface: elle n'a pas à savoir si le joueur
 * en est à sa première minute ou à sa quatrième renaissance.
 */
export function conseil(state, stats) {
  if (state?.guide?.masque) return null;
  const courante = etapeCourante(state);
  if (courante) {
    return {
      cle: `etape:${courante.etape.id}`,
      phase: "decouverte",
      index: courante.index + 1,
      total: courante.total,
      titre: courante.etape.titre,
      pourquoi: courante.etape.pourquoi,
      ou: courante.etape.ou,
      onglet: courante.etape.onglet,
      fait: courante.fait,
      but: courante.but,
    };
  }
  const objectif = prochainObjectif(state, stats);
  return objectif ? { ...objectif, phase: "objectif" } : null;
}
