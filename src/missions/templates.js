// Registre minimal de templates adaptatifs pour micro‑missions
// Chaque template: id, tags, eligible(s, ctx), target(s, ctx), progress(s, meta), reward(s, ctx), score(s, ctx)

export const MICRO_TEMPLATES = [
  {
    id: "buy_affordable_building",
    tags: ["achat","cps"],
    eligible: (s, ctx) => !!ctx.nextAffordable && ctx.level !== "late_broke",
    target: (s, ctx) => ({ itemId: ctx.nextAffordable.id, qty: ctx.level === "early" ? 1 : 3 }),
    start: (s, meta) => ({ base: (s.items[meta.itemId] || 0) }),
    progress: (s, meta) => {
      const ownedNow = (s.items[meta.itemId] || 0);
      return { progress: Math.max(0, ownedNow - (meta.base || 0)), target: meta.qty, done: ownedNow - (meta.base || 0) >= meta.qty };
    },
    reward: (s, ctx) => ({ type: "buff", kind: "cps", value: ctx.level === "early" ? 1.2 : ctx.level === "mid" ? 1.35 : 1.5, seconds: ctx.level === "early" ? 20 : ctx.level === "mid" ? 15 : 12, label: "+CPS" }),
    score: (s, ctx) => 0.6 + (ctx.affordScore || 0) * 0.4
  },
  {
    id: "gain_bank_fraction",
    tags: ["gain"],
    eligible: (s, ctx) => (s.cookies || 0) > 50,
    target: (s, ctx) => ({ amount: Math.max(50, Math.round(ctx.bank * (ctx.level === "early" ? 0.4 : 0.6))), bankAtStart: s.cookies }),
    progress: (s, meta) => {
      const gained = (s.cookies || 0) - (meta.bankAtStart || 0);
      const tgt = meta.amount || 100;
      return { progress: Math.min(gained, tgt), target: tgt, done: gained >= tgt };
    },
    reward: (s, ctx) => ({ type: "discount", value: ctx.level === "late" ? 0.2 : 0.15, seconds: 20, label: "-coûts" }),
    score: (s, ctx) => 0.5 + Math.min(0.5, (ctx.bank || 0) / 1e6)
  },
  {
    id: "clicks_burst",
    tags: ["clic"],
    eligible: (s, ctx) => true,
    target: (s, ctx) => ({ 
      clicks: ctx.level === 'early' ? 50 : (ctx.level === 'mid' ? 80 : 120), 
      clicksAtStart: s.stats.clicks || 0, 
      until: Date.now() + (ctx.level === 'early' ? 30000 : 40000),
      timed: true
    }),
    progress: (s, meta) => {
      const diff = (s.stats.clicks || 0) - (meta.clicksAtStart || 0);
      const tgt = meta.clicks;
      const left = Math.max(0, (meta.until || 0) - Date.now());
      return { progress: Math.min(Math.max(0, diff), tgt), target: tgt, done: diff >= tgt || left === 0, timeLeft: left };
    },
    reward: (s, ctx) => ({ type: "buff", kind: "cpc", value: ctx.level === 'early' ? 1.2 : ctx.level === 'mid' ? 1.3 : 1.4, seconds: ctx.level === 'early' ? 25 : 20, label: "+CPC" }),
    score: (s, ctx) => (ctx.level === 'early' ? 0.7 : 0.4)
  },
];

// Squelette de templates pour missions principales (progression plus longue)
export const MAIN_TEMPLATES = [
  {
    id: "reach_bank_dynamic",
    tags: ["gain","bank"],
    eligible: (s, ctx) => true,
    target: (s, ctx) => ({ amount: Math.max(500, Math.round(ctx.bank * (ctx.level === 'early' ? 2.5 : ctx.level === 'mid' ? 1.8 : 1.4))), bankAtStart: s.cookies }),
    progress: (s, meta) => {
      const gained = (s.cookies || 0) - (meta.bankAtStart || 0);
      const tgt = meta.amount;
      return { progress: Math.min(Math.max(0, gained), tgt), target: tgt, done: (s.cookies || 0) >= (meta.bankAtStart || 0) + tgt };
    },
    reward: (s, ctx) => ({ type: 'buff', kind: 'cps', value: ctx.level === 'early' ? 1.5 : ctx.level === 'mid' ? 1.35 : 1.3, seconds: 25, label: '+CPS' }),
    score: (s, ctx) => 0.6,
    label: (meta) => ({ title: `Atteindre +${meta.amount} cookies`, desc: `Fais croître ta banque de ${meta.amount} cookies` })
  },
  {
    id: "reach_cps_milestone",
    tags: ["cps","milestone"],
    eligible: (s, ctx) => ctx.cps > 0,
    target: (s, ctx) => {
      const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
      const next = steps.find(x => x > ctx.cps) || Math.ceil(ctx.cps * 1.3);
      return { cpsTarget: next };
    },
    progress: (s, meta, ctx) => {
      const cur = ctx?.cps ?? 0;
      const tgt = meta.cpsTarget || 0;
      return { progress: Math.min(cur, tgt), target: tgt, done: cur >= tgt };
    },
    reward: (s, ctx) => ({ type: 'discount', value: ctx.level === 'late' ? 0.2 : 0.15, seconds: 25, label: '-coûts' }),
    score: (s, ctx) => 0.55,
    label: (meta) => ({ title: `Atteindre ${meta.cpsTarget} CPS`, desc: `Monte ton CPS jusqu'à ${meta.cpsTarget}` })
  }
];



