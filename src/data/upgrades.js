export const UPGRADES = [
  { id: "cursorx2", name: "Curseurs renforcés", target: "cursor", type: "mult", value: 2, cost: 320, unlock: (s) => (s.items.cursor || 0) >= 10 },
  { id: "cursorx4", name: "Macro-clics", target: "cursor", type: "mult", value: 2, cost: 5200, unlock: (s) => (s.items.cursor || 0) >= 25 },
  { id: "grandmax2", name: "Thé vert turbo", target: "grandma", type: "mult", value: 2, cost: 4800, unlock: (s) => (s.items.grandma || 0) >= 10 },
  { id: "farmx2", name: "Engrais au chocolat", target: "farm", type: "mult", value: 2, cost: 38000, unlock: (s) => (s.items.farm || 0) >= 10 },
  { id: "global1", name: "Levure quantique", target: "all", type: "mult", value: 1.25, cost: 260000, unlock: (s) => s.lifetime >= 50000 },
  { id: "cpc1", name: "Souris nitro", target: "cpc", type: "mult", value: 1.6, cost: 6200, unlock: (s) => s.stats.clicks >= 100 },
  // Mega upgrades (wow-moment)
  { id: "omega1", name: "Catalyseur cosmique", target: "all", type: "mult", value: 2, cost: 2_500_000, unlock: (s) => (s.items.factory||0) >= 25 },
  { id: "omega2", name: "Four stellaire", target: "all", type: "mult", value: 2.5, cost: 25_000_000, unlock: (s) => (s.items.tm||0) >= 10 },
];
