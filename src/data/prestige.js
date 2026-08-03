// === Arbre céleste ===
//
// Améliorations permanentes achetées avec les chips de prestige. Elles
// survivent à tous les prestiges suivants.
//
// La plupart des nœuds n'ont pas de niveau maximum: leur coût croît, jamais
// leur limite. Auparavant l'arbre entier se maxait pour 2 036 chips, atteints
// vers 4,1e12 cookies cuits — passé ce point le prestige n'apportait plus rien
// et la partie n'avait plus d'horizon.

export const PRESTIGE_UPGRADES = [
  {
    id: "celestial_dough",
    name: "Pâte céleste",
    emoji: "☁️",
    desc: "+5 % de production par niveau.",
    maxLevel: Infinity,
    cost: (lvl) => Math.ceil(1 + lvl * 2 + Math.pow(lvl, 1.7) * 0.4),
    effect: { type: "cps_mult", perLevel: 0.05 },
  },
  {
    id: "golden_fingers",
    name: "Doigts d'or",
    emoji: "🖐️",
    desc: "+8 % de puissance de clic par niveau.",
    maxLevel: Infinity,
    cost: (lvl) => Math.ceil(1 + lvl * 2 + Math.pow(lvl, 1.7) * 0.4),
    effect: { type: "cpc_mult", perLevel: 0.08 },
  },
  {
    id: "cheap_bricks",
    name: "Briques bon marché",
    emoji: "🧱",
    desc: "-2 % sur le coût des bâtiments par niveau (max -30 %).",
    maxLevel: 15, // borné: une réduction de 100 % rendrait tout gratuit
    cost: (lvl) => 3 + lvl * 3,
    effect: { type: "cost_reduction", perLevel: 0.02, cap: 0.3 },
  },
  {
    id: "head_start",
    name: "Départ lancé",
    emoji: "🚀",
    desc: "Après un prestige, repars avec 3 % de ta production totale par niveau (max 30 %).",
    // Exprimé en fraction et non en valeur absolue: un ×10 par niveau sans
    // limite aurait fini par offrir plus de cookies que la partie entière.
    maxLevel: 10,
    cost: (lvl) => Math.ceil(2 + lvl * 4 + Math.pow(lvl, 1.8) * 0.6),
    effect: { type: "start_fraction", perLevel: 0.03, cap: 0.3 },
  },
  {
    id: "night_shift",
    name: "Équipe de nuit",
    emoji: "🌙",
    desc: "+15 % de rendement hors-ligne par niveau.",
    maxLevel: Infinity,
    cost: (lvl) => Math.ceil(2 + lvl * 3 + Math.pow(lvl, 1.6) * 0.5),
    effect: { type: "offline_mult", perLevel: 0.15 },
  },
  {
    id: "lucky_star",
    name: "Étoile chanceuse",
    emoji: "⭐",
    desc: "Cookies dorés 10 % plus fréquents par niveau.",
    maxLevel: 25, // borné: au-delà les dorés deviendraient permanents
    cost: (lvl) => 3 + lvl * 3,
    effect: { type: "golden_rate", perLevel: 0.1 },
  },
  {
    id: "crypto_edge",
    name: "Avantage crypto",
    emoji: "🪙",
    desc: "+20 % de rendement de minage et de staking par niveau.",
    maxLevel: Infinity,
    cost: (lvl) => Math.ceil(4 + lvl * 4 + Math.pow(lvl, 1.7) * 0.7),
    effect: { type: "crypto_mult", perLevel: 0.2 },
  },
  {
    id: "quest_master",
    name: "Maître des quêtes",
    emoji: "📜",
    desc: "+25 % sur les récompenses de quête par niveau.",
    maxLevel: Infinity,
    cost: (lvl) => Math.ceil(3 + lvl * 4 + Math.pow(lvl, 1.7) * 0.6),
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
  const goldenLevels = Math.min(25, lvl("lucky_star"));

  return {
    cpsMult: 1 + lvl("celestial_dough") * e.celestial_dough.effect.perLevel,
    cpcMult: 1 + lvl("golden_fingers") * e.golden_fingers.effect.perLevel,
    costMult: 1 - costReduction,
    startFraction: Math.min(e.head_start.effect.cap, lvl("head_start") * e.head_start.effect.perLevel),
    offlineMult: 1 + lvl("night_shift") * e.night_shift.effect.perLevel,
    goldenRate: 1 + goldenLevels * e.lucky_star.effect.perLevel,
    cryptoMult: 1 + lvl("crypto_edge") * e.crypto_edge.effect.perLevel,
    questMult: 1 + lvl("quest_master") * e.quest_master.effect.perLevel,
  };
}

/** Chips que rapporterait un prestige immédiat. */
export const chipsFor = (lifetime) => Math.floor(Math.sqrt(Math.max(0, lifetime) / 1_000_000));

/** Seuil minimal pour que le prestige soit proposé. */
export const PRESTIGE_MIN_LIFETIME = 1_000_000;
