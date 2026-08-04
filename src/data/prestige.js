import { STEP, niceIntAt, snap } from "../utils/grid.js";

// === Arbre céleste ===
//
// Améliorations permanentes achetées avec les chips de prestige. Elles
// survivent à tous les prestiges suivants.
//
// La plupart des nœuds n'ont pas de niveau maximum: leur coût croît, jamais
// leur limite. Auparavant l'arbre entier se maxait pour 2 036 chips, atteints
// vers 4,1e12 cookies cuits — passé ce point le prestige n'apportait plus rien
// et la partie n'avait plus d'horizon.

// Coût d'un niveau, sur l'échelle des nombres agréables: 1 · 2,5 · 5 · 10 · 25…
// Un nœud « cher » démarre simplement plus haut sur la même échelle.
const ladderCost = (first) => (lvl) => niceIntAt(first + lvl);

export const PRESTIGE_UPGRADES = [
  {
    id: "celestial_dough",
    name: "Pâte céleste",
    emoji: "☁️",
    desc: "+0,25 au multiplicateur de minage, par niveau.",
    maxLevel: Infinity,
    cost: ladderCost(0),
    effect: { type: "cps_mult", perLevel: STEP },
  },
  {
    id: "golden_fingers",
    name: "Doigts d'or",
    emoji: "🖐️",
    desc: "+0,25 au multiplicateur de puissance de clic, par niveau.",
    maxLevel: Infinity,
    cost: ladderCost(0),
    effect: { type: "cpc_mult", perLevel: STEP },
  },
  {
    id: "cheap_bricks",
    name: "Briques bon marché",
    emoji: "🧱",
    desc: "-5 % sur le coût des bâtiments par niveau (max -50 %).",
    maxLevel: 10, // borné: une réduction de 100 % rendrait tout gratuit
    cost: ladderCost(1),
    effect: { type: "cost_reduction", perLevel: 0.05, cap: 0.5 },
  },
  {
    id: "head_start",
    name: "Départ lancé",
    emoji: "🚀",
    desc: "Après un prestige, repars avec 5 % de ta production totale par niveau (max 50 %).",
    // Exprimé en fraction et non en valeur absolue: un ×10 par niveau sans
    // limite aurait fini par offrir plus de cookies que la partie entière.
    maxLevel: 10,
    cost: ladderCost(2),
    effect: { type: "start_fraction", perLevel: 0.05, cap: 0.5 },
  },
  {
    id: "night_shift",
    name: "Équipe de nuit",
    emoji: "🌙",
    desc: "+25 % de rendement hors-ligne par niveau.",
    maxLevel: 8,
    cost: ladderCost(1),
    effect: { type: "offline_mult", perLevel: 0.25 },
  },
  {
    id: "lucky_star",
    name: "Étoile chanceuse",
    emoji: "⭐",
    desc: "Cookies dorés 25 % plus fréquents par niveau.",
    maxLevel: 8, // borné: au-delà les dorés deviendraient permanents
    cost: ladderCost(1),
    effect: { type: "golden_rate", perLevel: 0.25 },
  },
  {
    id: "crypto_edge",
    name: "Avantage crypto",
    emoji: "🪙",
    desc: "+25 % de rendement de minage et de staking par niveau.",
    maxLevel: 8,
    cost: ladderCost(2),
    effect: { type: "crypto_mult", perLevel: 0.25 },
  },
  {
    id: "quest_master",
    name: "Maître des quêtes",
    emoji: "📜",
    desc: "+25 % sur les récompenses de quête par niveau.",
    maxLevel: 8,
    cost: ladderCost(2),
    effect: { type: "quest_mult", perLevel: 0.25 },
  },
];

export const PRESTIGE_BY_ID = Object.fromEntries(PRESTIGE_UPGRADES.map((u) => [u.id, u]));

export const levelOf = (state, id) => state.prestige?.upgrades?.[id] || 0;

export const upgradeCost = (id, level) => {
  const u = PRESTIGE_BY_ID[id];
  if (!u) return Infinity;
  if (level >= u.maxLevel) return Infinity;
  return u.cost(level);
};

/** Un nœud sans plafond ne s'affiche pas comme « x/y ». */
export const isEndless = (id) => PRESTIGE_BY_ID[id]?.maxLevel === Infinity;

/** Chips disponibles = gagnés - dépensés dans l'arbre. */
export const availableChips = (state) =>
  Math.max(0, (state.prestige?.chips || 0) - (state.prestige?.spent || 0));

/** Agrège tous les effets de l'arbre en un objet de multiplicateurs. */
export function prestigeEffects(state) {
  const up = state.prestige?.upgrades || {};
  const lvl = (id) => up[id] || 0;
  const e = PRESTIGE_BY_ID;

  const costReduction = Math.min(
    e.cheap_bricks.effect.cap,
    lvl("cheap_bricks") * e.cheap_bricks.effect.perLevel
  );
  const goldenLevels = Math.min(e.lucky_star.maxLevel, lvl("lucky_star"));

  return {
    // Des CRANS, pas des multiplicateurs: ils s'additionnent à ceux des chips
    // et du staking avant d'être convertis une seule fois en ×N. Convertir
    // chaque source séparément puis multiplier redonnait des ×2,8125.
    mineSteps: lvl("celestial_dough"),
    clickSteps: lvl("golden_fingers"),
    // Multiplicateurs isolés, pour l'affichage de l'arbre uniquement.
    cpsMult: snap(1 + lvl("celestial_dough") * STEP),
    cpcMult: snap(1 + lvl("golden_fingers") * STEP),
    costMult: 1 - costReduction,
    startFraction: Math.min(e.head_start.effect.cap, lvl("head_start") * e.head_start.effect.perLevel),
    offlineMult: 1 + lvl("night_shift") * e.night_shift.effect.perLevel,
    goldenRate: 1 + goldenLevels * e.lucky_star.effect.perLevel,
    cryptoMult: 1 + lvl("crypto_edge") * e.crypto_edge.effect.perLevel,
    questMult: 1 + lvl("quest_master") * e.quest_master.effect.perLevel,
  };
}

/**
 * Chips que rapporterait un prestige immédiat.
 *
 * Racine cubique et non carrée: les chips multiplient la production, qui nourrit
 * la production totale, qui redonne des chips. En racine carrée cette boucle
 * divergeait — soixante prestiges et 6,5e13 chips en une semaine simulée.
 */
export const chipsFor = (lifetime, chipMult = 1) => {
  const vie = Number(lifetime);
  const m = Number(chipMult);
  const base = Number.isFinite(vie) && vie > 0 ? Math.cbrt(vie / 1_000) : 0;
  // Un multiplicateur absent ou aberrant vaut 1: il ne doit jamais faire
  // BAISSER les chips, ni les rendre non finis.
  const mult = Number.isFinite(m) && m > 1 ? m : 1;
  return Math.floor(base * mult);
};

/**
 * Seuil minimal pour que le prestige soit proposé.
 *
 * Mesuré, pas estimé: à cinq millions la première renaissance tombait à 29
 * minutes, alors que le joueur découvrait encore les Cliqueurs de rang 4. À
 * 250 millions elle tombe à **79 minutes**, au milieu de la fourchette visée de
 * 60 à 120 minutes, et le premier vrai palier de bâtiment (19 minutes) a le
 * temps d'arriver avant.
 *
 * Effet de bord voulu: la première renaissance rapporte 63 chips au lieu de 17.
 * Une première fois qui ne rapporte presque rien n'apprend rien au joueur sur
 * ce que le prestige va lui donner.
 */
export const PRESTIGE_MIN_LIFETIME = 250_000_000;

/**
 * CRMB versés à chaque renaissance.
 *
 * Le prestige est l'effort le plus long du jeu, et il figurait dans la liste
 * annoncée des sources de CRMB — sans qu'aucune ligne de code ne le crédite.
 */
export const CRMB_PAR_PRESTIGE = 5;
