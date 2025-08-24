import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Tooltip from "./Tooltip.jsx";
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
import { useAutosave } from "../hooks/useAutosave.js";
import { useGameLoop } from "../hooks/useGameLoop.js";
import { useCrypto } from "../hooks/useCrypto.js";
import { useToast } from "../hooks/useToast.js";
import { useFlyingCookie } from "../hooks/useFlyingCookie.js";
import { useCookieRain } from "../hooks/useCookieRain.js";
import { useGoldenEvents } from "../hooks/useGoldenEvents.js";
import { useParticles } from "../hooks/useParticles.js";
import { useCountdown } from "../hooks/useCountdown.js";
import { fmt, fmtInt, clamp } from "../utils/format.js";
import { 
  FEATURES, 
  loadState, 
  migrate, 
  saveState, 
  isFeatureEnabled, 
  withFeatureFlag,
  createResetState,
  createIncompleteSave,
  createCorruptedSave,
  SAVE_KEY,
  PENDING_RESET_KEY
} from "../utils/state.js";
// Import des tests en mode DEV uniquement
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  import("../utils/test-scenarios.js");
  import("../utils/timer-test.js");
  import("../utils/test-rewards.js");
  import("../utils/test-tooltips.js");
  import("../utils/test-mission-exclusivity.js");
  import("../utils/juicy-demo.js");
  import("../utils/skin-test.js");
  import("../utils/tabs-test.js");
  import("../utils/golden-test.js");
}

// Helpers calcul déportés dans utils/calc.js

// === Skins ===
const SKINS = {
  default: { id: "default", name: "Choco",   price: 0,       src: "/cookie.png" },
  starter: { id: "starter", name: "Starter", price: 1_000,   src: "/cookie-caramel.png", className: "saturate-110 hue-rotate-[12deg] brightness-110", description: "Ton premier skin personnalisé !" },
  early:   { id: "early",   name: "Early",   price: 10_000,  src: "/cookie-noir.png", className: "brightness-[0.95] contrast-115 sepia-[0.1]", description: "Pour les joueurs ambitieux" },
  caramel: { id: "caramel", name: "Caramel", price: 50_000,  src: "/cookie-caramel.png", className: "saturate-125 hue-rotate-[18deg]", description: "Douceur caramélisée" },
  noir:    { id: "noir",    name: "Noir",    price: 200_000, src: "/cookie-noir.png", className: "brightness-[0.92] contrast-125", description: "Élégance sombre" },
  ice:     { id: "ice",     name: "Ice",     price: 500_000, src: "/cookie-ice.png", description: "Fraîcheur glaciale" },
  fire:    { id: "fire",    name: "Lava",    price: 2_000_000, src: "/cookie-fire.png", description: "Puissance volcanique" },
};

// === Game Data ===
// DEFAULT_STATE et constantes déplacées vers src/utils/state.js

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

// === Timer Announcer pour l'accessibilité ===
function TimerAnnouncer() {
  return (
    <div 
      id="timer-announcer"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}

// === Timer Component pour Micro-missions ===
function MicroMissionTimer({ endTimestamp }) {
  const { remainingMs, percentage, isActive, timeText } = useCountdown(endTimestamp);
  
  if (!isActive) return null;
  
  return (
    <div className="mt-1.5 space-y-1">
      {/* Compteur de temps */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-yellow-300 font-mono">⏱️ Temps restant</span>
        <span className="text-xs font-bold text-yellow-200 font-mono" aria-live="polite">
          {timeText}
        </span>
      </div>
      
      {/* Barre de timer qui se vide */}
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden" 
           aria-label={`Timer: ${timeText} restant`} 
           role="progressbar" 
           aria-valuemin={0} 
           aria-valuemax={100} 
           aria-valuenow={Math.round(100 - percentage)}>
        <div 
          className="h-full bg-gradient-to-r from-yellow-400 to-red-500 transition-all duration-200 ease-linear" 
          style={{ width: Math.max(0, 100 - percentage) + '%' }}
        />
      </div>
    </div>
  );
}

// === Component ===
export default function CookieCraze() {
  const [state, setState] = useState(() => loadState());
  const soundsEnabled = isFeatureEnabled('ENABLE_SOUNDS') && state.ui.sounds;
  const { ping, crunch, dispose } = useAudio(soundsEnabled);
  const { play } = useSound(soundsEnabled);
  const { toast } = useToast(setState);
  const [previewSkin, setPreviewSkin] = useState(null);
  const [viewKey, setViewKey] = useState(0); // force remount on reset
  
  // Listen for skin preview events from Skins component
  useEffect(() => {
    const handleSkinPreview = (event) => {
      setPreviewSkin(event.detail);
    };
    
    window.addEventListener('skinPreview', handleSkinPreview);
    return () => window.removeEventListener('skinPreview', handleSkinPreview);
  }, []);
  const [tab, setTab] = useState('shop');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialInteract, setTutorialInteract] = useState(false);
  const tutorialClicksBase = useRef(0);
  const tutorialManualBuyBase = useRef(0);
  const tutorialVisitedSkins = useRef(false);
  useEffect(() => {
    const onKeyDown = (e) => {
      // Escape pour fermer le menu
      if (e.key === 'Escape') {
        setShowMenu(false);
        return;
      }
      
      // Raccourcis clavier pour les onglets (Ctrl/Cmd + 1-4)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            setTab('shop');
            break;
          case '2':
            e.preventDefault();
            setTab('auto');
            break;
          case '3':
            e.preventDefault();
            setTab('upgrades');
            break;
          case '4':
            if (isFeatureEnabled('ENABLE_SKINS')) {
              e.preventDefault();
              setTab('skins');
            }
            break;
        }
      }
    };
    
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  // Autosave via hook
  useAutosave(state, saveState);

  // Main loop via hook avec accumulation/commit
  useGameLoop(state, setState, { tickMs: 300, commitEveryMs: 600 });

  // Intro gate + offline progress + schedulers
  useEffect(() => {
    // Applique un reset différé (si rechargé après reset)
    try {
      const raw = sessionStorage.getItem(PENDING_RESET_KEY);
      if (raw) {
        const { preserve, prestige, sounds } = JSON.parse(raw);
        sessionStorage.removeItem(PENDING_RESET_KEY);
        setState(() => createResetState(preserve, !!sounds, preserve ? (prestige || 0) : 0));
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
    if (isFeatureEnabled('ENABLE_EVENTS')) {
    scheduleGolden();
      if (isFeatureEnabled('ENABLE_RAIN')) scheduleRain();
    }
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
        // Mission completed effects
        try { play('/sounds/golden_appear.mp3', 0.8); } catch {} // Mission success sound
        if (isFeatureEnabled('ENABLE_RAF_PARTICLES')) {
          burstParticles(80); // Confetti-like effect
        }
        ping(1200, 0.15); // High-pitched success ping
        
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
  const microMissionsEnabled = isFeatureEnabled('ENABLE_MICRO_MISSIONS');
  useMicroMissions(microMissionsEnabled ? state : null, microMissionsEnabled ? setState : () => {}, microMissionsEnabled ? toast : () => {});

  // Toast via hook
  
  // Particules/FX via hook (doit être initialisé avant les événements golden qui l'utilisent)
  const { particles, setParticles, crumbs, setCrumbs, cookieWrapRef, burstParticles, burstCrumbs } = useParticles(cpc, fmt);

  // Helper commun pour appliquer un buff (utilisé par divers hooks)
  const applyBuff = ({ cpsMulti = 1, cpcMulti = 1, seconds = 10, label = "" }) => {
    const until = Date.now() + seconds * 1000;
    setState((s) => ({ ...s, buffs: { cpsMulti, cpcMulti, until, label } }));
  };

  // Golden events via hook (utilise burstParticles)
  const { showGolden, setShowGolden, goldenRef, onGoldenClick, scheduleGolden } = useGoldenEvents(state, setState, { isFeatureEnabled, toast, burstParticles, ping, play, cpc });

  // Cookie Rain & Flying Cookie via hooks
  const { rainCrumbs, rainUntil, scheduleRain, startRain, onCrumbClick } = useCookieRain(cpc, ping, setState);
  const { flyingCookie, setFlyingCookie, onFlyingCookieClick } = useFlyingCookie(play, applyBuff, toast, setState);
  const [speedChallenge, setSpeedChallenge] = useState({ idleSince: Date.now(), visible: false, active: false, clicks: 0, until: 0 });

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
  // Purchase flash animation state
  const [purchaseFlash, setPurchaseFlash] = useState({});
  
  const buy = (id, count = 1) => {
    const it = ITEMS.find((x) => x.id === id);
    const price = costOf(id, count);
    if (state.cookies < price) {
      // Failed purchase sound
      try { play('/crunch.mp3', 0.15); } catch {}
      return toast("Pas assez de cookies…", "warn");
    }

    // Purchase success sound
    try { play('/crunch-1.mp3', 0.4); } catch {}
    
    // Purchase flash animation
    setPurchaseFlash(prev => ({ ...prev, [id]: Date.now() }));
    setTimeout(() => {
      setPurchaseFlash(prev => {
        const newFlash = { ...prev };
        delete newFlash[id];
        return newFlash;
      });
    }, 300);

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
    
    // Big purchase extra sound
    if (big) {
      try { play('/crunch-2.mp3', 0.6); } catch {}
    }

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

  // Crypto stake/unstake via hook
  const { stake, unstake } = useCrypto(setState);

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
    if (state.cookies < skin.price) {
      try { play('/crunch.mp3', 0.15); } catch {}
      return toast("Pas assez de cookies…", "warn");
    }

    // Purchase success effects
    try { play('/crunch-1.mp3', 0.5); } catch {}
    ping(1000, 0.1);
    if (isFeatureEnabled('ENABLE_RAF_PARTICLES')) {
      burstParticles(20);
    }

    setState((s) => ({
      ...s,
      cookies: s.cookies - skin.price,
      skinsOwned: { ...s.skinsOwned, [skinId]: true },
    }));
    toast(`Nouveau skin débloqué: ${skin.name}`, "success");
  };

  const selectSkin = (skinId) => {
    if (!state.skinsOwned[skinId]) return toast("Skin non débloqué", "warn");
    
    // Skin equip sound
    try { play('/sounds/golden_appear.mp3', 0.3); } catch {}
    ping(800, 0.08);
    
    setState((s) => ({ ...s, skin: skinId }));
    toast(`Skin équipé: ${SKINS[skinId]?.name}`, "success");
  };

  // Particules/FX via hook (déjà initialisé plus haut)

  // Big cookie click with enhanced feedback
  const [cookieScale, setCookieScale] = useState(1);
  const [cookieRotation, setCookieRotation] = useState(0);
  const cookieClickAnimRef = useRef(null);
  const clickFxCounterRef = useRef(0);
  
  const onCookieClick = () => {
    // Audio feedback
    crunch();
    try { play('/crunch.mp3', 0.3); } catch {}
    
    // Visual feedback - cookie animation
    if (cookieClickAnimRef.current) {
      clearTimeout(cookieClickAnimRef.current);
    }
    
    // Animation: scale + rotation temporaire, puis retour à l'état de base
    setCookieScale(1.1);
    const randomRotation = Math.random() > 0.5 ? 15 : -15;
    setCookieRotation(randomRotation);
    
    cookieClickAnimRef.current = setTimeout(() => {
      setCookieScale(1);
      setCookieRotation(0); // Retour à la position de base (0°)
    }, 150);
    
    setState((s) => {
      const gain = cpc;
      return { ...s, cookies: s.cookies + gain, lifetime: s.lifetime + gain, stats: { ...s.stats, clicks: s.stats.clicks + 1 } };
    });
    if (isFeatureEnabled('ENABLE_RAF_PARTICLES')) {
      clickFxCounterRef.current = (clickFxCounterRef.current + 1) % 5;
      if (clickFxCounterRef.current === 0) {
        burstParticles(1, null, `+${cpc.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
      }
      burstCrumbs(2);
    }
  };

  // --- Cookie eaten handler + progress tracking ---
  const onCookieEaten = () => {
    let shouldSpawnGolden = false;
    setState((s) => {
      const count = (s.cookieEatenCount || 0) + 1;
      let bonus = 0;
      if (count === 1) bonus = cpc * 50;
      else if (count % 5 === 0) bonus = cpc * 100;
      else bonus = cpc * 10;
      const cookies = s.cookies + bonus;
      if (isFeatureEnabled('ENABLE_EVENTS') && (count % 2 === 0)) shouldSpawnGolden = true;
      toast(`🍪 Cookie mangé ! +${fmt(bonus)}`, "success");
      return { ...s, cookies, lifetime: s.lifetime + bonus, cookieEatenCount: count, cookieBites: [] };
    });
    if (shouldSpawnGolden) {
      try { play('/sounds/golden_appear.mp3', 0.25); } catch {}
      setState((s) => ({
        ...s,
        fx: {
          ...s.fx,
          banner: { title: 'Cookie doré !', sub: 'Clique vite ✨', until: Date.now() + 1400, anim: { style: 'slide', inMs: 160, outMs: 160 } },
        },
      }));
      setShowGolden(true);
    }
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
    setState(() => createResetState(preserve, sounds, preserve ? chips : 0));

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
    <div key={viewKey} id="game-area" className={(state.ui.highContrast ? "high-contrast " : "") + "min-h-screen w-full bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 text-amber-950 select-none overflow-hidden"}>
      {/* Composant d'accessibilité pour les annonces de timer */}
      <TimerAnnouncer />
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🍪</div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cookie Craze</h1>
          </div>
          <div className="relative flex items-center gap-4 text-sm flex-wrap pr-12 md:pr-16">
            <span className="px-2 py-1 rounded-full badge-warm">Clic: <b>{cpc.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</b></span>
            <span className="px-2 py-1 rounded-full badge-warm">Auto: <b>{fmt(cpsWithBuff)}</b> CPS</span>
            <Tooltip
              className="inline-block"
              position="bottom"
              panel={(
                <div className="space-y-1">
                  <div className="font-semibold">Prestige</div>
                  <div className="text-zinc-300">Gagne des « chips célestes » en prestige. Chaque chip = +2% production permanente. Débloqué quand tu as assez en banque.</div>
                </div>
              )}
            >
              <span className="px-2 py-1 rounded-full badge-warm cursor-help">Prestige: <b>{state.prestige.chips}</b></span>
            </Tooltip>
            <Tooltip
              className="inline-block"
              position="bottom"
              panel={(
                <div className="space-y-1">
                  <div className="font-semibold">CRMB (CrumbCoin)</div>
                  <div className="text-zinc-300">Le faucet crédite des CRMB selon les cookies cuits (0.001 / 20k). Stake des CRMB pour +50% d’effet par unité stakée sur toute la production.</div>
                </div>
              )}
            >
              <span className={`${cryptoFlash ? "bg-emerald-600/30 border-emerald-400/60 badge-glow" : "badge-warm"} px-2 py-1 rounded-full border cursor-help`}>CRMB: <b>{(state.crypto.balance || 0).toFixed(3)}</b></span>
            </Tooltip>
            <button
              onClick={() => setShowMenu(v => !v)}
              aria-haspopup="menu"
              aria-expanded={showMenu}
              className="absolute right-0 -top-1 md:top-0 rounded-lg px-3 py-2 bg-white/90 backdrop-blur border border-amber-300/50 text-sm shadow-lg hover:shadow-xl hover:bg-white transition-all"
            >⚙️</button>
            {showMenu && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 rounded-xl bg-white/95 backdrop-blur-md border border-amber-200/50 shadow-2xl z-50"
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  role="menuitem"
                  onClick={() => setState(s => ({ ...s, ui:{...s.ui, sounds: !s.ui.sounds} }))}
                  className="w-full text-left px-4 py-3 hover:bg-amber-100 text-amber-900 transition-colors first:rounded-t-xl"
                >
                  {state.ui.sounds ? "🔊 Sons ON" : "🔈 Sons OFF"}
                </button>
                <button
                  role="menuitem"
                  onClick={() => setState(s => ({ ...s, ui:{...s.ui, highContrast: !s.ui.highContrast} }))}
                  className="w-full text-left px-4 py-3 hover:bg-amber-100 text-amber-900 transition-colors"
                >
                  {state.ui.highContrast ? "🟨 Contraste élevé ON" : "⬜ Contraste élevé OFF"}
                </button>

                <button
                  role="menuitem"
                  onClick={() => { setShowAdvanced(v => !v); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-amber-100 text-amber-900 transition-colors"
                >
                  🛠️ Avancé
                </button>

                <button
                  role="menuitem"
                  onClick={hardReset}
                  className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-100 transition-colors last:rounded-b-xl"
                >
                  ♻️ Reset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top Stats */}
        <div className={"mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 " + (shaking ? "animate-[wiggle_0.7s_ease]" : "")}>
          <div className="md:col-span-2 rounded-2xl p-5 md:p-6 glass-warm shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="text-base md:text-xl text-amber-900 font-medium">Cookies en banque</div>
              <div className="text-5xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500 value-highlight">{fmtInt(state.cookies)}</div>
              <div className="text-sm text-amber-800/80 flex items-center gap-1">Cuits au total: <span className="font-semibold text-amber-900">{fmtInt(state.lifetime)}</span>{baseCpsNoBuff > 0 ? (<span className="text-amber-700"> · {fmt(baseCpsNoBuff)} CPS</span>) : ''}
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
                <div className="mt-2 flex items-center gap-2 justify-center text-xs flex-wrap">
                  <button onClick={exportSave} className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700">💾 Export</button>
                  <label className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer">📥 Import
                    <input type="file" accept=".json,.txt" className="hidden" onChange={(e) => e.target.files && importSave(e.target.files[0])} />
                  </label>
                  
                  {/* Dev Tools */}
                  {(import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') && (
                    <>
                      <button 
                        onClick={() => {
                          try {
                            localStorage.removeItem(SAVE_KEY);
                            window.location.reload();
                          } catch {}
                        }}
                        className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 border border-red-400 text-red-100"
                        title="Supprime la sauvegarde et recharge la page"
                      >
                        🔄 Reset Save
                      </button>
                      <button 
                        onClick={() => {
                          try {
                            const incompleteSave = createIncompleteSave();
                            localStorage.setItem(SAVE_KEY, JSON.stringify(incompleteSave));
                            window.location.reload();
                          } catch {}
                        }}
                        className="px-2 py-1 rounded-lg bg-yellow-600 hover:bg-yellow-500 border border-yellow-400 text-yellow-100"
                        title="Charge une sauvegarde incomplète pour tester la migration"
                      >
                        📝 Test Migration
                      </button>
                      <button 
                        onClick={() => {
                          try {
                            const corruptedSave = createCorruptedSave();
                            localStorage.setItem(SAVE_KEY, corruptedSave);
                            window.location.reload();
                          } catch {}
                        }}
                        className="px-2 py-1 rounded-lg bg-red-800 hover:bg-red-700 border border-red-600 text-red-100"
                        title="Charge une sauvegarde corrompue pour tester le fallback"
                      >
                        💥 Test Corrupted
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Compteur de cookies mangés */}
            <div className="mt-4 mb-1 w-full max-w-md mx-auto text-left">
              <div className="text-xs md:text-sm text-zinc-400">
                {/* Intentionnellement discret en haut; une version plus visible est en bas-gauche */}
              </div>
            </div>



            {/* Big Cookie */}
            <div ref={cookieWrapRef} className="-mt-9 relative flex items-center justify-center">
              {/* Wrapper carré aux dimensions du cookie */}
              <div className="relative h-96 w-96 md:h-[32rem] md:w-[32rem] float-animation">
                {/* Glow ambiant */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-orange-500/10 to-transparent rounded-full blur-3xl cookie-glow pulse-animation"></div>
                {/* welcome.png au-dessus du cookie quand fx.tag est actif */}
                {state.fx.tag && Date.now() < state.fx.tag.until && state.fx.tag.image && (
                  <img
                    src={state.fx.tag.image}
                    alt="Bienvenue"
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] md:w-[200%] max-w-[960px] drop-shadow-2xl z-10"
                  />
                )}

                <motion.div
                  ref={cookieWrapRef}
                  animate={{ 
                    scale: cookieScale,
                    rotate: cookieRotation
                  }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 500, 
                    damping: 30 
                  }}
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
                      className={"h-full w-full cursor-pointer select-none drop-shadow-xl cookie-hover " + skinClass}
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

            {/* Golden Cookie déplacé hors du conteneur animé pour éviter les problèmes de stacking/fixed */}

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

            {/* Micro‑mission floating badge (visibility) */}
            {isFeatureEnabled('ENABLE_MICRO_MISSIONS') && state.activeMicroMission && (
              <div className="fixed top-24 right-4 z-30 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-400/50 text-xs text-emerald-100 shadow">
                {(() => {
                  const cur = MICRO_MISSIONS.find(m => m.id === state.activeMicroMission?.id);
                  const pct = Math.min(100, Math.floor(((state.activeMicroMission?.progress||0) / Math.max(1,(state.activeMicroMission?.target||1))) * 100));
                  return (
                    <>
                      <div className="font-bold">🎯 {cur?.title || 'Micro‑mission'}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-emerald-900/40 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: pct + '%' }} />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Golden Cookie (overlay fixed) */}
            <AnimatePresence>
              {showGolden && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={onGoldenClick}
                  className="fixed z-30 h-16 w-16 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 border-4 border-yellow-200 shadow-xl"
                  style={{ left: goldenRef.current.left, top: goldenRef.current.top }}
                >
                  <div className="absolute inset-0 rounded-full" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 40%)" }} />⭐
                </motion.button>
              )}
            </AnimatePresence>

            {/* Speed Challenge CTA and progress */}
            {!speedChallenge.active && speedChallenge.visible && (
              <div className="fixed bottom-24 right-4 z-30">
                <button onClick={startSpeedChallenge} className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm border border-cyan-300/50 shadow relative group" title="Objectif: 25 clics en 20s. Récompense: +20% CPC (20s)">
                  ⚡ Défi: 25 clics en 20s
                  <span className="pointer-events-none absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 transition px-3 py-2 rounded-md bg-zinc-900/90 border border-zinc-700 text-xs w-60 text-left">Récompense: +20% CPC pendant 20s</span>
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
          <div className="rounded-2xl p-0 glass-warm shadow-xl flex flex-col max-h-[520px] md:max-h-[620px] overflow-hidden">
            
            {/* Missions en haut du panneau de droite */}
            <div className="px-4 py-3 border-b border-amber-200/30 space-y-2 bg-gradient-to-b from-amber-50/50 to-transparent">
              {/* Mission en cours */}
              {isFeatureEnabled('ENABLE_MISSIONS') && (
                <div className="rounded-lg border border-amber-300/50 bg-white/80 backdrop-blur p-3 shadow-sm">
                  <div className="text-xs text-amber-700 font-semibold">Mission</div>
                  <div className="text-sm font-bold text-amber-950">{(MISSIONS.find(m => m.id === state.mission?.id)?.title) || "—"}</div>
                  <div className="text-xs text-amber-800/80 leading-tight">{(MISSIONS.find(m => m.id === state.mission?.id)?.desc) || "—"}</div>
                  <div className="mt-2 h-2 rounded-full bg-amber-200/50 overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500" style={{ width: (Math.min(100, Math.floor(((state.mission?.progress||0) / Math.max(1,(state.mission?.target||1))) * 100))) + '%' }} />
            </div>
                </div>
              )}

              {/* Micro‑mission (prioritaire à l'affichage si présente) */}
              {isFeatureEnabled('ENABLE_MICRO_MISSIONS') && state.activeMicroMission && (
                <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/80 backdrop-blur p-3 shadow-sm">
                  <div className="text-xs text-emerald-700 font-semibold">Micro‑mission</div>
                  {(() => {
                    const cur = MICRO_MISSIONS.find(m => m.id === state.activeMicroMission?.id);
                    const pct = Math.min(100, Math.floor(((state.activeMicroMission?.progress||0) / Math.max(1,(state.activeMicroMission?.target||1))) * 100));
                    
                    // Timer pour missions chronométrées
                    const isTimedMission = cur?.checkTimed && state.activeMicroMission?.meta?.until;
                    const timerEndTimestamp = isTimedMission ? state.activeMicroMission.meta.until : null;
                    
                    return (
                      <>
                        <div className="text-sm font-bold text-emerald-950">{cur?.title || "—"}</div>
                        {cur?.desc && <div className="text-xs text-emerald-800/80 leading-tight">{cur.desc}</div>}
                        
                        {/* Barre de progression normale */}
                        <div className="mt-2 h-2 rounded-full bg-emerald-200/50 overflow-hidden shadow-inner" aria-label="Progression micro‑mission" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} role="progressbar">
                          <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500" style={{ width: pct + '%' }} />
                        </div>
                        
                        {/* Timer pour missions chronométrées */}
                        {isTimedMission && <MicroMissionTimer endTimestamp={timerEndTimestamp} />}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Fixed tabs bar - Mobile responsive with horizontal scroll */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-amber-200/30 shadow-sm" role="tablist" aria-label="Navigation boutique">
              <div className="flex gap-1 px-3 py-2 text-xs overflow-x-auto scrollbar-hide snap-x snap-mandatory">
                <button 
                  role="tab" 
                  aria-selected={tab==='shop'} 
                  onClick={() => setTab('shop')} 
                  className={`flex-shrink-0 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-200 snap-start font-medium ${
                    tab==='shop' 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' 
                      : 'bg-amber-100/50 text-amber-800 hover:bg-amber-200/70 hover:text-amber-900'
                  }`}
                >
                  🛍️ Boutique
                </button>
                <button 
                  role="tab" 
                  aria-selected={tab==='auto'} 
                  onClick={() => setTab('auto')} 
                  className={`flex-shrink-0 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-200 snap-start font-medium ${
                    tab==='auto' 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' 
                      : 'bg-amber-100/50 text-amber-800 hover:bg-amber-200/70 hover:text-amber-900'
                  }`}
                >
                  ⚙️ Auto
                </button>
                <button 
                  role="tab" 
                  aria-selected={tab==='upgrades'} 
                  onClick={() => setTab('upgrades')} 
                  className={`flex-shrink-0 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-200 snap-start font-medium ${
                    tab==='upgrades' 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' 
                      : 'bg-amber-100/50 text-amber-800 hover:bg-amber-200/70 hover:text-amber-900'
                  }`}
                >
                  ⬆️ Améliorations
                </button>
                {isFeatureEnabled('ENABLE_SKINS') && (
                  <button 
                    role="tab" 
                    aria-selected={tab==='skins'} 
                    onClick={() => setTab('skins')} 
                    className={`flex-shrink-0 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-200 snap-start font-medium ${
                      tab==='skins' 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' 
                        : 'bg-amber-100/50 text-amber-800 hover:bg-amber-200/70 hover:text-amber-900'
                    }`}
                  >
                    👔 Skins
                  </button>
                )}
              </div>
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
                purchaseFlash={purchaseFlash}
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

            {tab === 'skins' && isFeatureEnabled('ENABLE_SKINS') && (
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
        <div className="mt-8 md:mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
          <div className="lg:col-span-2 rounded-2xl p-5 md:p-6 glass-warm">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-amber-900">Succès</div>
              <div className="text-sm text-amber-700 font-medium">{Object.keys(state.unlocked).length}/{ACHIEVEMENTS.length}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {ACHIEVEMENTS.map((a) => (
                <div
                  key={a.id}
                  className={(state.unlocked[a.id]
                    ? "p-3 rounded-lg border-2 text-center text-xs bg-gradient-to-br from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-900 font-medium shadow-md"
                    : "p-3 rounded-lg border text-center text-xs bg-amber-50/50 border-amber-200/50 text-amber-400")}
                >
                  {a.name}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-5 md:p-6 glass-warm">
            <div className="text-lg font-bold text-amber-900">Infos & astuces</div>
            <ul className="mt-3 text-sm text-amber-800 space-y-2 list-disc list-inside">
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

// === Migration helper déplacée vers src/utils/state.js ===
