export const ACHIEVEMENTS = [
  { id: "firstClick", name: "Premier croc", desc: "Ton premier clic !", cond: (s) => s.stats.clicks >= 1 },
  { id: "tenClicks", name: "Ça clique sec", desc: "10 clics.", cond: (s) => s.stats.clicks >= 10 },
  { id: "hundredClicks", name: "Cliqueur fou", desc: "100 clics.", cond: (s) => s.stats.clicks >= 100 },
  { id: "1kBank", name: "Petit pécule", desc: "1 000 en banque.", cond: (s) => s.cookies >= 1_000 },
  { id: "1mBank", name: "Ça pèse", desc: "1 000 000 en banque.", cond: (s) => s.cookies >= 1_000_000 },
  { id: "10grandmas", name: "Thé de 17h", desc: "10 mamies.", cond: (s) => (s.items.grandma || 0) >= 10 },
  { id: "50cursor", name: "Octopus", desc: "50 curseurs.", cond: (s) => (s.items.cursor || 0) >= 50 },
  { id: "offline", name: "Rentier", desc: "Gagner hors-ligne.", cond: (s) => s.flags.offlineCollected },
];
