// Missions déclaratives: une mission active à la fois
// Chaque mission a: id, title, desc, check(state) -> {progress, target, done}, reward(state, setState)

export const MISSIONS = [
  {
    id: "reach_500",
    title: "Atteindre 500 cookies",
    desc: "Accumule 500 cookies en banque.",
    check: (s) => ({ progress: Math.min(s.cookies, 500), target: 500, done: s.cookies >= 500 }),
    reward: (s, setState, toast) => {
      const seconds = 15;
      const label = `MISSION +50% CPS`;
      setState((st) => ({ ...st, buffs: { ...st.buffs, cpsMulti: (st.buffs.cpsMulti || 1) * 1.5, until: Date.now() + seconds * 1000, label } }));
      toast(`Mission accomplie: +50% CPS pendant ${seconds}s`, "success");
    },
  },
  {
    id: "buy_5_oven",
    title: "Acheter 5 Fours",
    desc: "Investis dans 5 Fours pour doper le CPS.",
    check: (s) => ({ progress: Math.min(s.items.oven || 0, 5), target: 5, done: (s.items.oven || 0) >= 5 }),
    reward: (s, setState, toast) => {
      const seconds = 12;
      const label = `MISSION +30% CPC`;
      setState((st) => ({ ...st, buffs: { ...st.buffs, cpcMulti: (st.buffs.cpcMulti || 1) * 1.3, until: Date.now() + seconds * 1000, label } }));
      toast(`Mission accomplie: +30% CPC pendant ${seconds}s`, "success");
    },
  },
  {
    id: "3_golden",
    title: "Gagner 3 cookies dorés",
    desc: "Clique 3 cookies dorés.",
    check: (s) => ({ progress: Math.min(s.stats.goldenClicks || 0, 3), target: 3, done: (s.stats.goldenClicks || 0) >= 3 }),
    reward: (s, setState, toast) => {
      const seconds = 20;
      setState((st) => ({ ...st, flags: { ...st.flags, discountAll: { value: 0.15, until: Date.now() + seconds * 1000 } } }));
      toast(`Mission accomplie: -15% sur tous les achats pendant ${seconds}s`, "success");
    },
  },
];

export function getInitialMission() {
  return { id: MISSIONS[0].id, startedAt: Date.now(), completed: false };
}

export function nextMissionId(currentId) {
  const idx = MISSIONS.findIndex((m) => m.id === currentId);
  const nxt = MISSIONS[(idx + 1) % MISSIONS.length];
  return nxt.id;
}


