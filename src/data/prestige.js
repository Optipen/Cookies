// === Arbre céleste ===
// Améliorations permanentes achetées avec les chips de prestige.
// Elles survivent à tous les prestiges suivants.

export const PRESTIGE_UPGRADES = [
  {
    id: "celestial_dough",
    name: "Pâte céleste",
    emoji: "☁️",
    desc: "+5 % de production par niveau.",
    maxLevel: 20,
    cost: (lvl) => 1 + lvl * 2,
    effect: { type: "cps_mult", perLevel: 0.05 },
  },
  {
    id: "golden_fingers",
    name: "Doigts d'or",
    emoji: "🖐️",
    desc: "+8 % de puissance de clic par niveau.",
    maxLevel: 20,
    cost: (lvl) => 1 + lvl * 2,
    effect: { type: "cpc_mult", perLevel: 0.08 },
  },
  {
    id: "cheap_bricks",
    name: "Briques bon marché",
    emoji: "🧱",
    desc: "-2 % sur le coût des bâtiments par niveau (max -30 %).",
    maxLevel: 15,
    cost: (lvl) => 3 + lvl * 3,
    effect: { type: "cost_reduction", perLevel: 0.02, cap: 0.3 },
  },
  {
    id: "head_start",
    name: "Départ lancé",
    emoji: "🚀",
    desc: "Après un prestige, démarre avec des cookies (×10 par niveau).",
    maxLevel: 10,
    cost: (lvl) => 2 + lvl * 4,
    effect: { type: "start_cookies", perLevel: 1000, exponent: 10 },
  },
  {
    id: "night_shift",
    name: "Équipe de nuit",
    emoji: "🌙",
    desc: "+15 % de rendement hors-ligne par niveau.",
    maxLevel: 10,
    cost: (lvl) => 2 + lvl * 3,
    effect: { type: "offline_mult", perLevel: 0.15 },
  },
  {
    id: "lucky_star",
    name: "Étoile chanceuse",
    emoji: "⭐",
    desc: "Cookies dorés 10 % plus fréquents par niveau.",
    maxLevel: 10,
    cost: (lvl) => 3 + lvl * 3,
    effect: { type: "golden_rate", perLevel: 0.1 },
  },
  {
    id: "crypto_edge",
    name: "Avantage crypto",
    emoji: "🪙",
    desc: "+20 % de rendement de minage et de staking par niveau.",
    maxLevel: 10,
    cost: (lvl) => 4 + lvl * 4,
    effect: { type: "crypto_mult", perLevel: 0.2 },
  },
  {
    id: "quest_master",
    name: "Maître des quêtes",
    emoji: "📜",
    desc: "+25 % sur les récompenses de quête par niveau.",
    maxLevel: 8,
    cost: (lvl) => 3 + lvl * 4,
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

  return {
    cpsMult: 1 + lvl("celestial_dough") * e.celestial_dough.effect.perLevel,
    cpcMult: 1 + lvl("golden_fingers") * e.golden_fingers.effect.perLevel,
    costMult: 1 - costReduction,
    startCookies: lvl("head_start") > 0 ? 1000 * Math.pow(10, lvl("head_start") - 1) : 0,
    offlineMult: 1 + lvl("night_shift") * e.night_shift.effect.perLevel,
    goldenRate: 1 + lvl("lucky_star") * e.lucky_star.effect.perLevel,
    cryptoMult: 1 + lvl("crypto_edge") * e.crypto_edge.effect.perLevel,
    questMult: 1 + lvl("quest_master") * e.quest_master.effect.perLevel,
  };
}

/** Chips que rapporterait un prestige immédiat. */
export const chipsFor = (lifetime) => Math.floor(Math.sqrt(Math.max(0, lifetime) / 1_000_000));

/** Seuil minimal pour que le prestige soit proposé. */
export const PRESTIGE_MIN_LIFETIME = 1_000_000;
