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

// --- Micro missions ---
export const MICRO_MISSIONS = [
  {
    id: "collect_250_gain",
    title: "Récolte rapide",
    desc: "Récolte 250 cookies (gagnés depuis le début de la mission).",
    start: (s) => ({ lifetimeAtStart: s.lifetime || 0 }),
    checkDelta: (s, meta) => {
      const gained = Math.max(0, (s.lifetime || 0) - (meta?.lifetimeAtStart || 0));
      return { progress: Math.min(gained, 250), target: 250, done: gained >= 250 };
    },
    reward: (s) => ({ type: "buff", kind: "cpc", value: 1.2, seconds: 30, label: "+20% CPC" }),
  },
  {
    id: "cursor_3",
    title: "Mini‑atelier",
    desc: "Achète 3 Curseurs pour renforcer le clic.",
    check: (s) => ({ progress: Math.min(s.items.cursor || 0, 3), target: 3, done: (s.items.cursor || 0) >= 3 }),
    reward: (s) => ({ type: "discount", value: 0.10, seconds: 20, label: "-10% coûts" }),
  },
  {
    id: "auto_1",
    title: "Première chaîne auto",
    desc: "Achète 1 bâtiment de production passive.",
    start: (s) => ({ cpsOwnedStart: Object.entries(s.items || {}).reduce((a,[k,v])=>a+((/cps$|oven|bakery|factory_cps|farm_cps|bank_cps|temple|lab|portal/).test(k)?(v||0):0),0) }),
    checkDelta: (s, meta) => {
      const now = Object.entries(s.items || {}).reduce((a,[k,v])=>a+((/cps$|oven|bakery|factory_cps|farm_cps|bank_cps|temple|lab|portal/).test(k)?(v||0):0),0);
      const diff = now - (meta?.cpsOwnedStart || 0);
      return { progress: Math.min(Math.max(0,diff), 1), target: 1, done: diff >= 1 };
    },
    reward: (s) => ({ type: "buff", kind: "cps", value: 1.15, seconds: 25, label: "+15% CPS" }),
  },
  {
    id: "50_clicks_30s",
    title: "Sprint éclair",
    desc: "Réalise 50 clics en 30 secondes.",
    start: (s) => ({ clicksAtStart: s.stats.clicks || 0, until: Date.now() + 30000 }),
    checkTimed: (s, meta) => {
      const clicks = (s.stats.clicks || 0) - (meta?.clicksAtStart || 0);
      const left = Math.max(0, (meta?.until || 0) - Date.now());
      return { progress: Math.min(clicks, 50), target: 50, done: clicks >= 50 || left === 0, left };
    },
    reward: (s) => ({ type: "buff", kind: "cps", value: 1.2, seconds: 20, label: "+20% CPS" }),
  },
  {
    id: "golden_1",
    title: "Coup d’éclat",
    desc: "Clique 1 cookie doré.",
    start: (s) => ({ goldenAtStart: s.stats.goldenClicks || 0 }),
    checkDelta: (s, meta) => {
      const diff = (s.stats.goldenClicks || 0) - (meta?.goldenAtStart || 0);
      return { progress: Math.min(Math.max(0,diff), 1), target: 1, done: diff >= 1 };
    },
    reward: (s) => ({ type: "discount", value: 0.15, seconds: 15, label: "-15% coûts" }),
  },
];



