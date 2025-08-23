export const UPGRADES = [
  // Paliers multiplicateur (CPC)
  { id: "cursor_10",   name: "Curseur huilé",        target: "cursor",  type: "mult", value: 2.0, cost: 320,     unlock: (s) => (s.items.cursor  || 0) >= 10 },
  { id: "cursor_25",   name: "Macro-clics",          target: "cursor",  type: "mult", value: 2.0, cost: 5200,    unlock: (s) => (s.items.cursor  || 0) >= 25 },
  { id: "grandma_10",  name: "Thé vert turbo",       target: "grandma", type: "mult", value: 2.0, cost: 4800,    unlock: (s) => (s.items.grandma || 0) >= 10 },
  { id: "farmm_10",    name: "Engrais au chocolat",  target: "farm",    type: "mult", value: 2.0, cost: 38000,   unlock: (s) => (s.items.farm    || 0) >= 10 },

  // Paliers CPS (production)
  { id: "oven_10",     name: "Pierre réfractaire",   target: "oven",        type: "mult", value: 2.0, cost: 600,      unlock: (s) => (s.items.oven        || 0) >= 10 },
  { id: "bakery_10",   name: "Levain ancien",        target: "bakery",      type: "mult", value: 2.0, cost: 5000,     unlock: (s) => (s.items.bakery      || 0) >= 10 },
  { id: "farmcps_10",  name: "Irrigation goutte-à-goutte", target: "farm_cps",    type: "mult", value: 2.0, cost: 50000,    unlock: (s) => (s.items.farm_cps    || 0) >= 10 },
  { id: "factorycps_10",name: "Chaîne optimisée",    target: "factory_cps", type: "mult", value: 2.0, cost: 600000,   unlock: (s) => (s.items.factory_cps || 0) >= 10 },

  // Global nerfé (rare)
  { id: "global_s",   name: "Levure quantique",      target: "all",    type: "mult", value: 1.1, cost: 260000, unlock: (s) => s.lifetime >= 50000 },

  // Upgrades CPC spécifiques (faibles, cap logiciels séparés si besoin)
  { id: "cpc_1",      name: "Souris nitro",          target: "cpc",    type: "mult", value: 1.3, cost: 6200,   unlock: (s) => s.stats.clicks >= 100 },
];
