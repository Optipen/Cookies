import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CookieBiteMask from "./CookieBiteMask.jsx";
import Shop from "./Shop.jsx";
import Upgrades from "./Upgrades.jsx";
import Skins from "./Skins.jsx";
import { ITEMS } from "../data/items.js";
import { UPGRADES } from "../data/upgrades.js";
import { cpsFrom, computePerItemMult, clickMultiplierFrom } from "../utils/calc.js";
import tuning from "../data/tuning.json";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { MISSIONS, getInitialMission, nextMissionId, MICRO_MISSIONS } from "../data/missions.js";
import { useSound } from "../hooks/useSound.js";
import { useMicroMissions } from "../hooks/useMicroMissions.js";
import { fmt, fmtInt, clamp } from "../utils/format.js";

// --- Helpers for CPS recompute (module-level) ---
// moved to utils/calc.js

// === Skins ===
const SKINS = {
  default: { id: "default", name: "Choco",   price: 0,       src: "/cookie.png" },
  caramel: { id: "caramel", name: "Caramel", price: 10_000,  src: "/cookie-caramel.png", className: "saturate-125 hue-rotate-[18deg]" },
  noir:    { id: "noir",    name: "Noir",    price: 100_000, src: "/cookie-noir.png", className: "brightness-[0.92] contrast-125" },
  ice:     { id: "ice",     name: "Ice",     price: 200_000, src: "/cookie-ice.png" },
  fire:    { id: "fire",    name: "Lava",    price: 1_000_000, src: "/cookie-fire.png" },
};

// === Game Data ===

const DEFAULT_STATE = {
  version: 4,
  cookies: 0,
  lifetime: 0,
  cpcBase: 1,
  items: {},
  upgrades: {},
  // Skins state
  skin: "default",
  skinsOwned: { default: true, caramel: false, noir: false, ice: false, fire: false },

  lastTs: Date.now(),
  createdAt: Date.now(),
  stats: { clicks: 0, lastPurchaseTs: Date.now(), goldenClicks: 0 },
  flags: { offlineCollected: false, flash: null, cryptoFlashUntil: 0, goldenLastTs: 0, goldenStacks: 0 },
  buffs: { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" },
  combo: { value: 1, lastClickTs: 0, lastRushTs: 0 },
  prestige: { chips: 0 },
  ui: { sounds: true, introSeen: false },
  toasts: [],
  unlocked: {},
  fx: { banner: null, shakeUntil: 0 },
  crypto: { 
    name: "CrumbCoin", 
    symbol: "CRMB", 
    balance: 0, 
    staked: 0, 
    mintedUnits: 0, 
    perCookies: 20000, 
    perAmount: 0.001 
  },
  // Feature flags
  cookieEatEnabled: true,
  // Cookie eat progress & counters
  cookieEatenCount: 0,
  cookieBites: [],
  mission: getInitialMission(),
  activeMicroMission: null,
};

const SAVE_KEY = "cookieCrazeSaveV4";
const PENDING_RESET_KEY = "cookieCrazePendingReset";

const useAudio = (enabled) => {
  const ctxRef = useRef(null);
  const buffersRef = useRef({});
  const ping = (freq = 520, time = 0.05) => {
    if (!enabled) return;
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current; if (ctx.state === "suspended") { try { ctx.resume(); } catch {} }
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = freq; g.gain.value = 0.07;
      o.connect(g); g.connect(ctx.destination); o.start();
      setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time); o.stop(ctx.currentTime + time); }, time * 800);
    } catch {}
  };
  const loadBuffer = async (url) => {
    if (!enabled) return null;
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
      if (buffersRef.current[url]) return buffersRef.current[url];
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buf = await new Promise((resolve, reject) => {
        try { ctx.decodeAudioData(arr, (b) => resolve(b), (e) => reject(e)); } catch (e) { reject(e); }
      });
      buffersRef.current[url] = buf;
      return buf;
    } catch {
      return null;
    }
  };
  const crunch = async () => {
    if (!enabled) return;
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? (import.meta.env.BASE_URL || '/') : '/';
      const ensureSlash = (s) => s.endsWith('/') ? s : (s + '/');
      const b = ensureSlash(base);
      const candidates = [
        `${b}crunch.mp3`, `${b}crunch-1.mp3`, `${b}crunch-2.mp3`,
        "/crunch.mp3", "/crunch-1.mp3", "/crunch-2.mp3",
        "crunch.mp3", "crunch-1.mp3", "crunch-2.mp3"
      ];
      const start = Math.floor(Math.random() * candidates.length);
      let played = false;
      for (let i = 0; i < candidates.length; i++) {
        const url = candidates[(start + i) % candidates.length];
        const buf = await loadBuffer(url);
        if (buf) {
          const src = ctx.createBufferSource();
          const g = ctx.createGain();
          g.gain.value = 0.4;
          src.buffer = buf;
          src.connect(g); g.connect(ctx.destination);
          src.start(0);
          played = true;
          break;
        }
      }
      if (!played) {
        // Fallback HTMLAudioElement (débloque certains navigateurs / iframes)
        try {
          const htmlCandidates = [
            `${b}crunch.mp3`, `${b}crunch-1.mp3`, `${b}crunch-2.mp3`,
            "/crunch.mp3", "/crunch-1.mp3", "/crunch-2.mp3",
            "crunch.mp3", "crunch-1.mp3", "crunch-2.mp3"
          ];
          let ok = false;
          for (const u of htmlCandidates) {
            try {
              const a = new Audio(u);
              a.volume = 0.4;
              await a.play();
              ok = true;
              break;
            } catch {}
          }
          if (!ok) ping(520, 0.05);
        } catch {
          ping(520, 0.05);
        }
      }
    } catch {
      ping(520, 0.05);
    }
  };
  const dispose = () => {
    try {
      if (ctxRef.current) ctxRef.current.close();
    } catch {}
    ctxRef.current = null;
    buffersRef.current = {};
  };
  return { ping, crunch, dispose };
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
  const { ping, crunch, dispose } = useAudio(state.ui.sounds);
  const { play } = useSound(state.ui.sounds);
  const [previewSkin, setPreviewSkin] = useState(null);
  const [viewKey, setViewKey] = useState(0); // force remount on reset
  const [tab, setTab] = useState('shop');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialInteract, setTutorialInteract] = useState(false);
  const tutorialClicksBase = useRef(0);
  const tutorialManualBuyBase = useRef(0);
  const tutorialVisitedSkins = useRef(false);
  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && setShowMenu(false);
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

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

  // Dispose uniquement au démontage pour éviter de couper l'audio entre les rendus
  useEffect(() => () => dispose(), []);

  // Advanced gate: visible UNIQUEMENT si ?advanced=1 (ou via menu)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get('advanced');
      if (q === '1') setShowAdvanced(true);
    } catch {}
  }, []);

  // --- Multipliers (memo for live view) ---
  const prestigeMulti = useMemo(() => 1 + state.prestige.chips * 0.02, [state.prestige.chips]);
  const stakeMulti = useMemo(() => 1 + (state.crypto.staked || 0) * 0.5, [state.crypto.staked]);
  const perItemMult = useMemo(() => computePerItemMult(state.items, state.upgrades), [state.upgrades, state.items]);
  const cpcMultFromUpgrades = useMemo(() => { let m = 1; for (const id in state.upgrades) { const up = UPGRADES.find((u) => u.id === id); if (up && state.upgrades[id] && up.target === "cpc" && up.type === "mult") m *= up.value; } return m; }, [state.upgrades]);
  const baseCpsNoBuff = useMemo(() => cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeMulti), [state.items, state.upgrades, state.prestige.chips, stakeMulti]);

  const cpsWithBuff = useMemo(() => baseCpsNoBuff * (Date.now() < state.buffs.until ? state.buffs.cpsMulti : 1), [baseCpsNoBuff, state.buffs]);
  const clickMult = useMemo(() => clickMultiplierFrom(state.items, state.upgrades), [state.items, state.upgrades]);
  // Base CPC: dépend UNIQUEMENT du cpcBase initial × multiplicateurs de clic (indépendant du CPS auto)
  const cpcBase = useMemo(() => {
    const mode = (tuning && tuning.mode) || 'standard';
    const ecfg = (tuning && tuning[mode] && tuning[mode].early) || {};
    const earlyActive = state.createdAt && (Date.now() - state.createdAt) / 1000 < (ecfg.window_s || 0);
    const earlyMult = earlyActive ? (ecfg.cpc_base_mult || 1) : 1;
    return (state.cpcBase || 1) * earlyMult * clickMult * (Date.now() < state.buffs.until ? state.buffs.cpcMulti : 1) * cpcMultFromUpgrades;
  }, [state.cpcBase, clickMult, state.buffs, cpcMultFromUpgrades, state.createdAt]);
  // CPC courant utilisé pour les gains (sans combo)
  const cpc = useMemo(() => cpcBase, [cpcBase]);

  // Skin preview helpers
  const skinKey = previewSkin || state.skin;
  const skinClass = (SKINS[skinKey] && SKINS[skinKey].className) ? SKINS[skinKey].className : "";
  const skinSrc = (SKINS[skinKey] && SKINS[skinKey].src) ? SKINS[skinKey].src : SKINS.default.src;

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
        // Buff expiry
        let buffs = { ...s.buffs };
        if (buffs.until && now >= buffs.until) buffs = { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" };
        return { ...s, cookies, lifetime, buffs, crypto, flags };
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
    if (dt > 3 && !state.flags.offlineCollected) {
      const stakeM = 1 + (state.crypto?.staked || 0) * 0.5;
      const mode = (tuning && tuning.mode) || 'standard';
      const ocfg = (tuning && tuning[mode] && tuning[mode].offline) || {};
      const maxSeconds = ocfg.max_seconds ?? 7200;
      const cappedDt = Math.min(dt, maxSeconds);
      const r0 = ocfg.ratio_0_10min ?? 0.10;
      const r1 = ocfg.ratio_2h ?? 0.03;
      const t0 = 600, t1 = maxSeconds;
      const ratio = cappedDt <= t0 ? r0 : r0 - (r0 - r1) * ((cappedDt - t0) / (t1 - t0));
      const offlineGain = cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeM) * cappedDt * ratio;
      if (offlineGain > 0) {
        toast(`+${fmt(offlineGain)} cookies gagnés hors-ligne`, "success", { ms: 3000 });
        setState((s) => ({ ...s, cookies: s.cookies + offlineGain, lifetime: s.lifetime + offlineGain, flags: { ...s.flags, offlineCollected: true } }));
      }
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

  // Skin preview events (from Skins.jsx)
  useEffect(() => {
    const handler = (e) => setPreviewSkin(e.detail || null);
    window.addEventListener('skin-preview', handler);
    return () => window.removeEventListener('skin-preview', handler);
  }, []);

  // Tutorial step baselines
  useEffect(() => {
    if (state.ui.introSeen) return;
    if (tutorialStep === 1) {
      tutorialClicksBase.current = state.stats.clicks || 0;
    } else if (tutorialStep === 2) {
      // total des items manuels (mode: 'mult')
      let total = 0; for (const it of ITEMS) if (it.mode === 'mult') total += (state.items[it.id] || 0);
      tutorialManualBuyBase.current = total;
    }
  }, [tutorialStep, state.ui.introSeen]);

  // Step 1: avance après 5 clics
  useEffect(() => {
    if (state.ui.introSeen) return;
    if (tutorialStep !== 1) return;
    const diff = (state.stats.clicks || 0) - (tutorialClicksBase.current || 0);
    if (diff >= 5) { setTutorialInteract(false); setTutorialStep(2); }
  }, [state.stats.clicks, tutorialStep, state.ui.introSeen]);

  // Step 2: avance après un achat manuel
  useEffect(() => {
    if (state.ui.introSeen) return;
    if (tutorialStep !== 2) return;
    let total = 0; for (const it of ITEMS) if (it.mode === 'mult') total += (state.items[it.id] || 0);
    if (total > tutorialManualBuyBase.current) { setTutorialInteract(false); setTutorialStep(3); }
  }, [state.items, tutorialStep, state.ui.introSeen]);

  // Step 3: avance quand l'onglet skins est vu
  useEffect(() => {
    if (state.ui.introSeen) return;
    if (tutorialStep !== 3) return;
    if (tab === 'skins' && !tutorialVisitedSkins.current) {
      tutorialVisitedSkins.current = true;
      // Message central de bienvenue: image au centre, durée totale ~3s
      setState((s) => ({
        ...s,
        fx: {
          ...s.fx,
          tag: { image: '/welcome.png', text: '', until: Date.now() + 3000, anim: { inMs: 300, outMs: 300 }, x: '25vw', y: '10vh' },
        },
      }));
      setTimeout(() => setTutorialStep(4), 3000);
    }
  }, [tab, tutorialStep, state.ui.introSeen]);

  // Track timestamp for offline Save
  useEffect(() => {
    const h = () => setState((s) => ({ ...s, lastTs: Date.now() }));
    window.addEventListener("beforeunload", h);
    const iv = setInterval(h, 5000);
    return () => { window.removeEventListener("beforeunload", h); clearInterval(iv); };
  }, []);

  // Flash Sale scheduler (early-game boost configurable)
  useEffect(() => {
    const iv = setInterval(() => {
      setState((s) => {
        const now = Date.now();
        const mode = (tuning && tuning.mode) || 'standard';
        const ecfg = (tuning && tuning[mode] && tuning[mode].early && tuning[mode].early.flash) || {};
        const earlyActive = s.createdAt && (now - s.createdAt) / 1000 < ((tuning && tuning[mode] && tuning[mode].early && tuning[mode].early.window_s) || 0);
        const thresholdMs = earlyActive ? (ecfg.no_purchase_threshold_s || 30) * 1000 : 60000;
        const noSale = !s.flags.flash || now >= s.flags.flash.until;
        if (now - (s.stats.lastPurchaseTs || s.lastTs) > thresholdMs && noSale) {
          const pick = ITEMS[Math.floor(Math.random() * ITEMS.length)];
          const discount = earlyActive ? (ecfg.discount || 0.3) : 0.25;
          return { ...s, flags: { ...s.flags, flash: { itemId: pick.id, discount, until: now + 20000 } } };
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

  // Mission engine: une mission active à la fois
  useEffect(() => {
    setState((s) => {
      const current = MISSIONS.find((m) => m.id === (s.mission?.id));
      if (!current) return { ...s, mission: getInitialMission() };
      const { progress, target, done } = current.check(s);
      if (done && !s.mission.completed) {
        // Applique la récompense et prépare la suivante
        current.reward(s, setState, toast);
        const nextId = nextMissionId(current.id);
        return { ...s, mission: { id: nextId, startedAt: Date.now(), completed: false } };
      }
      // Stocke progression live
      return { ...s, mission: { ...s.mission, progress, target, completed: !!done } };
    });
  }, [state.cookies, state.items, state.stats.goldenClicks]);

  // Micro missions engine
  useMicroMissions(state, setState, toast);

  // Toast helper (function declaration to allow hoisting before first use)
  function toast(msg, tone = "info", options = {}) {
    const id = Math.random().toString(36).slice(2);
    setState((s) => ({ ...s, toasts: [...s.toasts, { id, msg, tone }] }));
    const duration = options.ms || 2800;
    setTimeout(() => setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) })), duration);
  }

  // Golden cookie
  const goldenTimerRef = useRef(null);
  const goldenHideTimerRef = useRef(null);
  const goldenClickLockRef = useRef(0);

  const scheduleGolden = () => {
    try { if (goldenTimerRef.current) { clearTimeout(goldenTimerRef.current); goldenTimerRef.current = null; } } catch {}
    const mode = (tuning && tuning.mode) || 'standard';
    const cfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.golden) || null;
    const ecfg = (tuning && tuning[mode] && tuning[mode].early && tuning[mode].early.golden) || null;
    const earlyActive = state.createdAt && (Date.now() - state.createdAt) / 1000 < ((tuning && tuning[mode] && tuning[mode].early && tuning[mode].early.window_s) || 0);
    const baseMin = cfg ? (cfg.cooldown_s?.[0] ?? 100) : 100;
    const baseMax = cfg ? (cfg.cooldown_s?.[1] ?? 150) : 150;
    const min = earlyActive && ecfg ? (ecfg.cooldown_s?.[0] ?? baseMin) : baseMin;
    const max = earlyActive && ecfg ? (ecfg.cooldown_s?.[1] ?? baseMax) : baseMax;
    const d = (min + Math.random() * (max - min)) * 1000;
    goldenTimerRef.current = setTimeout(() => setShowGolden(true), d);
  };
  const [showGolden, setShowGolden] = useState(false);
  const goldenRef = useRef({ left: "50%", top: "50%" });
  useEffect(() => {
    if (showGolden) {
      const area = document.getElementById("game-area");
      if (area) { const r = area.getBoundingClientRect(); const left = Math.random() * (r.width - 120) + 60; const top = Math.random() * (r.height - 200) + 120; goldenRef.current = { left: `${left}px`, top: `${top}px` }; }
      goldenHideTimerRef.current = setTimeout(() => { setShowGolden(false); scheduleGolden(); }, 10000);
      return () => { try { if (goldenHideTimerRef.current) clearTimeout(goldenHideTimerRef.current); } catch {} };
    }
  }, [showGolden]);
  const onGoldenClick = () => {
    const nowClick = Date.now();
    if (nowClick < goldenClickLockRef.current) return; // anti double-click
    goldenClickLockRef.current = nowClick + 800;
    setShowGolden(false); scheduleGolden(); ping(880, 0.1); try { play('/sounds/golden_appear.mp3', 0.45); } catch {}
    const now = Date.now();
    const mode = (tuning && tuning.mode) || 'standard';
    const gcfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.golden) || {};
    const drWindow = (gcfg.dr_window_s ?? 120) * 1000;
    const recent = now - (state.flags.goldenLastTs || 0) < drWindow;
    const stacks = recent ? (state.flags.goldenStacks || 0) + 1 : 0;
    const drBase = gcfg.dr_factor ?? 0.85;
    const dr = Math.pow(drBase, stacks);
    const roll = Math.random();
    if (roll < 0.35) {
      const cpsMax = gcfg.cps_mult_max ?? 5;
      const m = Math.max(1, Math.min(cpsMax, cpsMax * dr));
      applyBuff({ cpsMulti: m, cpcMulti: 1, seconds: 20, label: `FRENZY x${Math.round(m)}` }); toast(`FRENZY: CPS x${Math.round(m)} pendant 20s !`, "success");
    }
    else if (roll < 0.65) {
      const cpcMax = gcfg.cpc_mult_max ?? 10;
      const m = Math.max(1, Math.min(cpcMax, cpcMax * dr));
      applyBuff({ cpsMulti: 1, cpcMulti: m, seconds: 12, label: `CLICK FRENZY x${Math.round(m)}` }); toast(`CLICK FRENZY: CPC x${Math.round(m)} pendant 12s !`, "success");
    }
    else if (roll < 0.85) {
      const stakeM = 1 + (state.crypto?.staked || 0) * 0.5;
      const cpsNow = cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeM);
      const bankMin = gcfg.lucky_bank_min ?? 0.10;
      const cpsMult = gcfg.lucky_cps_mult ?? 12;
      const base = Math.max(state.cookies * bankMin, cpsNow * cpsMult);
      const bonus = base * dr;
      setState((s) => ({ ...s, cookies: s.cookies + bonus, lifetime: s.lifetime + bonus })); toast(`Lucky +${fmt(bonus)} !`, "success");
    }
    else { burstParticles(30); const bonus = cpc * 30; setState((s) => ({ ...s, cookies: s.cookies + bonus, lifetime: s.lifetime + bonus })); toast(`Pluie de miettes +${fmt(bonus)} !`, "success"); }
    setState((s) => ({ ...s, stats: { ...s.stats, goldenClicks: (s.stats.goldenClicks || 0) + 1 }, flags: { ...s.flags, goldenLastTs: now, goldenStacks: stacks } }));
  };
  const applyBuff = ({ cpsMulti = 1, cpcMulti = 1, seconds = 10, label = "" }) => { const until = Date.now() + seconds * 1000; setState((s) => ({ ...s, buffs: { cpsMulti, cpcMulti, until, label } })); };

  // Cookie Rain (événement toutes ~2–4 min)
  const [rainCrumbs, setRainCrumbs] = useState([]);
  const [rainUntil, setRainUntil] = useState(0);
  const [flyingCookie, setFlyingCookie] = useState(null);
  const [speedChallenge, setSpeedChallenge] = useState({ idleSince: Date.now(), visible: false, active: false, clicks: 0, until: 0 });
  const scheduleRain = () => {
    const mode = (tuning && tuning.mode) || 'standard';
    const rcfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.rain) || {};
    const min = rcfg.cooldown_s?.[0] ?? 120;
    const max = rcfg.cooldown_s?.[1] ?? 240;
    const d = (min + Math.random() * (max - min)) * 1000;
    setTimeout(() => startRain(), d);
  };
  // Flying cookie scheduler (rare)
  useEffect(() => {
    const iv = setInterval(() => {
      if (flyingCookie || Date.now() < (speedChallenge.until || 0)) return;
      if (Math.random() < 0.035) {
        const area = document.getElementById('game-area'); const r = area?.getBoundingClientRect();
        const left = (r ? (Math.random() * (r.width - 120) + 60) : (Math.random() * 400 + 60));
        const top = (r ? (Math.random() * (r.height - 260) + 120) : (Math.random() * 240 + 120));
        setFlyingCookie({ id: Math.random().toString(36).slice(2), left, top, until: Date.now() + 3000 });
        try { play('/sounds/golden_appear.mp3', 0.35); } catch {}
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [flyingCookie, speedChallenge.until]);
  useEffect(() => {
    if (!flyingCookie) return; const t = setTimeout(() => setFlyingCookie(null), Math.max(0, flyingCookie.until - Date.now()));
    return () => clearTimeout(t);
  }, [flyingCookie]);
  const onFlyingCookieClick = () => {
    if (!flyingCookie) return;
    setFlyingCookie(null);
    applyBuff({ cpsMulti: 1, cpcMulti: 1.2, seconds: 15, label: 'VITESSE +20% CPC' });
    toast('Vitesse: +20% CPC (15s)', 'success');
  };

  // Idle detection + speed challenge
  useEffect(() => {
    const onAny = () => setSpeedChallenge((s) => ({ ...s, idleSince: Date.now(), visible: false }));
    window.addEventListener('mousemove', onAny); window.addEventListener('keydown', onAny); window.addEventListener('click', onAny);
    const iv = setInterval(() => {
      setSpeedChallenge((s) => {
        if (s.active) return s;
        const idle = Date.now() - (s.idleSince || 0);
        if (idle > 10000) return { ...s, visible: true };
        return s;
      });
    }, 1000);
    return () => { window.removeEventListener('mousemove', onAny); window.removeEventListener('keydown', onAny); window.removeEventListener('click', onAny); clearInterval(iv); };
  }, []);
  const startSpeedChallenge = () => {
    setSpeedChallenge({ idleSince: Date.now(), visible: false, active: true, clicks: 0, until: Date.now() + 20000 });
    toast('Défi de vitesse: 25 clics en 20s !', 'info');
  };
  useEffect(() => {
    if (!speedChallenge.active) return;
    const t = setInterval(() => {
      setSpeedChallenge((s) => {
        if (!s.active) return s;
        if (Date.now() >= s.until) {
          const ok = s.clicks >= 25;
          if (ok) { applyBuff({ cpcMulti: 1.2, seconds: 20, label: 'DÉFI +20% CPC' }); toast('Défi réussi ! CPC +20% (20s)', 'success'); }
          else { toast(`Défi raté (${s.clicks}/25)`, 'warn'); }
          return { idleSince: Date.now(), visible: false, active: false, clicks: 0, until: 0 };
        }
        return s;
      });
    }, 250);
    return () => clearInterval(t);
  }, [speedChallenge.active]);
  useEffect(() => {
    if (!speedChallenge.active) return;
    const inc = () => setSpeedChallenge((s) => ({ ...s, clicks: s.clicks + 1 }));
    window.addEventListener('click', inc);
    return () => window.removeEventListener('click', inc);
  }, [speedChallenge.active]);
  const startRain = () => {
    const mode = (tuning && tuning.mode) || 'standard';
    const rcfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.rain) || {};
    const dur = (rcfg.duration_s ?? 8) * 1000;
    const until = Date.now() + dur; setRainUntil(until);
    const area = document.getElementById("game-area"); const r = area?.getBoundingClientRect();
    const width = r ? r.width : window.innerWidth;
    const arr = Array.from({ length: 50 }).map(() => ({ id: Math.random().toString(36).slice(2), x: Math.random() * (width - 40) + 20, y: -20, vy: 2 + Math.random() * 3 }));
    setRainCrumbs(arr); setTimeout(() => { setRainCrumbs([]); scheduleRain(); }, dur);
  };
  useEffect(() => {
    if (!rainCrumbs.length) return; const iv = setInterval(() => { setRainCrumbs((cc) => cc.map((c) => ({ ...c, y: c.y + c.vy * 3 })).filter((c) => c.y < window.innerHeight + 30)); }, 16);
    return () => clearInterval(iv);
  }, [rainCrumbs.length]);
  const onCrumbClick = (id) => {
    setRainCrumbs((cc) => cc.filter((c) => c.id !== id));
    const mode = (tuning && tuning.mode) || 'standard';
    const rcfg = (tuning && tuning[mode] && tuning[mode].events && tuning[mode].events.rain) || {};
    const factor = Array.isArray(rcfg.cpc_factor)
      ? (rcfg.cpc_factor[0] + Math.random() * (rcfg.cpc_factor[1] - rcfg.cpc_factor[0]))
      : (rcfg.cpc_factor || 3);
    const gain = cpc * factor;
    setState((s) => ({ ...s, cookies: s.cookies + gain, lifetime: s.lifetime + gain }));
    ping(740, 0.05);
  };

  // --- Pricing: Bulk + Milestone steepening ---
  const milestoneFactor = (owned) => {
    const mode = (tuning && tuning.mode) || 'standard';
    const mcfg = (tuning && tuning[mode] && tuning[mode].milestones) || {};
    const th = mcfg.thresholds || [10, 25, 50, 100, 200];
    const mults = mcfg.multipliers || [1.15, 1.4, 2.0, 3.5, 5.0];
    let m = 1;
    for (let i = 0; i < th.length; i++) {
      if (owned >= th[i]) m *= mults[i] || 1;
    }
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
    const mode = (tuning && tuning.mode) || 'standard';
    const ecfg = (tuning && tuning[mode] && tuning[mode].early) || {};
    const earlyActive = state.createdAt && (Date.now() - state.createdAt) / 1000 < (ecfg.window_s || 0);
    if (earlyActive && it && it.mode === 'cps') {
      const totalCpsOwned = ITEMS.filter(x => x.mode === 'cps').reduce((acc, x) => acc + (state.items[x.id] || 0), 0);
      if (ecfg.free_first_auto && totalCpsOwned === 0 && state.ui.introSeen) price = 0;
      else price *= (1 - (ecfg.cps_discount || 0));
    }
    // Discount global temporaire (micro‑missions)
    if (state.flags.discountAll && Date.now() < state.flags.discountAll.until) {
      price *= (1 - (state.flags.discountAll.value || 0));
    }
    // Tutoriel: premier achat de Curseur gratuit à la toute première partie (une seule fois)
    if (!state.ui.introSeen && id === 'cursor' && owned === 0) price = 0;
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

    // Tirage EUPHORIA sur achat (divisé par 4): 7.5%x2.5, 5%x3, 2.5%x5, 0.5%x10
    const r = Math.random();
    let euphoriaMult = 0;
    if (r < 0.075) euphoriaMult = 2.5;           // 7.5%
    else if (r < 0.125) euphoriaMult = 3;        // +5% = 12.5%
    else if (r < 0.150) euphoriaMult = 5;        // +2.5% = 15%
    else if (r < 0.155) euphoriaMult = 10;       // +0.5% = 15.5%

    // Prépare sous-texte bannière: CPS si achat auto, CPC si achat clic
    const isManualClickItem = it && it.mode === 'mult';
    let bannerSub = `+${fmt(deltaCps)} CPS (${((deltaCps/Math.max(1,cpsBefore))*100).toFixed(0)}%)`;
    if (isManualClickItem) {
      const beforeClickMult = clickMultiplierFrom(state.items, state.upgrades);
      const afterClickMult = clickMultiplierFrom(newItems, state.upgrades);
      // Recalcule CPC avant/après avec la même formule que l'UI (sans dépendre du CPS auto)
      let cpcUpgradesMult = 1;
      for (const upId in state.upgrades) {
        if (!state.upgrades[upId]) continue;
        const up = UPGRADES.find((u) => u.id === upId);
        if (up && up.target === 'cpc' && up.type === 'mult') cpcUpgradesMult *= up.value;
      }
      const cpcBuffNow = (Date.now() < state.buffs.until) ? state.buffs.cpcMulti : 1;
      const cpcBefore = (state.cpcBase || 1) * beforeClickMult * cpcUpgradesMult * cpcBuffNow;
      const cpcAfter = (state.cpcBase || 1) * afterClickMult * cpcUpgradesMult * cpcBuffNow;
      const deltaCpc = cpcAfter - cpcBefore;
      bannerSub = `+${fmt(deltaCpc)} CPC`;
    }

    // Apply purchase
    ping(big ? 900 : 660, big ? 0.12 : 0.07);
    setState((s) => {
      const now = Date.now();
      let buffs = s.buffs;
      if (euphoriaMult > 0) {
        buffs = { ...buffs, cpcMulti: euphoriaMult, until: now + 8000, label: `EUPHORIA x${euphoriaMult} CPC` };
      }
      // Si le tutoriel étape 2 est actif, l'achat manuel valide l'étape (géré aussi par effet), rien à faire ici
      return {
        ...s,
        cookies: s.cookies - price,
        items: newItems,
        stats: { ...s.stats, lastPurchaseTs: Date.now() },
        flags: { ...s.flags, flash: null },
        fx: big ? { banner: { title: "MEGA ACHAT", sub: bannerSub, until: Date.now() + 2400 }, shakeUntil: Date.now() + 900 } : s.fx,
        buffs,
      };
    });
    if (euphoriaMult > 0) toast(`EUPHORIA: CPC x${euphoriaMult} pendant 8s`, "success");
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

  // --- Skins Shop (logic) ---
  const buySkin = (skinId) => {
    const skin = SKINS[skinId];
    if (!skin) return;
    if (state.skinsOwned[skinId]) return toast("Skin déjà acheté", "warn");
    if (state.cookies < skin.price) return toast("Pas assez de cookies…", "warn");

    setState((s) => ({
      ...s,
      cookies: s.cookies - skin.price,
      skinsOwned: { ...s.skinsOwned, [skinId]: true },
    }));
    toast(`Nouveau skin débloqué: ${skin.name}`, "success");
  };

  const selectSkin = (skinId) => {
    if (!state.skinsOwned[skinId]) return toast("Skin non débloqué", "warn");
    setState((s) => ({ ...s, skin: skinId }));
  };

  // Particles (clics)
  const [particles, setParticles] = useState([]);
  const [crumbs, setCrumbs] = useState([]);
  const cookieWrapRef = useRef(null);
  const mousePos = useRef({ x: 0, y: 0 });
  useEffect(() => { const onMove = (e) => { mousePos.current = { x: e.clientX, y: e.clientY }; }; window.addEventListener("mousemove", onMove); return () => window.removeEventListener("mousemove", onMove); }, []);
  const burstParticles = (n = 10, at = null, labelText = null) => {
    const rect = cookieWrapRef.current?.getBoundingClientRect();
    const base = at || (rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 });
    const arr = Array.from({ length: n }).map(() => ({ id: Math.random().toString(36).slice(2), x: base.x + (Math.random() - 0.5) * 80, y: base.y + (Math.random() - 0.5) * 80, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 2 - 1, life: 16 + Math.random() * 10, text: labelText != null ? labelText : `+${fmt(cpc)}` }));
    setParticles((p) => [...p, ...arr]);
  };
  useEffect(() => { const iv = setInterval(() => { setParticles((pp) => pp.map((p) => ({ ...p, x: p.x + p.vx * 4, y: p.y + p.vy * 4, life: p.life - 1 })).filter((p) => p.life > 0)); }, 16); return () => clearInterval(iv); }, []);

  // Crumb particles (miettes visuelles)
  const burstCrumbs = (n = 12, at = null) => {
    const rect = cookieWrapRef.current?.getBoundingClientRect();
    const base = at || (rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 });
    const colors = ["#8b5a2b", "#6b4423", "#a0522d", "#7b4a2e"]; // bruns variés
    const arr = Array.from({ length: n }).map(() => ({
      id: Math.random().toString(36).slice(2),
      x: base.x + (Math.random() - 0.5) * 40,
      y: base.y + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 2.2,
      vy: -Math.random() * 2.8 - 0.6,
      life: 22 + Math.random() * 14,
      size: 3 + Math.random() * 6,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setCrumbs((p) => [...p, ...arr]);
  };
  useEffect(() => { const iv = setInterval(() => { setCrumbs((pp) => pp.map((p) => ({ ...p, x: p.x + p.vx * 3.6, y: p.y + p.vy * 3.6, vy: p.vy + 0.04, life: p.life - 1, rot: p.rot + p.vr })).filter((p) => p.life > 0)); }, 16); return () => clearInterval(iv); }, []);

  // Big cookie click
  const onCookieClick = () => {
    crunch();
    setState((s) => {
      const gain = cpc;
      return { ...s, cookies: s.cookies + gain, lifetime: s.lifetime + gain, stats: { ...s.stats, clicks: s.stats.clicks + 1 } };
    });
    burstParticles(1, null, `x${clickMult.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`);
    burstCrumbs(6);
  };

  // --- Cookie eaten handler + progress tracking ---
  const onCookieEaten = () => {
    setState((s) => {
      const count = (s.cookieEatenCount || 0) + 1;
      let bonus = 0;
      if (count === 1) bonus = cpc * 50;
      else if (count % 5 === 0) bonus = cpc * 100;
      else bonus = cpc * 10;
      const cookies = s.cookies + bonus;
      toast(`🍪 Cookie mangé ! +${fmt(bonus)}`, "success");
      return { ...s, cookies, lifetime: s.lifetime + bonus, cookieEatenCount: count, cookieBites: [] };
    });
  };

  const prevClickForBites = useRef(state.stats.clicks);
  useEffect(() => {
    if (!state.cookieEatEnabled) { prevClickForBites.current = state.stats.clicks; return; }
    const prev = prevClickForBites.current;
    const curr = state.stats.clicks;
    if (curr > prev) {
      let toAdd = 0;
      for (let c = prev + 1; c <= curr; c++) {
        if (c % 2 === 0 && (state.cookieBites.length + toAdd) < 80) toAdd++;
      }
      if (toAdd > 0) {
        setState((s) => {
          const baseLen = s.cookieBites.length;
          const add = Array.from({ length: toAdd }).map((_, i) => baseLen + i);
          return { ...s, cookieBites: [...s.cookieBites, ...add] };
        });
      }
      prevClickForBites.current = curr;
    }
  }, [state.stats.clicks, state.cookieEatEnabled, state.cookieBites.length]);

  // Prestige
  const potentialChips = Math.floor(Math.sqrt(state.lifetime / 1_000_000));
  const canPrestige = potentialChips > state.prestige.chips && state.cookies >= 100_000;
  const doPrestige = () => {
    if (!canPrestige) return;
    if (!confirm(`Prestige ? Tu gagneras ${potentialChips - state.prestige.chips} chips célestes (+2% prod/chip) et ta progression sera réinitialisée.`)) return;
    setState((s) => ({ ...DEFAULT_STATE, prestige: { chips: potentialChips }, ui: s.ui, toasts: [] }));
    toast("Re-naissance céleste ✨", "success");
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Cookie Craze</h1>
          </div>
          <div className="relative flex items-center gap-3 text-sm flex-wrap pr-12 md:pr-16">
            <span className="px-2 py-1 rounded-full bg-zinc-800/70 border border-zinc-700">Clic: <b>x{clickMult.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</b></span>
            <span className="px-2 py-1 rounded-full bg-zinc-800/70 border border-zinc-700">Auto: <b>{fmt(cpsWithBuff)}</b> CPS</span>
            <span className="px-2 py-1 rounded-full bg-zinc-800/70 border border-zinc-700">Prestige: <b>{state.prestige.chips}</b></span>
            <span className={`${cryptoFlash ? "bg-emerald-600/30 border-emerald-400/60" : "bg-zinc-800/70 border-zinc-700"} px-2 py-1 rounded-full border relative group`} aria-label="Solde CRMB" tabIndex={0}>CRMB: <b>{(state.crypto.balance || 0).toFixed(3)}</b>
              <span className="pointer-events-none absolute left-0 mt-1 translate-y-full opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition px-3 py-2 rounded-md bg-zinc-900/90 border border-zinc-700 text-xs w-64">Le faucet crédite automatiquement des CRMB selon les cookies cuits. Tu peux les stake pour booster toute ta production.</span>
            </span>
            <button
              onClick={() => setShowMenu(v => !v)}
              aria-haspopup="menu"
              aria-expanded={showMenu}
              className="absolute right-0 -top-1 md:top-0 rounded-lg px-2 py-1 bg-zinc-800 border border-zinc-700 text-sm"
            >⚙️</button>
            {showMenu && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 rounded-xl bg-zinc-900/95 border border-zinc-700 shadow-xl z-50"
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  role="menuitem"
                  onClick={() => setState(s => ({ ...s, ui:{...s.ui, sounds: !s.ui.sounds} }))}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-800/60"
                >
                  {state.ui.sounds ? "🔊 Sons ON" : "🔈 Sons OFF"}
                </button>

                <button
                  role="menuitem"
                  onClick={() => { setShowAdvanced(v => !v); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-800/60"
                >
                  🛠️ Avancé
                </button>

                <button
                  role="menuitem"
                  onClick={hardReset}
                  className="w-full text-left px-3 py-2 text-red-300 hover:bg-red-900/30"
                >
                  ♻️ Reset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top Stats */}
        <div className={"mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 " + (shaking ? "animate-[wiggle_0.7s_ease]" : "")}>
          <div className="md:col-span-2 rounded-2xl p-4 bg-zinc-900/60 border border-zinc-800 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="text-base md:text-xl text-zinc-300">Cookies en banque</div>
              <div className="text-4xl md:text-6xl font-extrabold tracking-tight text-amber-300 drop-shadow">{fmtInt(state.cookies)}</div>
              <div className="text-sm text-zinc-500 flex items-center gap-1">Cuits au total: {fmtInt(state.lifetime)}{baseCpsNoBuff > 0 ? (' · ' + fmt(baseCpsNoBuff) + ' CPS') : ''}
                <span
                  className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-800/70 border border-zinc-700 text-[10px] cursor-help group relative"
                  aria-label="Cookies mangés — aide"
                  tabIndex={0}
                >
                  ?
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 mt-2 translate-y-full opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition px-3 py-2 rounded-md bg-zinc-900/90 border border-zinc-700 text-xs w-64">
                    Les "cookies mangés" proviennent des cookies dorés. Ils servent à débloquer des petites surprises et ne sont pas dépensés.
                  </span>
                </span>
              </div>

              {Date.now() < state.buffs.until && (
                <div className="mt-3 text-xs px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40">
                  Boost <b>{state.buffs.label}</b> · {(buffTimeLeft/1000).toFixed(0)}s
                </div>
              )}
              {canPrestige && (
                <button onClick={doPrestige} className="mt-2 text-xs px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 transition border border-purple-400/50 shadow">Prestige +{potentialChips - state.prestige.chips}</button>
              )}

              {showAdvanced && (
                <div className="mt-2 flex items-center gap-2 justify-center text-xs">
                  <button onClick={exportSave} className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700">💾 Export</button>
                  <label className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer">📥 Import
                    <input type="file" accept=".json,.txt" className="hidden" onChange={(e) => e.target.files && importSave(e.target.files[0])} />
                  </label>
                </div>
              )}
            </div>

            {/* Compteur de cookies mangés (remplace la barre de progression) */}
            <div className="mt-4 mb-1 w-full max-w-md mx-auto text-left">
              <div className="text-xs md:text-sm text-zinc-400">
                {/* Intentionnellement discret en haut; une version plus visible est en bas-gauche */}
              </div>
            </div>

            {/* Mission en cours */}
            <div className="mt-3 w-full max-w-md mx-auto">
              <div className="text-xs text-zinc-300 font-semibold">Mission</div>
              <div className="mt-1 rounded-xl border border-zinc-700/70 bg-zinc-900/60 p-3">
                <div className="text-sm font-bold text-zinc-100">{(MISSIONS.find(m => m.id === state.mission?.id)?.title) || "—"}</div>
                <div className="text-xs text-zinc-400">{(MISSIONS.find(m => m.id === state.mission?.id)?.desc) || "—"}</div>
                <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: (Math.min(100, Math.floor(((state.mission?.progress||0) / Math.max(1,(state.mission?.target||1))) * 100))) + '%' }} />
                </div>
              </div>
            </div>

            {/* Micro‑mission en cours */}
            <div className="mt-3 w-full max-w-md mx-auto">
              <div className="text-xs text-zinc-300 font-semibold">Micro‑mission</div>
              <div className="mt-1 rounded-xl border border-zinc-700/70 bg-zinc-900/60 p-3">
                {(() => {
                  const cur = MICRO_MISSIONS.find(m => m.id === state.activeMicroMission?.id);
                  const pct = Math.min(100, Math.floor(((state.activeMicroMission?.progress||0) / Math.max(1,(state.activeMicroMission?.target||1))) * 100));
                  return (
                    <>
                      <div className="text-sm font-bold text-zinc-100">{cur?.title || "—"}</div>
                      {cur?.desc && <div className="text-xs text-zinc-400">{cur.desc}</div>}
                      <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden" aria-label="Progression micro‑mission" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} role="progressbar">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: pct + '%' }} />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Big Cookie */}
            <div ref={cookieWrapRef} className="-mt-9 relative flex items-center justify-center">
              {/* Wrapper carré aux dimensions du cookie pour un centrage parfait */}
              <div className="relative h-96 w-96 md:h-[30rem] md:w-[30rem]">
                {/* welcome.png centré au-dessus du cookie quand fx.tag est actif */}
                {state.fx.tag && Date.now() < state.fx.tag.until && state.fx.tag.image && (
                  <img
                    src={state.fx.tag.image}
                    alt="Bienvenue"
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] md:w-[200%] max-w-[960px] drop-shadow-2xl z-10"
                  />
                )}

                <motion.div
                  whileTap={{ scale: 0.92, rotate: -2 }}
                  className="h-full w-full"
                >
                  {state.cookieEatEnabled ? (
                    <CookieBiteMask
                      skinSrc={skinSrc}
                      clicks={state.stats.clicks}
                      bitesTotal={80}
                      enabled={state.cookieEatEnabled}
                      onFinished={onCookieEaten}
                      className={"h-full w-full cursor-pointer select-none drop-shadow-xl " + skinClass}
                      onClick={onCookieClick}
                    />
                  ) : (
                    <motion.img
                      src={skinSrc}
                      alt="Cookie"
                      className={"h-full w-full cursor-pointer select-none drop-shadow-xl " + skinClass}
                      whileTap={{ scale: 0.92, rotate: -2 }}
                      onClick={onCookieClick}
                      draggable="false"
                    />
                  )}
                </motion.div>
              </div>
              {/* Particles (confinées à la zone du cookie) */}
              <div className="pointer-events-none absolute inset-0">
                <AnimatePresence>
                  {crumbs.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute rounded-full drop-shadow"
                      style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color, rotate: p.rot }}
                    />
                  ))}
                  {particles.map((p) => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute text-amber-300 text-xs font-bold drop-shadow" style={{ left: p.x, top: p.y }}>{p.text}</motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {/* Compteur en bas à gauche + aide */}
              <div className="absolute bottom-2 left-2 text-sm md:text-base text-zinc-300 flex items-center gap-2">
                <span>Cookies mangés: <b>{state.cookieEatenCount || 0}</b></span>
                <div className="relative group">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] cursor-default">?</span>
                  <div className="absolute bottom-full mb-2 left-0 w-64 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    <div className="rounded-lg px-3 py-2 text-xs bg-zinc-900/90 border border-zinc-700 shadow-xl">
                      Clique le gros cookie et les bonus pour grignoter le biscuit. Chaque cookie mangé octroie un bonus immédiat et peut débloquer des surprises.
                    </div>
                  </div>
                </div>
              </div>
              {/* Combo supprimé */}
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

            {/* Flying Cookie (mini-jeu) */}
            <AnimatePresence>
              {!!flyingCookie && (
                <motion.button
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={onFlyingCookieClick}
                  className="fixed z-20 h-14 w-14 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-2 border-amber-100 shadow-xl"
                  style={{ left: flyingCookie.left, top: flyingCookie.top }}
                >🍪</motion.button>
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
                <motion.div
                  initial={{ scale: 0.96, opacity: 0, y: (state.fx.banner.anim && state.fx.banner.anim.style === 'slide') ? -10 : 0 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ duration: (state.fx.banner.anim && state.fx.banner.anim.inMs ? state.fx.banner.anim.inMs / 1000 : 0.25), ease: 'easeInOut' }}
                  exit={{ opacity: 0, y: (state.fx.banner.anim && state.fx.banner.anim.style === 'slide') ? -20 : 0, transition: { duration: (state.fx.banner.anim && state.fx.banner.anim.outMs ? state.fx.banner.anim.outMs / 1000 : 0.25), ease: 'easeInOut' } }}
                  className="fixed left-1/2 top-24 -translate-x-1/2 z-30 px-5 py-3 rounded-2xl bg-amber-500/20 border border-amber-300/50 backdrop-blur text-amber-200 shadow-xl">
                  <div className="text-xs tracking-widest">{state.fx.banner.title}</div>
                  <div className="text-lg font-extrabold">{state.fx.banner.sub}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Speed Challenge CTA and progress */}
            {!speedChallenge.active && speedChallenge.visible && (
              <div className="fixed bottom-24 right-4 z-30">
                <button onClick={startSpeedChallenge} className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm border border-cyan-300/50 shadow">
                  Démarrer défi de vitesse
                </button>
              </div>
            )}
            {speedChallenge.active && (
              <div className="fixed bottom-24 right-4 z-30 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-700 text-xs text-zinc-200 shadow">
                <div className="font-bold">Défi: {speedChallenge.clicks}/25</div>
                <div className="mt-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: Math.max(0, Math.min(100, Math.floor(((speedChallenge.until - Date.now())/20000)*100))) + '%' }} />
                </div>
              </div>
            )}
          </div>

          {/* Right panel with tabs */}
          <div className="rounded-2xl p-0 bg-zinc-900/60 border border-zinc-800 shadow-xl flex flex-col max-h-[520px] md:max-h-[620px] overflow-hidden">
            {/* Fixed tabs bar */}
            <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur px-3 py-2 border-b border-zinc-800 flex gap-1 text-xs" role="tablist" aria-label="Navigation boutique">
              <button role="tab" aria-selected={tab==='shop'} onClick={() => setTab('shop')} className={"px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 " + (tab==='shop' ? 'bg-zinc-800 text-white' : 'bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800')}>Boutique</button>
              <button role="tab" aria-selected={tab==='auto'} onClick={() => setTab('auto')} className={"px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 " + (tab==='auto' ? 'bg-zinc-800 text-white' : 'bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800')}>Auto</button>
              <button role="tab" aria-selected={tab==='upgrades'} onClick={() => setTab('upgrades')} className={"px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 " + (tab==='upgrades' ? 'bg-zinc-800 text-white' : 'bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800')}>Améliorations</button>
              <button role="tab" aria-selected={tab==='skins'} onClick={() => setTab('skins')} className={"px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 " + (tab==='skins' ? 'bg-zinc-800 text-white' : 'bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800')}>Skins</button>
            </div>
            <div className="p-4 flex-1 overflow-auto">

            {(tab === 'shop' || tab === 'auto') && (
              <Shop
                state={state}
                ITEMS={ITEMS}
                buy={buy}
                costOf={costOf}
                perItemMult={perItemMult}
                fmt={fmt}
                clamp={clamp}
                tutorialStep={tutorialStep}
                modeFilter={tab}
              />
            )}

            {tab === 'upgrades' && (
              <Upgrades
                state={state}
                UPGRADES={UPGRADES}
                buyUpgrade={buyUpgrade}
                canBuyUpgrade={canBuyUpgrade}
                ITEMS={ITEMS}
                fmt={fmt}
                stake={stake}
                unstake={unstake}
                cryptoFlash={cryptoFlash}
              />
            )}

            {tab === 'skins' && (
              <Skins
                state={state}
                SKINS={SKINS}
                selectSkin={selectSkin}
                buySkin={buySkin}
                fmt={fmt}
              />
            )}
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
                <div
                  key={a.id}
                  className={(state.unlocked[a.id]
                    ? "p-2 rounded-lg border text-center text-xs bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                    : "p-2 rounded-lg border text-center text-xs bg-zinc-900/40 border-zinc-800 text-zinc-500")}
                >
                  {a.name}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4 bg-zinc-900/60 border border-zinc-800">
            <div className="text-sm font-semibold text-zinc-300">Infos & astuces</div>
            <ul className="mt-2 text-xs text-zinc-400 space-y-1 list-disc list-inside">
              <li>Les <b>cookies dorés</b> apparaissent au hasard. Clique vite !</li>
              {/* Rush combo supprimé */}
              <li>Les <b>soldes flash</b> arrivent si tu stagne trop longtemps.</li>
              <li>Les <b>améliorations</b> et les <b>synergies</b> gardent utiles les vieux bâtiments.</li>
              <li>Faucet <b>CRMB</b> : 0.001 / 20 000 cookies. Stake tes CRMB pour booster tout !</li>
              <li>Hors-ligne : 10% sur 10 min, décroissance vers 3% (cap 2h).</li>
              <li><b>Cookies mangés</b> : chaque portion croquée offre un bonus immédiat (parfois massif) et progresse vers des surprises visuelles. Clique souvent et vise les bonus pour accélérer.</li>
            </ul>
          </div>
        </div>

        {/* Toasts */}
        <div className="fixed right-4 bottom-4 z-50 space-y-2">
          <AnimatePresence>
            {state.toasts.map((t) => {
              const clsBase = "px-3 py-2 rounded-lg text-sm shadow border ";
              const clsTone = t.tone === 'success'
                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                : (t.tone === 'warn' ? "bg-red-500/20 border-red-400/40 text-red-200" : "bg-zinc-800/80 border-zinc-700 text-zinc-100");
              return (
                <motion.div key={t.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className={clsBase + clsTone}>
                  {t.msg}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Intro Overlay */}
      <AnimatePresence>
        {!state.ui.introSeen && !tutorialInteract && (
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
                  style={{ top: (c.top) + '%', left: (c.left) + '%', fontSize: c.size }}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: ["0%", "-20%", "0%"], opacity: [0.1, 0.6, 0.1] }}
                  transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                >
                  🍪
                </motion.div>
              ))}
            </div>
            <div className="relative h-full w-full flex flex-col items-center justify-center text-center px-6">
              {tutorialStep === 0 && (
                <>
                  <motion.h1 id="intro-title" initial={{ scale: 0.8, rotateX: 25, opacity: 0 }} animate={{ scale: 1, rotateX: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }} className="text-6xl md:text-7xl font-extrabold tracking-tight text-amber-300 drop-shadow">COOKIE CRAZE</motion.h1>
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="mt-3 text-zinc-300 max-w-xl">Bienvenue ! Fais cuire des cookies et améliore‑toi pour aller à l'infini.</motion.div>
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setTutorialStep(1)} className="px-6 py-3 rounded-2xl bg-amber-500/90 hover:bg-amber-400 text-zinc-900 font-bold border border-amber-200 shadow-xl">Commencer</button>
                    <button onClick={skipIntro} className="px-4 py-3 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-100 border border-zinc-700">Ignorer</button>
                  </div>
                </>
              )}
              {tutorialStep === 1 && (
                <>
                  <div className="text-3xl font-extrabold text-amber-300">1) Tape sur le gros cookie</div>
                  <div className="mt-2 text-zinc-300 max-w-xl">Clique le cookie central <b>5 fois</b> pour passer à l'étape suivante.</div>
                  <div className="mt-3 text-xs text-zinc-400">Astuce: essaie maintenant, la progression se mettra à jour.</div>
                  <button onClick={() => setTutorialInteract(true)} className="mt-6 px-6 py-3 rounded-2xl bg-amber-500/90 hover:bg-amber-400 text-zinc-900 font-bold border border-amber-200 shadow-xl">Cliquer le cookie</button>
                </>
              )}
              {tutorialStep === 2 && (
                <>
                  <div className="text-3xl font-extrabold text-amber-300">2) Achète des multiplicateurs</div>
                  <div className="mt-2 text-zinc-300 max-w-xl">Ouvre la Boutique et achète un item de <b>clic</b> (p.ex. Curseur). L'étape avançera après l'achat.</div>
                  <div className="mt-5 flex gap-3">
                    <button onClick={() => { setTutorialInteract(true); setTab('shop'); }} className="px-6 py-3 rounded-2xl bg-amber-500/90 hover:bg-amber-400 text-zinc-900 font-bold border border-amber-200 shadow-xl">Ouvrir la Boutique</button>
                  </div>
                </>
              )}
              {tutorialStep === 3 && (
                <>
                  <div className="text-3xl font-extrabold text-amber-300">3) Découvre les skins ✨</div>
                  <div className="mt-2 text-zinc-300 max-w-xl">Personnalise ton cookie : couleurs, styles, et plus. Ouvre l'onglet <b>Skins</b> pour voir.</div>
                  <div className="mt-5 flex gap-3">
                    <button onClick={() => { setTutorialInteract(true); setTab('skins'); }} className="px-6 py-3 rounded-2xl bg-amber-500/90 hover:bg-amber-400 text-zinc-900 font-bold border border-amber-200 shadow-xl">Voir Skins</button>
                  </div>
                </>
              )}
              {tutorialStep === 4 && (
                <>
                  <div className="text-3xl font-extrabold text-amber-300">Bonne chance !</div>
                  <div className="mt-2 text-zinc-300 max-w-xl">Tu es prêt. Clique, achète, progresse et vise l'infini ✨</div>
                  <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.96, rotateX: 20 }}
                    animate={{ opacity: 1, y: [18, -6, 0], scale: [0.96, 1.05, 1], rotateX: [20, 6, 0] }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                    className="mt-4 px-6 py-3 rounded-3xl bg-amber-500/20 border border-amber-300/50 text-amber-300 font-extrabold text-2xl shadow-xl backdrop-blur-sm drop-shadow"
                  >
                    Bon jeu et bon appétit 🍪
                  </motion.div>
                  <div className="mt-5 flex gap-3">
                    <button onClick={() => { setTab('shop'); setTutorialInteract(true); }} className="px-6 py-3 rounded-2xl bg-amber-500/90 hover:bg-amber-400 text-zinc-900 font-bold border border-amber-200 shadow-xl">Aller à la Boutique</button>
                    <button onClick={skipIntro} className="px-6 py-3 rounded-2xl bg-emerald-500/90 hover:bg-emerald-400 text-zinc-900 font-bold border border-emerald-200 shadow-xl">Jouer</button>
                  </div>
                </>
              )}
              <button aria-pressed={state.ui.sounds} onClick={() => setState(s => ({ ...s, ui: { ...s.ui, sounds: !s.ui.sounds } }))} className="mt-6 text-xs px-3 py-1 rounded-xl bg-zinc-800/70 border border-zinc-700">
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

  // Skins migration (compat anciennes saves)
  merged.skin = merged.skin || "default";
  merged.skinsOwned = { default: true, ice: false, fire: false, ...(merged.skinsOwned || {}) };

  // Feature flags defaults
  merged.cookieEatEnabled = merged.cookieEatEnabled ?? true;
  merged.cookieEatenCount = merged.cookieEatenCount ?? 0;
  merged.cookieBites = Array.isArray(merged.cookieBites) ? merged.cookieBites : [];

  merged.version = 4;
  return merged;
}
