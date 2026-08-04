import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Shop from "./Shop.jsx";
import Upgrades from "./Upgrades.jsx";
import QuestBoard from "./QuestBoard.jsx";
import ParticleLayer from "./ParticleLayer.jsx";

// Panneaux rarement ouverts en début de partie: chargés à la demande pour
// alléger le premier rendu (utile sur mobile et connexion lente).
const Skins = lazy(() => import("./Skins.jsx"));
const CryptoPanel = lazy(() => import("./CryptoPanel.jsx"));
const PrestigePanel = lazy(() => import("./PrestigePanel.jsx"));
const StatsPanel = lazy(() => import("./StatsPanel.jsx"));
import CookieBiteMask from "./CookieBiteMask.jsx";
import Intro from "./Intro.jsx";

import { ITEMS } from "../data/items.js";
import { nextMilestone, tierThreshold } from "../data/upgrades.js";
import { SKINS } from "../data/skins.js";
import { PRESTIGE_BY_ID, availableChips, upgradeCost, chipsFor, prestigeEffects, PRESTIGE_MIN_LIFETIME } from "../data/prestige.js";
import tuning from "../data/tuning.json";

import { deriveStats, costOf, isEarlyWindow, timeToAfford, maxAffordable, COMBO, comboStep, comboProgress } from "../utils/selectors.js";
import { STEP } from "../utils/grid.js";
import { fmt, fmtInt, fmtCrmb, fmtDuration, fmtMult } from "../utils/format.js";
import {
  loadState,
  saveState,
  createResetState,
  isFeatureEnabled,
  exportSave as serializeSave,
  importSave as parseSave,
  SAVE_KEY,
  LEGACY_KEYS,
  PENDING_RESET_KEY,
} from "../utils/state.js";
import { buyPrice, sellPrice, minerCost, roundCrmb, getTier, MINERS } from "../utils/crypto.js";
import { buildContext } from "../quests/engine.js";

import { useAudio } from "../hooks/useAudio.js";
import { useNotify } from "../hooks/useNotify.js";
import { useGameLoop } from "../hooks/useGameLoop.js";
import { useAutosave } from "../hooks/useAutosave.js";
import { useQuests } from "../hooks/useQuests.js";
import { useEvents } from "../hooks/useEvents.js";
import { useAchievements } from "../hooks/useAchievements.js";
import { useCombo } from "../hooks/useCombo.js";
import { useClock, useTimeLeft } from "../hooks/useClock.js";
import { useLatestRef } from "../hooks/useLatestRef.js";

// Six onglets: production et clic partagent la boutique, et le profil regroupe
// statistiques, succès et apparences. Huit entrées débordaient de la barre.
const TABS = [
  { id: "shop", label: "Boutique", icon: "🛍️" },
  { id: "upgrades", label: "Améliorations", icon: "⬆️" },
  { id: "quests", label: "Quêtes", icon: "📜" },
  { id: "crypto", label: "CRMB", icon: "🪙", feature: "ENABLE_CRYPTO" },
  { id: "prestige", label: "Prestige", icon: "✨", feature: "ENABLE_PRESTIGE" },
  { id: "profile", label: "Profil", icon: "👤" },
];

// ============================================================================
// Petits composants isolés — ils consomment l'horloge sans re-rendre le jeu
// ============================================================================

/**
 * Jauge de combo.
 *
 * Toujours visible dès le premier clic et toujours en train de redescendre:
 * c'est le rappel permanent que s'arrêter de cliquer coûte quelque chose.
 */
const ComboMeter = memo(function ComboMeter({ display }) {
  const { streak, mult } = display;
  if (streak <= 0) return null;
  const cran = comboStep(streak);
  const plein = cran >= COMBO.steps;
  // La barre montre l'avancée vers le CRAN suivant, pas vers le maximum: le
  // multiplicateur ne bouge qu'en franchissant un cran, autant montrer lequel.
  const pct = comboProgress(streak) * 100;

  return (
    <div className="mt-2 mx-auto w-full max-w-[15rem]">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-semibold text-amber-800">🔥 Combo</span>
        <span className={`font-black tabular-nums ${plein ? "text-orange-600" : "text-amber-700"}`}>
          ×{fmtMult(mult)}
          {!plein && <span className="ml-1 font-medium text-amber-600/70">→ ×{fmtMult(mult + STEP)}</span>}
        </span>
      </div>
      {/* Un segment par cran: on voit d'un coup d'œil combien il en reste. */}
      <div className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: COMBO.steps }, (_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-amber-100 overflow-hidden">
            <div
              className={`h-full transition-[width] duration-100 ease-linear ${
                plein ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-gradient-to-r from-amber-300 to-orange-400"
              }`}
              style={{ width: i < cran ? "100%" : i === cran ? `${pct}%` : "0%" }}
            />
          </div>
        ))}
      </div>
      <span className="sr-only" role="progressbar" aria-valuemin={0} aria-valuemax={COMBO.steps} aria-valuenow={cran}>
        Combo, cran {cran} sur {COMBO.steps}
      </span>
    </div>
  );
});

/**
 * Objectif permanent.
 *
 * Toujours quelque chose à viser: soit le prochain palier de bâtiment, soit le
 * temps restant avant le prochain achat. Le joueur n'est jamais devant un écran
 * sans horizon.
 */
const NextGoal = memo(function NextGoal({ state, stats }) {
  const goal = useMemo(() => nextMilestone(state), [state]);
  const cheapest = useMemo(() => {
    let best = null;
    for (const item of ITEMS) {
      const price = costOf(state, item.id, 1);
      if (price <= state.cookies) return null; // quelque chose est déjà achetable
      if (!best || price < best.price) best = { item, price };
    }
    return best;
  }, [state]);

  if (!goal && !cheapest) return null;

  return (
    <div className="mt-3 mx-auto max-w-sm rounded-xl bg-amber-100/60 border border-amber-200 px-3 py-2">
      {goal && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-amber-800 truncate">
            <span aria-hidden="true">{goal.item.emoji}</span> Prochain palier :{" "}
            <b className="tabular-nums">
              {goal.owned}/{goal.upgrade.threshold}
            </b>{" "}
            {goal.item.name}
          </span>
          <span className="shrink-0 font-bold text-emerald-700">{goal.upgrade.badge}</span>
        </div>
      )}
      {cheapest && (
        <div className="text-[11px] text-amber-700/90 mt-0.5">
          Prochain achat dans ~
          <b className="tabular-nums">{fmtDuration(timeToAfford(state, cheapest.price, stats, 5))}</b>
        </div>
      )}
    </div>
  );
});

const BuffBadge = memo(function BuffBadge({ buffs }) {
  const left = useTimeLeft(buffs?.until, 250);
  if (!buffs?.until || left <= 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="mt-2 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg"
    >
      <span className="animate-pulse">⚡</span>
      {buffs.label}
      <span className="tabular-nums opacity-90">{Math.ceil(left / 1000)}s</span>
    </motion.div>
  );
});

/**
 * L'unique notification du jeu.
 *
 * En haut, jamais en bas: la boutique et la navigation vivent sous le pouce et
 * rien ne doit les recouvrir. Un seul emplacement, donc pas de pile qui grandit.
 * Le niveau `major` a droit à une entrée plus franche — c'est ce qui distingue
 * une renaissance d'une sauvegarde exportée.
 */
const Notice = memo(function Notice({ notice, reducedMotion }) {
  const grand = notice?.level === "major";
  const tons = {
    success: "from-emerald-500 to-teal-500",
    warn: "from-rose-500 to-red-500",
    gold: "from-amber-400 to-orange-500",
    info: "from-stone-700 to-stone-800",
  };
  return (
    // Le centrage vit sur le conteneur, pas sur l'élément animé: Framer Motion
    // écrit `transform` en style inline et écrasait le `-translate-x-1/2` de la
    // classe, ce qui décalait la notification hors de l'écran à droite.
    <div className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex justify-center px-3 pointer-events-none">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            role="status"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: grand ? 0.8 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
            transition={
              reducedMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: grand ? 260 : 420, damping: grand ? 16 : 30 }
            }
            className={`max-w-md text-white text-center rounded-2xl shadow-2xl bg-gradient-to-r ${
              tons[notice.tone] || tons.info
            } ${grand ? "px-5 py-3.5 text-base font-black" : "px-4 py-2.5 text-sm font-semibold"}`}
          >
            {notice.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const Banner = memo(function Banner({ banner }) {
  const left = useTimeLeft(banner?.until, 200);
  return (
    <AnimatePresence>
      {banner && left > 0 && (
        <motion.div
          key={banner.until}
          initial={{ scale: 0.9, opacity: 0, y: -16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="fixed left-1/2 top-20 -translate-x-1/2 z-40 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xl text-center pointer-events-none"
        >
          <div className="text-[10px] uppercase tracking-[0.2em] opacity-90">{banner.title}</div>
          <div className="text-lg font-black leading-tight">{banner.sub}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

const OfflineModal = memo(function OfflineModal({ report, onClose }) {
  if (!report) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-title"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-6 shadow-2xl text-center"
      >
        <div className="text-5xl mb-2">🌙</div>
        <h2 id="offline-title" className="text-xl font-black text-amber-950">
          Bon retour !
        </h2>
        <p className="text-sm text-amber-800/80 mt-1">
          Ton empire a tourné pendant <b>{fmtDuration(report.durationMs)}</b>.
        </p>
        <div className="my-4 py-3 rounded-2xl bg-white/70 border border-amber-200">
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500 tabular-nums">
            +{fmtInt(report.cookies)}
          </div>
          <div className="text-xs text-amber-700">cookies produits</div>
          {report.crmb > 0 && (
            <div className="mt-1 text-xs text-cyan-700 font-semibold tabular-nums">
              +{fmtCrmb(report.crmb)} CRMB minés
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg hover:from-amber-400 hover:to-orange-400 transition-colors"
        >
          Encaisser
        </button>
      </motion.div>
    </motion.div>
  );
});

const HeaderStat = memo(function HeaderStat({ label, value, tone = "amber", title }) {
  const tones = {
    amber: "bg-amber-100/80 text-amber-900 border-amber-200",
    emerald: "bg-emerald-100/80 text-emerald-900 border-emerald-200",
    cyan: "bg-cyan-100/80 text-cyan-900 border-cyan-200",
    violet: "bg-violet-100/80 text-violet-900 border-violet-200",
  };
  return (
    <span
      title={title}
      className={`px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {label} <b className="tabular-nums">{value}</b>
    </span>
  );
});

// ============================================================================
// Composant principal
// ============================================================================

export default function CookieCraze() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("shop");
  const [previewSkin, setPreviewSkin] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [offlineReport, setOfflineReport] = useState(null);
  const [buyQty, setBuyQty] = useState(1);
  const [shopFilter, setShopFilter] = useState("all");

  const particlesRef = useRef(null);
  const bootedRef = useRef(false);
  // Les systèmes pilotés par minuterie lisent l'état ici plutôt que par
  // fermeture: ça évite de reconstruire leurs intervalles à chaque rendu.
  const stateRef = useLatestRef(state);

  const soundsOn = isFeatureEnabled("ENABLE_SOUNDS") && state.ui.sounds;
  const audio = useAudio(soundsOn, state.ui.volume ?? 0.6);
  const notify = useNotify(setState);

  const combo = useCombo();
  // Horloge partagée plutôt qu'un `Date.now()` au rendu: les buffs et la fenêtre
  // de début de partie expirent d'eux-mêmes, à la cadence de la boucle de jeu.
  const now = useClock(500);
  const stats = useMemo(() => deriveStats(state, now, combo.display.streak), [state, now, combo.display.streak]);
  const questCtx = useMemo(() => buildContext(state), [state]);
  const effects = useMemo(() => prestigeEffects(state), [state]);

  // --- Effets visuels: API stable partagée avec les hooks d'événements ------
  const fx = useMemo(
    () => ({
      banner: ({ title, sub, ms = 2000 }) =>
        setState((s) => ({ ...s, fx: { ...s.fx, banner: { title, sub, until: Date.now() + ms } } })),
      shake: (ms = 800) => setState((s) => ({ ...s, fx: { ...s.fx, shakeUntil: Date.now() + ms } })),
      burstGold: (n) => particlesRef.current?.burstGold(n),
      burstText: (n, text) => particlesRef.current?.burstText(n, text),
      burstCrumbs: (n) => particlesRef.current?.burstCrumbs(n),
    }),
    []
  );

  /**
   * Achat refusé: une secousse courte, aucun texte.
   *
   * « Pas assez de cookies » s'affichait neuf fois dans ce fichier, et c'était
   * la notification la plus fréquente du jeu — pour dire au joueur ce que le
   * bouton grisé lui disait déjà. Le geste échoue, on le sent, on passe.
   */
  const refuse = useCallback(() => {
    audio.play("error", 0.25);
    fx.shake(220);
  }, [audio, fx]);

  // --- Systèmes ------------------------------------------------------------
  useGameLoop(state, setState);
  useAutosave(state, saveState);

  const celebrate = useCallback(() => {
    particlesRef.current?.burstGold(24);
    audio.play("golden", 0.4);
  }, [audio]);

  const { reroll } = useQuests(state, setState, notify, celebrate);
  useAchievements(state, setState, notify, celebrate);

  const events = useEvents({ stateRef, setState, notify, fx, audio });

  // --- Démarrage: reset différé + progression hors-ligne --------------------
  // Cet effet fait exactement ce pour quoi les effets existent: se synchroniser
  // au montage avec deux sources externes (le stockage de session et l'horloge
  // murale). Il ne s'exécute qu'une fois, garde `bootedRef` comprise.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    // Un reset demandé avant rechargement s'applique ici
    try {
      const raw = sessionStorage.getItem(PENDING_RESET_KEY);
      if (raw) {
        sessionStorage.removeItem(PENDING_RESET_KEY);
        const payload = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- application d'un reset demandé avant rechargement
        setState(createResetState(payload));
        return;
      }
    } catch {
      // sessionStorage indisponible: aucun reset en attente à appliquer
    }

    const s = stateRef.current;
    const now = Date.now();
    const away = Math.max(0, now - (s.lastTs || now));
    if (away < 60_000 || s.flags?.offlineCollected) return;

    const cfg = tuning?.[tuning?.mode || "standard"]?.offline || {};
    const maxSeconds = cfg.max_seconds ?? 7200;
    const capped = Math.min(away / 1000, maxSeconds);
    // Rendement dégressif: généreux la première dizaine de minutes, faible ensuite
    const r0 = cfg.ratio_0_10min ?? 0.08;
    const r1 = cfg.ratio_2h ?? 0.02;
    const ratio = capped <= 600 ? r0 : r0 - (r0 - r1) * ((capped - 600) / Math.max(1, maxSeconds - 600));

    const derived = deriveStats(s, now);
    const cookies = derived.baseCps * capped * ratio * effects.offlineMult;
    const crmb = derived.miningRate * capped * 0.5;

    if (cookies < 1 && crmb <= 0) return;

    setState((prev) => ({
      ...prev,
      cookies: prev.cookies + cookies,
      lifetime: prev.lifetime + cookies,
      crypto: { ...prev.crypto, balance: roundCrmb((prev.crypto.balance || 0) + crmb) },
      flags: { ...prev.flags, offlineCollected: true },
    }));
    setOfflineReport({ durationMs: away, cookies, crmb });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Ventes flash --------------------------------------------------------
  useEffect(() => {
    const iv = setInterval(() => {
      setState((s) => {
        const now = Date.now();
        if (s.flags?.flash && now < s.flags.flash.until) return s;
        const idleFor = now - (s.stats?.lastPurchaseTs || s.createdAt || now);
        const early = isEarlyWindow(s, now);
        const threshold = early ? 30_000 : 75_000;
        if (idleFor < threshold) return s;

        const pick = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        return {
          ...s,
          flags: {
            ...s.flags,
            flash: { itemId: pick.id, discount: early ? 0.35 : 0.25, until: now + 25_000 },
          },
        };
      });
    }, 5_000);
    return () => clearInterval(iv);
  }, []);

  // --- Raccourcis clavier --------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      // Ne pas voler le clavier pendant la saisie d'un montant
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.ctrlKey || e.metaKey) {
        const index = Number(e.key) - 1;
        const enabled = TABS.filter((t) => !t.feature || isFeatureEnabled(t.feature));
        if (index >= 0 && index < enabled.length) {
          e.preventDefault();
          setTab(enabled[index].id);
        }
        return;
      }
      if (e.code === "Space" && !state.ui.introSeen) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.ui.introSeen]);

  // --- Fermeture du menu au clic extérieur ---------------------------------
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e) => {
      if (!e.target.closest?.("[data-menu-root]")) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [menuOpen]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const onCookieClick = useCallback(() => {
    audio.play("crunch", 0.3);
    // Le combo est enregistré d'abord: le clic courant profite déjà du palier
    // qu'il vient d'atteindre.
    combo.register();
    const streak = combo.streakRef.current;
    const derived = deriveStats(stateRef.current, Date.now(), streak);
    const gain = derived.cpc;

    setState((s) => ({
      ...s,
      cookies: s.cookies + gain,
      lifetime: s.lifetime + gain,
      stats: {
        ...s.stats,
        clicks: (s.stats.clicks || 0) + 1,
        handmade: (s.stats.handmade || 0) + gain,
        bestCombo: Math.max(s.stats.bestCombo || 1, derived.combo),
      },
    }));

    if (isFeatureEnabled("ENABLE_PARTICLES")) {
      particlesRef.current?.burstText(1, `+${fmt(gain)}`);
      particlesRef.current?.burstCrumbs(derived.combo > 2 ? 5 : 3);
      // Gerbe dorée aux paliers de combo, pour rendre la montée lisible
      if (streak > 0 && streak % 10 === 0) particlesRef.current?.burstGold(10);
    }
  }, [audio, combo, stateRef]);

  const buy = useCallback(
    (itemId, quantite = 1) => {
      const s = stateRef.current;
      // « Max » se résout au moment du clic, pas au rendu: le prix affiché a pu
      // changer entre les deux si la production a tourné.
      const count = quantite === "max" ? maxAffordable(s, itemId) : quantite;
      if (count < 1) {
        refuse();
        return;
      }
      const price = costOf(s, itemId, count);
      if (s.cookies < price) {
        refuse();
        return;
      }

      const item = ITEMS.find((x) => x.id === itemId);
      const ownedBefore = s.items[itemId] || 0;
      const before = deriveStats(s);
      const after = deriveStats({ ...s, items: { ...s.items, [itemId]: ownedBefore + count } });

      // Les seuils suivent la même échelle que les paliers d'améliorations:
      // 10, 20, 40, 80 … Les coder en dur les avait déjà désynchronisés une fois.
      const crossesMilestone = Array.from({ length: 12 }, (_, i) => tierThreshold(i)).some(
        (m) => ownedBefore < m && ownedBefore + count >= m
      );
      const big = crossesMilestone || price / Math.max(1, s.cookies) >= 0.45;

      audio.play(big ? "bigBuy" : "buy", big ? 0.55 : 0.35);

      setState((prev) => {
        const next = {
          ...prev,
          cookies: prev.cookies - price,
          items: { ...prev.items, [itemId]: (prev.items[itemId] || 0) + count },
          stats: {
            ...prev.stats,
            lastPurchaseTs: Date.now(),
            totalSpent: (prev.stats.totalSpent || 0) + price,
          },
          flags: { ...prev.flags, flash: null },
        };
        // Le premier bâtiment automatique offert ne l'est qu'une fois
        if (price === 0 && item?.mode === "cps" && !prev.flags.freeFirstAutoGiven) {
          next.flags = { ...next.flags, freeFirstAutoGiven: true, freeFirstAutoItemId: itemId };
        }
        if (big) {
          const delta =
            item?.mode === "mine"
              ? `${fmt(before.mining)} → ${fmt(after.mining)} /s`
              : `${fmt(before.perClickNoCombo)} → ${fmt(after.perClickNoCombo)} /clic`;
          next.fx = { ...prev.fx, banner: { title: "Palier franchi", sub: delta, until: Date.now() + 2200 }, shakeUntil: Date.now() + 700 };
        }
        return next;
      });

      if (big && isFeatureEnabled("ENABLE_PARTICLES")) particlesRef.current?.burstGold(30);
    },
    [audio, refuse, stateRef]
  );

  const buyUpgrade = useCallback(
    (upgrade) => {
      const s = stateRef.current;
      if (s.upgrades[upgrade.id]) return;
      if (s.cookies < upgrade.cost) {
        refuse();
        return;
      }
      audio.play("bigBuy", 0.5);
      particlesRef.current?.burstGold(18);
      setState((prev) => ({
        ...prev,
        cookies: prev.cookies - upgrade.cost,
        upgrades: { ...prev.upgrades, [upgrade.id]: true },
        stats: { ...prev.stats, totalSpent: (prev.stats.totalSpent || 0) + upgrade.cost },
        fx: { ...prev.fx, banner: { title: "Amélioration", sub: upgrade.name, until: Date.now() + 2000 } },
      }));
      notify.event(`${upgrade.emoji} ${upgrade.name}`, "success");
    },
    [audio, notify, refuse, stateRef]
  );

  const buySkin = useCallback(
    (skinId) => {
      const s = stateRef.current;
      const skin = SKINS[skinId];
      if (!skin || s.skinsOwned[skinId]) return;
      const enCrmb = (skin.crmb || 0) > 0;
      if (enCrmb ? (s.crypto?.balance || 0) < skin.crmb : s.cookies < skin.price) {
        refuse();
        return;
      }
      audio.play("golden", 0.45);
      particlesRef.current?.burstGold(24);
      setState((prev) => ({
        ...prev,
        cookies: enCrmb ? prev.cookies : prev.cookies - skin.price,
        crypto: enCrmb ? { ...prev.crypto, balance: (prev.crypto?.balance || 0) - skin.crmb } : prev.crypto,
        skinsOwned: { ...prev.skinsOwned, [skinId]: true },
        skin: skinId,
        stats: { ...prev.stats, totalSpent: (prev.stats.totalSpent || 0) + (enCrmb ? 0 : skin.price) },
      }));
      notify.event(`Nouvelle apparence — ${skin.name}`, "success");
    },
    [audio, notify, refuse, stateRef]
  );

  // Référence stable: sinon `memo(Skins)` se re-rend à chaque tick du jeu
  const stopPreview = useCallback(() => setPreviewSkin(null), []);

  const equipSkin = useCallback(
    (skinId) => {
      if (!stateRef.current.skinsOwned[skinId]) return;
      audio.play("buy", 0.3);
      setState((prev) => ({ ...prev, skin: skinId }));
    },
    [audio, stateRef]
  );

  // --- Crypto --------------------------------------------------------------

  const cryptoBuy = useCallback(
    (amount) => {
      const s = stateRef.current;
      const cost = buyPrice(s.crypto.price) * amount;
      if (amount <= 0 || s.cookies < cost) {
        refuse();
        return;
      }
      audio.play("buy", 0.35);
      setState((prev) => ({
        ...prev,
        cookies: prev.cookies - cost,
        crypto: {
          ...prev.crypto,
          balance: roundCrmb(prev.crypto.balance + amount),
          totalBought: roundCrmb((prev.crypto.totalBought || 0) + amount),
          realizedPnl: (prev.crypto.realizedPnl || 0) - cost,
        },
      }));
    },
    [audio, refuse, stateRef]
  );

  const cryptoSell = useCallback(
    (amount) => {
      const s = stateRef.current;
      if (amount <= 0 || s.crypto.balance < amount) {
        refuse();
        return;
      }
      const gain = sellPrice(s.crypto.price) * amount;
      audio.play("buy", 0.35);
      setState((prev) => ({
        ...prev,
        cookies: prev.cookies + gain,
        lifetime: prev.lifetime + gain,
        crypto: {
          ...prev.crypto,
          balance: roundCrmb(prev.crypto.balance - amount),
          totalSold: roundCrmb((prev.crypto.totalSold || 0) + amount),
          realizedPnl: (prev.crypto.realizedPnl || 0) + gain,
        },
      }));
    },
    [audio, refuse, stateRef]
  );

  const cryptoStake = useCallback(
    (amount, tierId) => {
      const s = stateRef.current;
      if (amount <= 0 || s.crypto.balance < amount) {
        refuse();
        return;
      }
      const tier = getTier(tierId);
      const now = Date.now();
      audio.play("golden", 0.35);
      setState((prev) => ({
        ...prev,
        crypto: {
          ...prev.crypto,
          balance: roundCrmb(prev.crypto.balance - amount),
          positions: [
            ...prev.crypto.positions,
            {
              id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              amount: roundCrmb(amount),
              tierId: tier.id,
              startedAt: now,
              unlockAt: now + tier.lockMs,
            },
          ],
        },
      }));
    },
    [audio, refuse, stateRef]
  );

  const cryptoUnstake = useCallback(
    (positionId) => {
      const now = Date.now();
      const s = stateRef.current;
      const position = s.crypto.positions.find((p) => p.id === positionId);
      if (!position) return;
      if (now < (position.unlockAt || 0)) {
        refuse();
        return;
      }
      audio.play("buy", 0.3);
      setState((prev) => ({
        ...prev,
        crypto: {
          ...prev.crypto,
          balance: roundCrmb(prev.crypto.balance + position.amount),
          positions: prev.crypto.positions.filter((p) => p.id !== positionId),
        },
      }));
    },
    [audio, refuse, stateRef]
  );

  const buyMiner = useCallback(
    (minerId) => {
      const s = stateRef.current;
      const owned = s.crypto.miners?.[minerId] || 0;
      const cost = minerCost(minerId, owned);
      if (s.cookies < cost) {
        refuse();
        return;
      }
      audio.play("bigBuy", 0.45);
      particlesRef.current?.burstGold(14);
      setState((prev) => ({
        ...prev,
        cookies: prev.cookies - cost,
        stats: { ...prev.stats, totalSpent: (prev.stats.totalSpent || 0) + cost },
        crypto: { ...prev.crypto, miners: { ...prev.crypto.miners, [minerId]: owned + 1 } },
      }));
      notify.event(`${MINERS.find((m) => m.id === minerId)?.name} installé`, "success");
    },
    [audio, notify, refuse, stateRef]
  );

  // --- Prestige ------------------------------------------------------------

  const doPrestige = useCallback(() => {
    const s = stateRef.current;
    const potential = chipsFor(s.lifetime);
    const gain = potential - (s.prestige?.chips || 0);
    if (gain <= 0 || s.lifetime < PRESTIGE_MIN_LIFETIME) return;
    if (!window.confirm(`Renaître et gagner ${gain} chips célestes ? Ta progression actuelle sera réinitialisée (l'arbre céleste est conservé).`)) {
      return;
    }

    audio.play("golden", 0.6);
    particlesRef.current?.burstGold(60);

    setState((prev) => {
      const fresh = createResetState({
        preservePrestige: true,
        prestige: { chips: potential, spent: prev.prestige?.spent || 0, upgrades: prev.prestige?.upgrades || {} },
        sounds: prev.ui.sounds,
      });
      const eff = prestigeEffects(fresh);
      // « Départ lancé » rend une fraction de la production de la partie qui s'achève
      const head = Math.floor((prev.lifetime || 0) * eff.startFraction);
      return {
        ...fresh,
        cookies: head,
        lifetime: head,
        ui: { ...prev.ui, introSeen: true },
        stats: { ...fresh.stats, prestigeCount: (prev.stats?.prestigeCount || 0) + 1 },
        // Le portefeuille CRMB et le matériel survivent au prestige
        crypto: { ...prev.crypto, lastMarketTs: Date.now(), lastYieldTs: Date.now() },
        unlocked: prev.unlocked,
      };
    });
    notify.major(`Renaissance céleste — +${gain} chips`, "gold");
  }, [audio, notify, stateRef]);

  const buyPrestigeNode = useCallback(
    (nodeId) => {
      const s = stateRef.current;
      const node = PRESTIGE_BY_ID[nodeId];
      if (!node) return;
      const level = s.prestige?.upgrades?.[nodeId] || 0;
      if (level >= node.maxLevel) return;
      const cost = upgradeCost(nodeId, level);
      if (availableChips(s) < cost) {
        refuse();
        return;
      }
      audio.play("golden", 0.4);
      particlesRef.current?.burstGold(16);
      setState((prev) => ({
        ...prev,
        prestige: {
          ...prev.prestige,
          spent: (prev.prestige.spent || 0) + cost,
          upgrades: { ...prev.prestige.upgrades, [nodeId]: level + 1 },
        },
      }));
      notify.event(`${node.emoji} ${node.name} niveau ${level + 1}`, "success");
    },
    [audio, notify, refuse, stateRef]
  );

  // --- Cookie croqué -------------------------------------------------------

  const onCookieEaten = useCallback(() => {
    const s = stateRef.current;
    const derived = deriveStats(s);
    const count = (s.cookieEatenCount || 0) + 1;
    const bonus = Math.max(derived.perClick * (count % 5 === 0 ? 120 : 40), derived.mining * 45);

    audio.play("golden", 0.5);
    particlesRef.current?.burstGold(40);
    particlesRef.current?.burstCrumbs(30);

    setState((prev) => ({
      ...prev,
      cookies: prev.cookies + bonus,
      lifetime: prev.lifetime + bonus,
      cookieEatenCount: count,
      cookieBites: [],
      fx: { ...prev.fx, banner: { title: "Cookie croqué !", sub: `+${fmt(bonus)}`, until: Date.now() + 2200 } },
    }));
    notify.major(`Cookie croqué — +${fmt(bonus)}`, "gold");

    // Un cookie sur deux fait apparaître un doré en récompense
    if (count % 2 === 0) events.forceGolden();
  }, [audio, events, notify, stateRef]);

  // Les morsures sont suivies par CookieBiteMask à partir du compteur de clics:
  // les dupliquer dans l'état global provoquait un second rendu par clic.

  // --- Sauvegarde ----------------------------------------------------------

  const exportSave = useCallback(() => {
    try {
      const blob = new Blob([serializeSave(stateRef.current)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cookiecraze-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify.banner("Sauvegarde exportée", "success");
    } catch {
      notify.banner("Export impossible", "warn");
    }
  }, [notify, stateRef]);

  const importSave = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseSave(reader.result);
        if (!parsed) {
          notify.banner("Fichier de sauvegarde invalide", "warn");
          return;
        }
        setState(parsed);
        notify.banner("Sauvegarde importée", "success");
      };
      reader.onerror = () => notify.banner("Lecture du fichier impossible", "warn");
      reader.readAsText(file);
    },
    [notify]
  );

  const hardReset = useCallback(
    (event) => {
      const full = event?.altKey || event?.shiftKey;
      const message = full
        ? "Tout effacer, y compris le prestige et l'arbre céleste ?"
        : "Réinitialiser la partie ? (prestige et arbre céleste conservés)";
      if (!window.confirm(message)) return;

      const s = stateRef.current;
      const payload = {
        preservePrestige: !full,
        prestige: full ? null : s.prestige,
        sounds: !!s.ui.sounds,
      };

      try {
        localStorage.removeItem(SAVE_KEY);
        for (const key of LEGACY_KEYS) localStorage.removeItem(key);
      } catch {
        // Stockage inaccessible: l'état en mémoire est réinitialisé quand même
      }

      particlesRef.current?.clear();
      combo.reset();
      setMenuOpen(false);
      setOfflineReport(null);
      setTab("shop");
      setState(createResetState(payload));
      notify.banner(full ? "Tout a été remis à zéro." : "Partie réinitialisée.", "success");
    },
    [notify, stateRef, combo]
  );

  // ==========================================================================
  // Rendu
  // ==========================================================================

  const skinKey = previewSkin || state.skin;
  const skin = SKINS[skinKey] || SKINS.default;
  const shaking = useShake(state.fx.shakeUntil);
  const reducedMotion = !!state.ui.reducedMotion;

  const visibleTabs = useMemo(() => TABS.filter((t) => !t.feature || isFeatureEnabled(t.feature)), []);

  const questAlert = useMemo(() => {
    const all = [...(state.quests?.active || []), ...(state.quests?.daily || [])];
    return all.filter((q) => q.target > 0 && q.progress / q.target >= 0.85).length;
  }, [state.quests]);

  if (!state.ui.introSeen) {
    return (
      <Intro
        soundsOn={state.ui.sounds}
        onToggleSound={() => setState((s) => ({ ...s, ui: { ...s.ui, sounds: !s.ui.sounds } }))}
        onStart={() => setState((s) => ({ ...s, ui: { ...s.ui, introSeen: true }, createdAt: Date.now(), lastTs: Date.now() }))}
      />
    );
  }

  return (
    <div
      id="game-area"
      className={`${state.ui.highContrast ? "high-contrast " : ""}min-h-screen w-full bg-bakery text-amber-950 select-none`}
    >
      {/* La marge basse réserve la place de la navigation fixe: aucun bouton de
          la boutique ne peut finir caché dessous. */}
      <div className="mx-auto max-w-7xl px-3 py-4 md:px-6 md:py-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-6">
        {/* ---------- En-tête ---------- */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl drop-shadow-sm" aria-hidden="true">
              🍪
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-700 to-orange-600">
              Cookie Craze
            </h1>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap" data-menu-root>
            <HeaderStat
              label="Par clic"
              value={fmt(stats.perClickNoCombo)}
              title="Puissance de clic, combo non compris"
            />
            <HeaderStat label="Minage" value={`${fmt(stats.mining)}/s`} tone="emerald" title="Cookies générés automatiquement chaque seconde" />
            {isFeatureEnabled("ENABLE_PRESTIGE") && (state.prestige?.chips || 0) > 0 && (
              <HeaderStat label="Chips" value={availableChips(state)} tone="violet" title="Chips célestes disponibles" />
            )}
            {isFeatureEnabled("ENABLE_CRYPTO") && (
              <HeaderStat
                label="CRMB"
                value={fmtCrmb(state.crypto.balance)}
                tone="cyan"
                title={`Cours : ${fmt(state.crypto.price)} cookies`}
              />
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Réglages"
                className="rounded-xl px-3 py-1.5 bg-white/85 border border-amber-200 shadow-sm hover:bg-white hover:shadow transition-all"
              >
                ⚙️
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 mt-2 w-60 origin-top-right rounded-2xl bg-white/97 backdrop-blur-md border border-amber-200 shadow-2xl z-50 overflow-hidden"
                  >
                    <MenuToggle
                      label={state.ui.sounds ? "🔊 Sons activés" : "🔈 Sons coupés"}
                      onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, sounds: !s.ui.sounds } }))}
                    />
                    {state.ui.sounds && (
                      <div className="px-4 py-2 border-b border-amber-100">
                        <label className="block text-[11px] text-amber-700 mb-1" htmlFor="volume">
                          Volume · {Math.round((state.ui.volume ?? 0.6) * 100)} %
                        </label>
                        <input
                          id="volume"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={state.ui.volume ?? 0.6}
                          onChange={(e) =>
                            setState((s) => ({ ...s, ui: { ...s.ui, volume: Number(e.target.value) } }))
                          }
                          className="w-full accent-amber-500"
                        />
                      </div>
                    )}
                    <MenuToggle
                      label={state.ui.highContrast ? "🟨 Contraste élevé" : "⬜ Contraste normal"}
                      onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, highContrast: !s.ui.highContrast } }))}
                    />
                    <MenuToggle
                      label={state.ui.reducedMotion ? "🐢 Animations réduites" : "✨ Animations complètes"}
                      onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, reducedMotion: !s.ui.reducedMotion } }))}
                    />
                    <MenuToggle label="💾 Exporter la sauvegarde" onClick={exportSave} />
                    <label className="block w-full text-left px-4 py-2.5 text-sm text-amber-900 hover:bg-amber-50 cursor-pointer transition-colors border-b border-amber-100">
                      📥 Importer une sauvegarde
                      <input
                        type="file"
                        accept=".json,.txt,application/json"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && importSave(e.target.files[0])}
                      />
                    </label>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={hardReset}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      ♻️ Réinitialiser
                      <span className="block text-[10px] text-red-400">Maj + clic : effacer aussi le prestige</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ---------- Corps ---------- */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 md:gap-6 items-start">
          {/* --- Scène du cookie --- */}
          <section className={`rounded-3xl glass-warm shadow-xl p-3 md:p-6 ${shaking ? "animate-shake" : ""}`}>
            <div className="text-center">
              <div className="text-sm md:text-base text-amber-800 font-medium">Cookies en banque</div>
              <div
                className="text-4xl md:text-7xl font-black tracking-tight tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600"
                aria-live="polite"
                aria-atomic="true"
              >
                {fmtInt(state.cookies)}
              </div>
              <div className="text-xs md:text-sm text-amber-800/80">
                {fmtInt(state.lifetime)} cuits au total
                {stats.mining > 0 && <span className="text-emerald-700 font-semibold"> · {fmt(stats.mining)} / s minés</span>}
              </div>
              <ComboMeter display={combo.display} />
              <BuffBadge buffs={state.buffs} />
              {state.flags?.discountAll && <DiscountBadge discount={state.flags.discountAll} />}
            </div>

            {/* Le grand cookie */}
            <div className="relative mt-2 md:mt-4 flex items-center justify-center">
              <div className="relative w-52 h-52 sm:w-72 sm:h-72 md:w-[24rem] md:h-[24rem]">
                <div
                  className={`absolute inset-0 rounded-full bg-gradient-to-br from-amber-300/30 via-orange-400/20 to-transparent blur-3xl ${
                    reducedMotion ? "" : "animate-pulse-slow"
                  }`}
                  aria-hidden="true"
                />
                <motion.button
                  type="button"
                  onClick={onCookieClick}
                  aria-label={`Cliquer le cookie pour gagner ${fmt(stats.perClick)} cookies`}
                  whileTap={reducedMotion ? undefined : { scale: 0.93 }}
                  whileHover={reducedMotion ? undefined : { scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className={`relative h-full w-full rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/60 ${
                    reducedMotion ? "" : "animate-float"
                  }`}
                >
                  {state.cookieEatEnabled && isFeatureEnabled("ENABLE_COOKIE_EAT") ? (
                    <CookieBiteMask
                      skinSrc={skin.src}
                      clicks={state.stats.clicks}
                      bitesTotal={80}
                      enabled
                      onFinished={onCookieEaten}
                      className={`h-full w-full drop-shadow-2xl ${skin.className || ""}`}
                    />
                  ) : (
                    <img
                      src={skin.src}
                      alt=""
                      draggable="false"
                      className={`h-full w-full drop-shadow-2xl ${skin.className || ""}`}
                    />
                  )}
                </motion.button>

                <ParticleLayer ref={particlesRef} reducedMotion={reducedMotion} />
              </div>
            </div>

            <NextGoal state={state} stats={stats} />

            <div className="mt-2 flex items-center justify-center gap-3 text-xs text-amber-700">
              <span>🍪 Croqués : <b className="tabular-nums">{state.cookieEatenCount || 0}</b></span>
              <span aria-hidden="true">·</span>
              <span>👆 Clics : <b className="tabular-nums">{fmtInt(state.stats.clicks || 0)}</b></span>
            </div>
          </section>

          {/* --- Panneau latéral ---
              Sur mobile il n'y a pas de « côté »: le panneau suit le cookie et
              la navigation descend sous le pouce, en barre fixe. Le lecteur
              d'écran, lui, ne voit qu'un seul jeu d'onglets — celui d'en bas. */}
          <section className="rounded-3xl glass-warm shadow-xl overflow-hidden flex flex-col lg:max-h-[80vh]">
            {/* Une seule barre d'onglets, deux positions.
                Sous `lg` elle se détache en bas de l'écran, sous le pouce, avec
                la marge de sécurité iOS; au-dessus, elle reprend sa place en
                tête du panneau. En dupliquer une par format donnerait deux
                `tablist` à un lecteur d'écran — et deux onglets « Prestige ». */}
            <nav
              className="fixed inset-x-0 bottom-0 z-40 flex border-t border-amber-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]
                         lg:static lg:z-auto lg:shrink-0 lg:flex-wrap lg:gap-1 lg:p-2 lg:border-t-0 lg:border-b lg:border-amber-200/60 lg:bg-white/50 lg:pb-2 lg:backdrop-blur-none"
              role="tablist"
              aria-label="Sections du jeu"
            >
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-label={t.label}
                  onClick={() => setTab(t.id)}
                  className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                    lg:flex-none lg:flex-row lg:gap-1 lg:px-2.5 lg:py-1.5 lg:rounded-xl lg:text-xs lg:font-semibold ${
                      tab === t.id
                        ? "text-orange-600 lg:text-white lg:bg-gradient-to-r lg:from-amber-500 lg:to-orange-500 lg:shadow-md"
                        : "text-amber-700/70 lg:text-amber-800 lg:bg-amber-100/60 lg:hover:bg-amber-200/70"
                    }`}
                >
                  <span className="text-xl leading-none lg:text-sm" aria-hidden="true">
                    {t.icon}
                  </span>
                  <span className="text-[10px] font-semibold leading-none xl:inline lg:hidden">{t.label}</span>
                  {tab === t.id && (
                    <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-orange-500 lg:hidden" aria-hidden="true" />
                  )}
                  {t.id === "quests" && questAlert > 0 && tab !== "quests" && (
                    <span className="absolute top-1 right-1/4 h-4 min-w-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold grid place-items-center lg:-top-1 lg:-right-1">
                      {questAlert}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex-1 lg:overflow-y-auto overscroll-contain p-3 md:p-4 scrollbar-thin">
              {tab === "shop" && (
                <>
                  {/* Filtres et quantité restent collés en haut du panneau: sur
                      mobile la liste défile sous eux, ils ne disparaissent jamais. */}
                  <div className="sticky top-0 z-10 -mx-3 md:-mx-4 px-3 md:px-4 pb-2 pt-0.5 bg-gradient-to-b from-amber-50 via-amber-50/95 to-transparent flex items-center gap-2">
                    <div className="flex gap-1" role="group" aria-label="Filtrer les bâtiments">
                      {[
                        ["all", "Tout"],
                        ["click", "👆 Clic"],
                        ["mine", "⛏️ Minage"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setShopFilter(id)}
                          aria-pressed={shopFilter === id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            shopFilter === id
                              ? "bg-amber-500 text-white shadow"
                              : "bg-white/80 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto flex gap-1" role="group" aria-label="Quantité d'achat">
                      {[1, 10, "max"].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setBuyQty(q)}
                          aria-pressed={buyQty === q}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            buyQty === q
                              ? "bg-orange-500 text-white shadow"
                              : "bg-white/80 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {q === "max" ? "Max" : `×${q}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Shop
                    state={state}
                    filter={shopFilter}
                    onBuy={buy}
                    perItemMult={stats.perItemMult}
                    qty={buyQty}
                    stats={stats}
                  />
                </>
              )}
              {tab === "upgrades" && <Upgrades state={state} stats={stats} onBuy={buyUpgrade} />}
              {tab === "quests" && <QuestBoard state={state} ctx={questCtx} onReroll={reroll} />}

              <Suspense fallback={<PanelSkeleton />}>
                {tab === "crypto" && (
                  <CryptoPanel
                    state={state}
                    stats={stats}
                    onBuy={cryptoBuy}
                    onSell={cryptoSell}
                    onStake={cryptoStake}
                    onUnstake={cryptoUnstake}
                    onBuyMiner={buyMiner}
                  />
                )}
                {tab === "prestige" && (
                  <PrestigePanel state={state} effects={effects} onPrestige={doPrestige} onBuyNode={buyPrestigeNode} />
                )}
                {tab === "profile" && (
                  <>
                    <StatsPanel state={state} stats={stats} />
                    {isFeatureEnabled("ENABLE_SKINS") && (
                      <div className="mt-4 pt-4 border-t border-amber-200/60">
                        <Skins
                          state={state}
                          skins={SKINS}
                          onBuy={buySkin}
                          onEquip={equipSkin}
                          onPreview={setPreviewSkin}
                          onStopPreview={stopPreview}
                        />
                      </div>
                    )}
                  </>
                )}
              </Suspense>
            </div>
          </section>
        </div>
      </div>

      {/* ---------- Superpositions ---------- */}
      <Banner banner={state.fx.banner} />

      <AnimatePresence>
        {events.golden && (
          <motion.button
            type="button"
            key={events.golden.id}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            onClick={events.clickGolden}
            aria-label="Attraper le cookie doré"
            className="fixed z-40 h-16 w-16 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-400 to-amber-500 border-4 border-yellow-100 shadow-[0_0_30px_rgba(250,204,21,0.75)] text-2xl grid place-items-center animate-golden"
            style={{ left: events.golden.left, top: events.golden.top }}
          >
            ⭐
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {events.flying && (
          <motion.button
            type="button"
            key={events.flying.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={events.clickFlying}
            aria-label="Attraper le cookie volant"
            className="fixed z-40 h-14 w-14 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 border-2 border-amber-100 shadow-xl text-2xl grid place-items-center animate-drift"
            style={{ left: events.flying.left, top: events.flying.top }}
          >
            🍪
          </motion.button>
        )}
      </AnimatePresence>

      {events.rain.map((crumb) => (
        <button
          type="button"
          key={crumb.id}
          onClick={() => events.clickCrumb(crumb.id)}
          aria-label="Attraper une miette"
          className="fixed z-30 h-9 w-9 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border-2 border-amber-100 shadow-lg text-lg grid place-items-center animate-rain"
          style={{
            left: crumb.x,
            top: -50,
            animationDelay: `${crumb.delay}s`,
            animationDuration: `${crumb.duration}s`,
          }}
        >
          🍪
        </button>
      ))}

      <Notice notice={state.notice} reducedMotion={reducedMotion} />

      <AnimatePresence>
        {offlineReport && <OfflineModal report={offlineReport} onClose={() => setOfflineReport(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Utilitaires locaux
// ============================================================================

const PanelSkeleton = memo(function PanelSkeleton() {
  return (
    <div className="space-y-2 animate-pulse" aria-busy="true" aria-label="Chargement">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-amber-100/60" />
      ))}
    </div>
  );
});

const MenuToggle = memo(function MenuToggle({ label, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 text-sm text-amber-900 hover:bg-amber-50 transition-colors border-b border-amber-100"
    >
      {label}
    </button>
  );
});

const DiscountBadge = memo(function DiscountBadge({ discount }) {
  const left = useTimeLeft(discount?.until, 250);
  if (!discount || left <= 0) return null;
  return (
    <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-violet-500 text-white shadow-lg">
      🏷️ -{Math.round(discount.value * 100)} % sur les achats
      <span className="tabular-nums opacity-90">{Math.ceil(left / 1000)}s</span>
    </div>
  );
});

/** Vrai tant que la secousse d'écran est en cours. */
function useShake(shakeUntil) {
  return useTimeLeft(shakeUntil, 100) > 0;
}
