import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// === Utils ===
const fmt = (n) => {
  if (!isFinite(n)) return "∞";
  const suf = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  let i = 0;
  while (n >= 1000 && i < suf.length - 1) { n /= 1000; i++; }
  return (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + suf[i];
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// === Game Data ===
const ITEMS = [
  { id: "cursor", name: "Curseur", emoji: "🖱️", base: 18, growth: 1.15, cps: 0.22, desc: "Clique automatiquement à petits pas." },
  { id: "grandma", name: "Mamie", emoji: "👵", base: 140, growth: 1.15, cps: 1.8, desc: "Cuit des cookies maison." },
  { id: "farm", name: "Ferme", emoji: "🌾", base: 1400, growth: 1.16, cps: 14, desc: "Culture intensive de cookies." },
  { id: "factory", name: "Usine", emoji: "🏭", base: 16000, growth: 1.17, cps: 72, desc: "Production industrielle." },
  { id: "bank", name: "Banque", emoji: "🏦", base: 180000, growth: 1.18, cps: 360, desc: "Intérêts en cookies." },
  { id: "ai", name: "IA Boulangerie", emoji: "🤖", base: 2200000, growth: 1.19, cps: 1800, desc: "Réseaux de neurones pâtissiers." },
  { id: "tm", name: "Machine à Temps", emoji: "⌛", base: 32000000, growth: 1.21, cps: 9800, desc: "Cuisson avant même d'avoir faim." },
];

// Upgrades (inclut 2 mégas très chères)
const UPGRADES = [
  { id: "cursorx2", name: "Curseurs renforcés", target: "cursor", type: "mult", value: 2, cost: 320, unlock: (s) => (s.items.cursor || 0) >= 10 },
  { id: "cursorx4", name: "Macro‑clics", target: "cursor", type: "mult", value: 2, cost: 5200, unlock: (s) => (s.items.cursor || 0) >= 25 },
  { id: "grandmax2", name: "Thé vert turbo", target: "grandma", type: "mult", value: 2, cost: 4800, unlock: (s) => (s.items.grandma || 0) >= 10 },
  { id: "farmx2", name: "Engrais au chocolat", target: "farm", type: "mult", value: 2, cost: 38000, unlock: (s) => (s.items.farm || 0) >= 10 },
  { id: "global1", name: "Levure quantique", target: "all", type: "mult", value: 1.25, cost: 260000, unlock: (s) => s.lifetime >= 50000 },
  { id: "cpc1", name: "Souris nitro", target: "cpc", type: "mult", value: 1.6, cost: 6200, unlock: (s) => s.stats.clicks >= 100 },
  // Mega upgrades (wow-moment)
  { id: "omega1", name: "Catalyseur cosmique", target: "all", type: "mult", value: 2, cost: 2_500_000, unlock: (s) => (s.items.factory||0) >= 25 },
  { id: "omega2", name: "Four stellaire", target: "all", type: "mult", value: 2.5, cost: 25_000_000, unlock: (s) => (s.items.tm||0) >= 10 },
];

const ACHIEVEMENTS = [
  { id: "firstClick", name: "Premier croc", desc: "Ton premier clic !", cond: (s) => s.stats.clicks >= 1 },
  { id: "tenClicks", name: "Ça clique sec", desc: "10 clics.", cond: (s) => s.stats.clicks >= 10 },
  { id: "hundredClicks", name: "Cliqueur fou", desc: "100 clics.", cond: (s) => s.stats.clicks >= 100 },
  { id: "1kBank", name: "Petit pécule", desc: "1 000 en banque.", cond: (s) => s.cookies >= 1_000 },
  { id: "1mBank", name: "Ça pèse", desc: "1 000 000 en banque.", cond: (s) => s.cookies >= 1_000_000 },
  { id: "10grandmas", name: "Thé de 17h", desc: "10 mamies.", cond: (s) => (s.items.grandma || 0) >= 10 },
  { id: "50cursor", name: "Octopus", desc: "50 curseurs.", cond: (s) => (s.items.cursor || 0) >= 50 },
  { id: "offline", name: "Rentier", desc: "Gagner hors‑ligne.", cond: (s) => s.flags.offlineCollected },
];

const DEFAULT_STATE = {
  version: 4,
  cookies: 0,
  lifetime: 0,
  cpcBase: 1,
  items: {},
  upgrades: {},
  lastTs: Date.now(),
  stats: { clicks: 0, lastPurchaseTs: Date.now() },
  flags: { offlineCollected: false, flash: null, cryptoFlashUntil: 0 },
  buffs: { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" },
  combo: { value: 1, lastClickTs: 0, lastRushTs: 0 },
  prestige: { chips: 0 },
  ui: { sounds: true, introSeen: false },
  toasts: [],
  unlocked: {},
  fx: { banner: null, shakeUntil: 0 },
  crypto: { name: "CrumbCoin", symbol: "CRMB", balance: 0, staked: 0, mintedUnits: 0, perCookies: 20000, perAmount: 0.001 },
};

const SAVE_KEY = "cookieCrazeSaveV4";
const PENDING_RESET_KEY = "cookieCrazePendingReset";

const useAudio = (enabled) => {
  const ctxRef = useRef(null);
  const ping = (freq = 520, time = 0.05) => {
    if (!enabled) return;
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current; const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = freq; g.gain.value = 0.07;
      o.connect(g); g.connect(ctx.destination); o.start();
      setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time); o.stop(ctx.currentTime + time); }, time * 800);
    } catch {}
  };
  return { ping };
};

// === Component ===
export default function CookieCraze() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem("cookieCrazeSaveV3") || localStorage.getItem("cookieCrazeSaveV2") || localStorage.getItem("cookieCrazeSaveV1");
      if (raw) return migrate(JSON.parse(raw));
    } catch {}
    return { ...DEFAULT_STATE };
  });
  const { ping } = useAudio(state.ui.sounds);
  const [viewKey, setViewKey] = useState(0); // force remount on reset

  const cookieField = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 32 + 24,
        delay: Math.random() * 5,
        duration: Math.random() * 10 + 10,
      })),
    []
  );

  // --- Helpers for CPS recompute (NO stale closure) ---
  const computePerItemMult = (items, upgrades) => {
    const mult = {}; ITEMS.forEach((it) => (mult[it.id] = 1));
    for (const id in (upgrades || {})) {
      if (!upgrades[id]) continue; const up = UPGRADES.find((u) => u.id === id); if (!up) continue;
      if (up.type === "mult") {
        if (up.target === "all") ITEMS.forEach((it) => (mult[it.id] *= up.value));
        else if (up.target in mult) mult[up.target] *= up.value;
      }
    }
    // Synergies
    const g = (items.grandma || 0), f = (items.farm || 0), fac = (items.factory || 0);
    mult.cursor *= 1 + 0.01 * g; // +1%/mamie
    mult.grandma *= 1 + 0.005 * f; // +0,5%/ferme
    mult.farm *= 1 + 0.002 * fac; // +0,2%/usine
    return mult;
  };
  const cpsFrom = (items, upgrades, chips, stakeMulti = 1) => {
    const mult = computePerItemMult(items, upgrades);
    let cps = 0; for (const it of ITEMS) cps += (items[it.id] || 0) * it.cps * (mult[it.id] || 1);
    return cps * (1 + (chips || 0) * 0.02) * stakeMulti;
  };

  // --- Multipliers (memo for live view) ---
  const prestigeMulti = useMemo(() => 1 + state.prestige.chips * 0.02, [state.prestige.chips]);
  const stakeMulti = useMemo(() => 1 + (state.crypto.staked || 0) * 0.5, [state.crypto.staked]);
  const perItemMult = useMemo(() => computePerItemMult(state.items, state.upgrades), [state.upgrades, state.items]);
  const cpcMultFromUpgrades = useMemo(() => { let m = 1; for (const id in state.upgrades) { const up = UPGRADES.find((u) => u.id === id); if (up && state.upgrades[id] && up.target === "cpc" && up.type === "mult") m *= up.value; } return m; }, [state.upgrades]);
  const baseCpsNoBuff = useMemo(() => cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeMulti), [state.items, state.upgrades, state.prestige.chips, stakeMulti]);

  const cpsWithBuff = useMemo(() => baseCpsNoBuff * (Date.now() < state.buffs.until ? state.buffs.cpsMulti : 1), [baseCpsNoBuff, state.buffs]);
  const cpc = useMemo(() => (state.cpcBase * (Date.now() < state.buffs.until ? state.buffs.cpcMulti : 1) * prestigeMulti * stakeMulti * state.combo.value * cpcMultFromUpgrades), [state.cpcBase, state.buffs, prestigeMulti, stakeMulti, state.combo.value, cpcMultFromUpgrades]);

  // Save
  useEffect(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }, [state]);

  // Main loop 100ms (uses ONLY s.* so reset works)
  useEffect(() => {
    const iv = setInterval(() => {
      setState((s) => {
        const now = Date.now();
        const stakeM = 1 + (s.crypto?.staked || 0) * 0.5;
        const cpsNow = cpsFrom(s.items, s.upgrades, s.prestige.chips, stakeM) * (Date.now() < s.buffs.until ? s.buffs.cpsMulti : 1);
        let cookies = s.cookies + cpsNow / 10;
        let lifetime = s.lifetime + cpsNow / 10;
        // Crypto faucet (0.001 CRMB / 20k cookies cuits)
        let crypto = { ...s.crypto };
        let flags = { ...s.flags };
        const units = Math.floor(lifetime / crypto.perCookies);
        if (units > crypto.mintedUnits) {
          const diff = units - crypto.mintedUnits;
          crypto.mintedUnits = units;
          crypto.balance = Number((crypto.balance + diff * crypto.perAmount).toFixed(6));
          flags.cryptoFlashUntil = now + 1500;
        }
        // Combo decay
        let combo = { ...s.combo };
        if (combo.value > 1 && now - combo.lastClickTs > 900) combo.value = Math.max(1, combo.value - 0.25);
        // Rush auto si combo >=5 (cooldown 20s)
        let buffs = { ...s.buffs };
        if (combo.value >= 5 && now - combo.lastRushTs > 20000) {
          combo.lastRushTs = now; buffs = { ...buffs, cpcMulti: 2, until: now + 6000, label: "RUSH x2 CPC" };
        }
        // Buff expiry
        if (buffs.until && now >= buffs.until) buffs = { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" };
        return { ...s, cookies, lifetime, combo, buffs, crypto, flags };
      });
    }, 100);
    return () => clearInterval(iv);
  }, []);

  // Intro gate + offline progress + schedulers
  useEffect(() => {
    // Applique un reset différé (si rechargé après reset)
    try {
      const raw = sessionStorage.getItem(PENDING_RESET_KEY);
      if (raw) {
        const { preserve, prestige, sounds } = JSON.parse(raw);
        sessionStorage.removeItem(PENDING_RESET_KEY);
        setState(() => ({
          ...DEFAULT_STATE,
          prestige: preserve ? { chips: prestige || 0 } : { chips: 0 },
          ui: { sounds: !!sounds, introSeen: false },
        }));
        setViewKey((k) => k + 1);
      }
    } catch {}

    const now = Date.now();
    const dt = Math.max(0, (now - state.lastTs) / 1000);
    if (dt > 3) {
      const stakeM = 1 + (state.crypto?.staked || 0) * 0.5;
      const offlineGain = cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeM) * dt * 0.5;
      if (offlineGain > 0) toast(`+${fmt(offlineGain)} cookies gagnés hors‑ligne`, "info");
      setState((s) => ({ ...s, cookies: s.cookies + offlineGain, lifetime: s.lifetime + offlineGain, flags: { ...s.flags, offlineCollected: true } }));
    }
    scheduleGolden();
    scheduleRain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (!state.ui.introSeen && (e.key === 'Enter' || e.key === ' ')) skipIntro(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.ui.introSeen]);

  // Track timestamp for offline Save
  useEffect(() => {
    const h = () => setState((s) => ({ ...s, lastTs: Date.now() }));
    window.addEventListener("beforeunload", h);
    const iv = setInterval(h, 5000);
    return () => { window.removeEventListener("beforeunload", h); clearInterval(iv); };
  }, []);

  // Flash Sale scheduler (si pas d'achat depuis 60s)
  useEffect(() => {
    const iv = setInterval(() => {
      setState((s) => {
        const now = Date.now();
        const noSale = !s.flags.flash || now >= s.flags.flash.until;
        if (now - (s.stats.lastPurchaseTs || s.lastTs) > 60000 && noSale) {
          const pick = ITEMS[Math.floor(Math.random() * ITEMS.length)];
          return { ...s, flags: { ...s.flags, flash: { itemId: pick.id, discount: 0.25, until: now + 20000 } } };
        }
        return s;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  // Achievements checker
  useEffect(() => {
    setState((s) => {
      const newly = {};
      for (const a of ACHIEVEMENTS) { if (!s.unlocked[a.id] && a.cond(s)) newly[a.id] = true; }
      if (Object.keys(newly).length) {
        const id = Object.keys(newly)[0]; const ach = ACHIEVEMENTS.find((x) => x.id === id);
        if (ach) toast(`Succès: ${ach.name}`, "success");
        return { ...s, unlocked: { ...s.unlocked, ...newly } };
      }
      return s;
    });
  }, [state.cookies, state.items, state.stats.clicks, state.flags.offlineCollected]);

  // Toast helper
  const toast = (msg, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    setState((s) => ({ ...s, toasts: [...s.toasts, { id, msg, tone }] }));
    setTimeout(() => setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) })), 2800);
  };

  // Golden cookie
  const scheduleGolden = () => { const d = 20000 + Math.random() * 70000; setTimeout(() => setShowGolden(true), d); };
  const [showGolden, setShowGolden] = useState(false);
  const goldenRef = useRef({ left: "50%", top: "50%" });
  useEffect(() => {
    if (showGolden) {
      const area = document.getElementById("game-area");
      if (area) { const r = area.getBoundingClientRect(); const left = Math.random() * (r.width - 120) + 60; const top = Math.random() * (r.height - 200) + 120; goldenRef.current = { left: `${left}px`, top: `${top}px` }; }
      const hide = setTimeout(() => { setShowGolden(false); scheduleGolden(); }, 10000);
      return () => clearTimeout(hide);
    }
  }, [showGolden]);
  const onGoldenClick = () => {
    setShowGolden(false); scheduleGolden(); ping(880, 0.1);
    const roll = Math.random();
    if (roll < 0.35) { applyBuff({ cpsMulti: 7, cpcMulti: 1, seconds: 20, label: "FRENZY x7" }); toast("FRENZY: CPS x7 pendant 20s !", "success"); }
    else if (roll < 0.65) { applyBuff({ cpsMulti: 1, cpcMulti: 15, seconds: 12, label: "CLICK FRENZY x15" }); toast("CLICK FRENZY: CPC x15 pendant 12s !", "success"); }
    else if (roll < 0.85) {
      const stakeM = 1 + (state.crypto?.staked || 0) * 0.5;
      const bonus = Math.max(state.cookies * 0.15, cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeM) * 15);
      setState((s) => ({ ...s, cookies: s.cookies + bonus, lifetime: s.lifetime + bonus })); toast(`Lucky +${fmt(bonus)} !`, "success");
    }
    else { burstParticles(30); const bonus = cpc * 30; setState((s) => ({ ...s, cookies: s.cookies + bonus, lifetime: s.lifetime + bonus })); toast(`Pluie de miettes +${fmt(bonus)} !`, "success"); }
  };
  const applyBuff = ({ cpsMulti = 1, cpcMulti = 1, seconds = 10, label = "" }) => { const until = Date.now() + seconds * 1000; setState((s) => ({ ...s, buffs: { cpsMulti, cpcMulti, until, label } })); };

  // Cookie Rain (événement toutes ~2–4 min)
  const [rainCrumbs, setRainCrumbs] = useState([]);
  const [rainUntil, setRainUntil] = useState(0);
  const scheduleRain = () => { const d = 120000 + Math.random() * 120000; setTimeout(() => startRain(), d); };
  const startRain = () => {
    const until = Date.now() + 8000; setRainUntil(until);
    const area = document.getElementById("game-area"); const r = area?.getBoundingClientRect();
    const width = r ? r.width : window.innerWidth;
    const arr = Array.from({ length: 50 }).map(() => ({ id: Math.random().toString(36).slice(2), x: Math.random() * (width - 40) + 20, y: -20, vy: 2 + Math.random() * 3 }));
    setRainCrumbs(arr); setTimeout(() => { setRainCrumbs([]); scheduleRain(); }, 8000);
  };
  useEffect(() => {
    if (!rainCrumbs.length) return; const iv = setInterval(() => { setRainCrumbs((cc) => cc.map((c) => ({ ...c, y: c.y + c.vy * 3 })).filter((c) => c.y < window.innerHeight + 30)); }, 16);
    return () => clearInterval(iv);
  }, [rainCrumbs.length]);
  const onCrumbClick = (id) => { setRainCrumbs((cc) => cc.filter((c) => c.id !== id)); const gain = cpc * 3; setState((s) => ({ ...s, cookies: s.cookies + gain, lifetime: s.lifetime + gain })); ping(740, 0.05); };

  // --- Pricing: Bulk + Milestone steepening ---
  const milestoneFactor = (owned) => {
    let m = 1;
    if (owned >= 200) m *= 5.0;
    else if (owned >= 100) m *= 3.5;
    else if (owned >= 50) m *= 2.0;
    else if (owned >= 25) m *= 1.4;
    else if (owned >= 10) m *= 1.15;
    return m;
  };
  const bulkCost = (it, owned, count) => {
    const g = it.growth; const base = it.base;
    const series = (Math.pow(g, count) - 1) / (g - 1);
    let total = base * Math.pow(g, owned) * series;
    total *= milestoneFactor(owned); // price steepener for wow-feel
    return total;
  };

  // Purchase logic + Flash sale + Qty modifiers + Wow FX
  const costOf = (id, count) => {
    const it = ITEMS.find((x) => x.id === id); const owned = state.items[id] || 0; let price = bulkCost(it, owned, count);
    // Flash discount applies on total
    if (state.flags.flash && state.flags.flash.itemId === id && Date.now() < state.flags.flash.until) price *= (1 - state.flags.flash.discount);
    return Math.ceil(price);
  };
  const buy = (id, count = 1) => {
    const it = ITEMS.find((x) => x.id === id);
    const price = costOf(id, count);
    if (state.cookies < price) return toast("Pas assez de cookies…", "warn");

    // Wow-moment detection
    const ownedBefore = state.items[id] || 0;
    const willCross = [10, 25, 50, 100, 200].some((m) => ownedBefore < m && ownedBefore + count >= m);
    const stakeM = 1 + (state.crypto?.staked || 0) * 0.5;
    const cpsBefore = cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeM);
    const newItems = { ...state.items, [id]: ownedBefore + count };
    const cpsAfter = cpsFrom(newItems, state.upgrades, state.prestige.chips, stakeM);
    const deltaCps = cpsAfter - cpsBefore;
    const spentRatio = price / Math.max(1, state.cookies);
    const big = spentRatio >= 0.4 || willCross || deltaCps >= cpsBefore * 0.35;

    // Apply purchase
    ping(big ? 900 : 660, big ? 0.12 : 0.07);
    setState((s) => ({
      ...s,
      cookies: s.cookies - price,
      items: newItems,
      stats: { ...s.stats, lastPurchaseTs: Date.now() },
      flags: { ...s.flags, flash: null },
      fx: big ? { banner: { title: "MEGA ACHAT", sub: `+${fmt(deltaCps)} CPS (${((deltaCps/Math.max(1,cpsBefore))*100).toFixed(0)}%)`, until: Date.now() + 2400 }, shakeUntil: Date.now() + 900 } : s.fx,
      // purchase euphoria buff
      buffs: big ? { ...s.buffs, cpsMulti: 2.5, cpcMulti: s.buffs.cpcMulti, until: Date.now() + 8000, label: "EUPHORIA x2.5" } : s.buffs,
    }));
    if (big) burstParticles(40);
  };

  // Crypto stake/unstake
  const stake = (amt = 0.001) => {
    setState((s) => {
      if ((s.crypto.balance || 0) < amt) return s;
      const balance = Number((s.crypto.balance - amt).toFixed(6));
      const staked = Number(((s.crypto.staked || 0) + amt).toFixed(6));
      return { ...s, crypto: { ...s.crypto, balance, staked } };
    });
  };
  const unstake = (amt = 0.001) => {
    setState((s) => {
      if ((s.crypto.staked || 0) < amt) return s;
      const balance = Number((s.crypto.balance + amt).toFixed(6));
      const staked = Number(((s.crypto.staked || 0) - amt).toFixed(6));
      return { ...s, crypto: { ...s.crypto, balance, staked } };
    });
  };

  // Upgrades
  const canBuyUpgrade = (u) => !state.upgrades[u.id] && u.unlock(state);
  const buyUpgrade = (u) => {
    if (state.cookies < u.cost) return toast("Pas assez de cookies…", "warn");
    ping(700, 0.07);
    setState((s) => ({ ...s, cookies: s.cookies - u.cost, upgrades: { ...s.upgrades, [u.id]: true }, fx: { ...s.fx, banner: { title: "UPGRADE", sub: u.name, until: Date.now() + 2000 } } }));
    toast(`Upgrade: ${u.name}`, "success");
  };

  // Particles (clics)
  const [particles, setParticles] = useState([]);
  const mousePos = useRef({ x: 0, y: 0 });
  useEffect(() => { const onMove = (e) => { mousePos.current = { x: e.clientX, y: e.clientY }; }; window.addEventListener("mousemove", onMove); return () => window.removeEventListener("mousemove", onMove); }, []);
  const burstParticles = (n = 10, at = null) => {
    const base = at || mousePos.current;
    const arr = Array.from({ length: n }).map(() => ({ id: Math.random().toString(36).slice(2), x: base.x + (Math.random() - 0.5) * 80, y: base.y + (Math.random() - 0.5) * 80, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 2 - 1, life: 16 + Math.random() * 10, text: `+${fmt(cpc)}` }));
    setParticles((p) => [...p, ...arr]);
  };
  useEffect(() => { const iv = setInterval(() => { setParticles((pp) => pp.map((p) => ({ ...p, x: p.x + p.vx * 4, y: p.y + p.vy * 4, life: p.life - 1 })).filter((p) => p.life > 0)); }, 16); return () => clearInterval(iv); }, []);

  // Big cookie click
  const onCookieClick = () => {
    ping(520, 0.05);
    const now = Date.now();
    setState((s) => {
      let combo = { ...s.combo };
      if (now - combo.lastClickTs < 700) combo.value = clamp(combo.value + 0.15, 1, 10);
      combo.lastClickTs = now; const gain = cpc;
      return { ...s, cookies: s.cookies + gain, lifetime: s.lifetime + gain, stats: { ...s.stats, clicks: s.stats.clicks + 1 }, combo };
    });
    burstParticles(12);
  };

  // Prestige
  const potentialChips = Math.floor(Math.sqrt(state.lifetime / 1_000_000));
  const canPrestige = potentialChips > state.prestige.chips && state.cookies >= 100_000;
  const doPrestige = () => {
    if (!canPrestige) return;
    if (!confirm(`Prestige ? Tu gagneras ${potentialChips - state.prestige.chips} chips célestes (+2% prod/chip) et ta progression sera réinitialisée.`)) return;
    setState((s) => ({ ...DEFAULT_STATE, prestige: { chips: potentialChips }, ui: s.ui, toasts: [] }));
    toast("Re‑naissance céleste ✨", "success");
  };

  // Export / Import / Reset
  const exportSave = () => {
      const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "cookiecraze_save.json"; a.click();
      URL.revokeObjectURL(url);
  };
  const importSave = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // tentative JSON direct
        const data = migrate(JSON.parse(String(reader.result)));
        setState(data);
        toast("Sauvegarde importée.", "success");
      } catch {
        try {
          // fallback ancien format base64 .txt
          const txt = decodeURIComponent(escape(atob(String(reader.result))));
          const data = migrate(JSON.parse(txt));
          setState(data);
          toast("Ancienne sauvegarde importée.", "success");
        } catch {
          toast("Import invalide.", "warn");
        }
      }
    };
    reader.readAsText(file);
  };
  const hardReset = (e) => {
    const full = e && (e.altKey || e.metaKey);
    const preserve = !full;
    const chips = state.prestige?.chips || 0;
    const sounds = !!state.ui?.sounds;
    const msg = full
      ? "Réinitialisation TOTALE ? (prestige remis à zéro)"
      : "Réinitialiser la partie ? (prestige conservé)";

    const ok = typeof confirm === "function" ? confirm(msg) : true;
    if (!ok) return;

    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem("cookieCrazeSaveV3");
      localStorage.removeItem("cookieCrazeSaveV2");
      localStorage.removeItem("cookieCrazeSaveV1");
      sessionStorage.setItem(PENDING_RESET_KEY, JSON.stringify({ preserve, prestige: chips, sounds }));
    } catch {}

    // Nettoie les états visuels immédiats
    setShowGolden(false);
    setRainCrumbs([]);
    setRainUntil(0);
    setParticles([]);

    // Applique localement
    setState(() => (
      preserve
        ? { ...DEFAULT_STATE, prestige: { chips }, ui: { sounds, introSeen: false } }
        : { ...DEFAULT_STATE, prestige: { chips: 0 }, ui: { sounds, introSeen: false } }
    ));

    toast(preserve ? "Partie réinitialisée." : "Tout remis à zéro.", "success");

    // Force remount + reload safe
    setViewKey((k) => k + 1);
    try { setTimeout(() => window.location.reload(), 50); } catch {}
  };

  // UI helpers
  const ProgressBar = ({ value, label }) => (
    <div className="w-full bg-zinc-800 rounded-xl overflow-hidden shadow-inner">
      <div className="h-2 bg-amber-400" style={{ width: `${clamp(value, 0, 1) * 100}%` }}></div>
      {label && <div className="text-[10px] text-zinc-400 mt-1">{label}</div>}
    </div>
  );
  const buffTimeLeft = Math.max(0, state.buffs.until - Date.now());

  // Intro overlay controls
  const skipIntro = () => setState((s) => ({ ...s, ui: { ...s.ui, introSeen: true } }));

  // --- Render ---
  const shaking = Date.now() < state.fx.shakeUntil;
  const cryptoFlash = Date.now() < state.flags.cryptoFlashUntil;
  return (
    <div key={viewKey} id="game-area" className="min-h-screen w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 select-none overflow-hidden">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🍪</div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Cookie Craze — <span className="text-amber-300">Ultra Addictif</span></h1>
          </div>
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="px-2 py-1 rounded-full bg-zinc-800/70 border border-zinc-700">CPS: <b>{fmt(cpsWithBuff)}</b></span>
            <span className="px-2 py-1 rounded-full bg-zinc-800/70 border border-zinc-700">CPC: <b>{fmt(cpc)}</b></span>
            <span className="px-2 py-1 rounded-full bg-zinc-800/70 border border-zinc-700">Prestige: <b>{state.prestige.chips}</b></span>
            <span className={`px-2 py-1 rounded-full border ${cryptoFlash ? "bg-emerald-600/30 border-emerald-400/60" : "bg-zinc-800/70 border-zinc-700"}`}>CRMB: <b>{(state.crypto.balance || 0).toFixed(3)}</b></span>
          </div>
        </div>

        {/* Top Stats */}
        <div className={`mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 ${shaking ? "animate-[wiggle_0.7s_ease]" : ""}`}>
          <div className="md:col-span-2 rounded-2xl p-4 bg-zinc-900/60 border border-zinc-800 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400">Cookies en banque</div>
                <div className="text-3xl md:text-5xl font-extrabold tracking-tight text-amber-300 drop-shadow">{fmt(state.cookies)}</div>
                <div className="text-xs text-zinc-500">Cuits au total: {fmt(state.lifetime)}</div>
              </div>
              <div className="text-right space-y-2">
                {Date.now() < state.buffs.until && (
                  <div className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40">
                    Boost <b>{state.buffs.label}</b> · {(buffTimeLeft/1000).toFixed(0)}s
                  </div>
                )}
                {canPrestige && (
                  <button onClick={doPrestige} className="text-xs px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 transition border border-purple-400/50 shadow">Prestige +{potentialChips - state.prestige.chips}</button>
                )}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    aria-pressed={state.ui.sounds}
                    onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, sounds: !s.ui.sounds } }))}
                    className="text-xs px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700"
                  >
                    {state.ui.sounds ? "🔊 Sons ON" : "🔈 Sons OFF"}
                  </button>
                  <button onClick={exportSave} className="text-xs px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700">💾 Export</button>
                  <label className="text-xs px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer">📥 Import
                    <input type="file" accept=".json,.txt" className="hidden" onChange={(e) => e.target.files && importSave(e.target.files[0])} />
                  </label>
                  <button onClick={(e) => hardReset(e)} title="Astuce: Alt+clic = reset total" className="text-xs px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700">♻️ Reset</button>
                </div>
              </div>
            </div>

            {/* Big Cookie */}
<div className="mt-8 flex items-center justify-center relative">
  <motion.img
    src="/cookie.png"
    alt="Cookie"
    className="h-72 w-72 md:h-96 md:w-96 cursor-pointer select-none drop-shadow-xl"
    whileTap={{ scale: 0.92, rotate: -2 }}
    onClick={onCookieClick}
    draggable="false"
  />
  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-lg text-zinc-400">
    Combo x{state.combo.value.toFixed(2)}
  </div>
</div>
            
            {/* Particles */}
            <div className="pointer-events-none fixed left-0 top-0 w-full h-full">
              <AnimatePresence>
                {particles.map((p) => (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute text-amber-300 text-xs font-bold drop-shadow" style={{ left: p.x, top: p.y }}>{p.text}</motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Golden Cookie */}
            <AnimatePresence>
              {showGolden && (
                <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={onGoldenClick}
                  className="fixed z-20 h-16 w-16 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 border-4 border-yellow-200 shadow-xl" style={{ left: goldenRef.current.left, top: goldenRef.current.top }}>
                  <div className="absolute inset-0 rounded-full" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 40%)" }} />⭐
                </motion.button>
              )}
            </AnimatePresence>

            {/* Cookie Rain */}
            <AnimatePresence>
              {Date.now() < rainUntil && rainCrumbs.map((c) => (
                <motion.button key={c.id} onClick={() => onCrumbClick(c.id)} initial={{ scale: 0.6, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="fixed z-10 h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-200 shadow" style={{ left: c.x, top: c.y }}>🍪</motion.button>
              ))}
            </AnimatePresence>

            {/* Cinematic Banner */}
            <AnimatePresence>
              {state.fx.banner && Date.now() < state.fx.banner.until && (
                <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed left-1/2 top-24 -translate-x-1/2 z-30 px-5 py-3 rounded-2xl bg-amber-500/20 border border-amber-300/50 backdrop-blur text-amber-200 shadow-xl">
                  <div className="text-xs tracking-widest">{state.fx.banner.title}</div>
                  <div className="text-lg font-extrabold">{state.fx.banner.sub}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Shop */}
          <div className="rounded-2xl p-4 bg-zinc-900/60 border border-zinc-800 shadow-xl flex flex-col gap-3 max-h-[520px] md:max-h-[620px] overflow-auto">
            <div className="text-sm font-semibold text-zinc-300 flex items-center justify-between">
              <span>Boutique</span>
              <span className="text-[11px] text-zinc-500">Astuce: <b>Shift</b>=×10 · <b>Ctrl</b>=×100</span>
            </div>
            {ITEMS.map((it) => {
              const ownedCount = state.items[it.id] || 0;
              const singleBase = Math.ceil(it.base * Math.pow(it.growth, ownedCount));
              const onFlash = state.flags.flash && state.flags.flash.itemId === it.id && Date.now() < state.flags.flash.until;
              const price1 = costOf(it.id, 1);
              const affordable = state.cookies >= price1;
              return (
                <button key={it.id} onClick={(e) => buy(it.id, e.shiftKey ? 10 : e.ctrlKey ? 100 : 1)}
                  className={`relative w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${affordable ? "bg-zinc-800/70 hover:bg-zinc-800 border-zinc-700" : "bg-zinc-900/40 border-zinc-800 opacity-70"}`}>
                  {onFlash && <span className="absolute -top-2 -left-2 text-[10px] px-2 py-0.5 rounded-full bg-pink-600 border border-pink-300">-25% 20s</span>}
                  <div className="text-2xl">{it.emoji}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{it.name} <span className="text-xs text-zinc-500">×{ownedCount}</span></div>
                      <div className="text-amber-300 font-bold flex items-center gap-2">
                        {onFlash && <span className="line-through text-zinc-500 text-xs">{fmt(singleBase)}</span>}
                        <span>{fmt(price1)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400">{it.desc}</div>
                    <div className="mt-1"><ProgressBar value={clamp((state.cookies / price1), 0, 1)} /></div>
                  </div>
                  <div className="text-right text-xs text-zinc-400 w-24 leading-tight">+{fmt((perItemMult[it.id] || 1) * it.cps)} CPS</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upgrades & Crypto */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl p-4 bg-zinc-900/60 border border-zinc-800 shadow-xl">
            <div className="text-sm font-semibold text-zinc-300 mb-2">Améliorations</div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-3">
              {UPGRADES.map((u) => {
                const available = canBuyUpgrade(u);
                const purchased = !!state.upgrades[u.id];
                return (
                  <button key={u.id} disabled={purchased || !available || state.cookies < u.cost}
                    onClick={() => buyUpgrade(u)}
                    className={`p-3 rounded-xl border text-left transition ${purchased ? "bg-emerald-600/20 border-emerald-400/40 text-emerald-200" : available ? (state.cookies >= u.cost ? "bg-zinc-800/70 hover:bg-zinc-800 border-zinc-700" : "bg-zinc-900/40 border-zinc-800") : "bg-zinc-900/30 border-zinc-900 opacity-60"}`}>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-zinc-400">{u.target === 'all' ? "Tous les bâtiments" : u.target === 'cpc' ? "Puissance de clic" : `Boost ${ITEMS.find(i=>i.id===u.target)?.name}`}</div>
                    <div className="text-sm mt-1 text-amber-300">{purchased ? "Acheté" : `Coût: ${fmt(u.cost)}`}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-zinc-900/60 border border-zinc-800 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-300">{state.crypto.name} <span className="text-zinc-500">({state.crypto.symbol})</span></div>
              <div className={`text-sm px-2 py-1 rounded-lg border ${cryptoFlash ? "bg-emerald-600/30 border-emerald-400/60" : "bg-zinc-800/70 border-zinc-700"}`}>
                Solde: <b>{(state.crypto.balance || 0).toFixed(3)} {state.crypto.symbol}</b>
              </div>
            </div>
            <div className="text-xs text-zinc-400 mt-1">Faucet: <b>{state.crypto.perAmount} {state.crypto.symbol}</b> / <b>{fmt(state.crypto.perCookies)}</b> cookies cuits</div>
            <div className="mt-2 text-xs text-zinc-400">Stake: <b>{(state.crypto.staked || 0).toFixed(3)} {state.crypto.symbol}</b> → Boost global <b>+{((state.crypto.staked || 0)*50).toFixed(1)}%</b></div>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => stake(0.001)} disabled={(state.crypto.balance || 0) < 0.001} className="text-xs px-3 py-1 rounded-lg bg-emerald-700/30 border border-emerald-500/40 disabled:opacity-50">Stake +0.001</button>
              <button onClick={() => unstake(0.001)} disabled={(state.crypto.staked || 0) < 0.001} className="text-xs px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-50">Unstake -0.001</button>
            </div>
          </div>
        </div>

        {/* Bottom: achievements & tips */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl p-4 bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-300">Succès</div>
              <div className="text-xs text-zinc-500">{Object.keys(state.unlocked).length}/{ACHIEVEMENTS.length}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {ACHIEVEMENTS.map((a) => (
                <div key={a.id} className={`p-2 rounded-lg border text-center text-xs ${state.unlocked[a.id] ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "bg-zinc-900/40 border-zinc-800 text-zinc-500"}`}>{a.name}</div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4 bg-zinc-900/60 border border-zinc-800">
            <div className="text-sm font-semibold text-zinc-300">Infos & astuces</div>
            <ul className="mt-2 text-xs text-zinc-400 space-y-1 list-disc list-inside">
              <li>Les <b>cookies dorés</b> apparaissent au hasard. Clique vite !</li>
              <li>Le <b>Rush combo</b> déclenche un boost si tu maintiens un bon rythme.</li>
              <li>Les <b>soldes flash</b> arrivent si tu stagne trop longtemps.</li>
              <li>Les <b>améliorations</b> et les <b>synergies</b> gardent utiles les vieux bâtiments.</li>
              <li>Faucet <b>CRMB</b> : 0.001 / 20 000 cookies. Stake tes CRMB pour booster tout !</li>
              <li>Hors‑ligne : tu gagnes 50% de tes CPS.</li>
            </ul>
          </div>
        </div>

        {/* Toasts */}
        <div className="fixed right-4 bottom-4 z-50 space-y-2">
          <AnimatePresence>
            {state.toasts.map((t) => (
              <motion.div key={t.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className={`px-3 py-2 rounded-lg text-sm shadow border ${t.tone === "success" ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200" : t.tone === "warn" ? "bg-red-500/20 border-red-400/40 text-red-200" : "bg-zinc-800/80 border-zinc-700 text-zinc-100"}`}>
                {t.msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Intro Overlay */}
      <AnimatePresence>
        {!state.ui.introSeen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-amber-900 via-zinc-950 to-black"
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%,rgba(255,200,100,0.12), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.08), transparent 45%)",
              }}
            />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {cookieField.map((c) => (
                <motion.div
                  key={c.id}
                  className="absolute select-none"
                  style={{ top: `${c.top}%`, left: `${c.left}%`, fontSize: c.size }}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: ["0%", "-20%", "0%"], opacity: [0.1, 0.6, 0.1] }}
                  transition={{
                    duration: c.duration,
                    delay: c.delay,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  }}
                >
                  🍪
                </motion.div>
              ))}
            </div>
            <div className="relative h-full w-full flex flex-col items-center justify-center text-center px-6">
              <motion.h1
                id="intro-title"
                initial={{ scale: 0.8, rotateX: 25, opacity: 0 }}
                animate={{ scale: 1, rotateX: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                className="text-6xl md:text-7xl font-extrabold tracking-tight text-amber-300 drop-shadow"
              >
                COOKIE CRAZE
              </motion.h1>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-3 text-zinc-300 max-w-xl"
              >
                Forge des cookies, <b>mine</b> des <span className="text-emerald-300">CrumbCoins</span>, et monte vers l'infini.
              </motion.div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={skipIntro}
                className="mt-8 px-6 py-3 rounded-2xl bg-amber-500/90 hover:bg-amber-400 text-zinc-900 font-bold border border-amber-200 shadow-xl"
              >
                Entrer
              </motion.button>
              <div className="mt-3 text-xs text-zinc-500">
                Appuie sur <b>Entrée</b> ou <b>Espace</b> pour commencer
              </div>
              <button
                aria-pressed={state.ui.sounds}
                onClick={() => setState(s => ({ ...s, ui: { ...s.ui, sounds: !s.ui.sounds } }))}
                className="mt-2 text-xs px-3 py-1 rounded-xl bg-zinc-800/70 border border-zinc-700"
              >
                {state.ui.sounds ? "🔊 Sons ON" : "🔈 Sons OFF"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// === Migration helper ===
function migrate(s) {
  let merged = { ...DEFAULT_STATE, ...s };
  merged.items = merged.items || {}; merged.stats = merged.stats || { clicks: 0, lastPurchaseTs: Date.now() };
  merged.flags = { offlineCollected: false, flash: null, cryptoFlashUntil: 0, ...(merged.flags||{}) };
  merged.buffs = merged.buffs || { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" };
  merged.combo = merged.combo || { value: 1, lastClickTs: 0, lastRushTs: 0 };
  merged.prestige = merged.prestige || { chips: 0 }; merged.ui = { sounds: true, introSeen: false, ...(merged.ui||{}) };
  merged.upgrades = merged.upgrades || {}; merged.unlocked = merged.unlocked || {};
  merged.fx = merged.fx || { banner: null, shakeUntil: 0 };
  merged.crypto = merged.crypto || { name: "CrumbCoin", symbol: "CRMB", balance: 0, staked: 0, mintedUnits: 0, perCookies: 20000, perAmount: 0.001 };
  merged.version = 4;
  return merged;
}
