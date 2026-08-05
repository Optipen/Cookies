import { useCallback, useEffect, useRef, useState } from "react";
import tuning from "../data/tuning.json";
import { deriveStats } from "../utils/selectors.js";
import { prestigeEffects } from "../data/prestige.js";
import { isFeatureEnabled } from "../utils/state.js";
import { fmt } from "../utils/format.js";
import { gainChance, gainJackpot, gainMiette } from "../utils/gains.js";

const cfgFor = (path, fallback) => {
  const mode = tuning?.mode || "standard";
  let node = tuning?.[mode];
  for (const key of path) node = node?.[key];
  return node ?? fallback;
};

const rand = (min, max) => min + Math.random() * (max - min);

/**
 * Événements aléatoires: cookie doré, pluie de miettes, cookie volant.
 *
 * Un seul hook les orchestre pour garantir qu'un flag désactivé empêche
 * réellement l'apparition. Avant, `ENABLE_GOLDEN_COOKIES: false` bloquait le
 * clic et le masquage mais pas le spawn: le cookie doré restait figé à
 * l'écran, inerte et impossible à faire disparaître.
 */
export function useEvents({ stateRef, setState, notify, fx, audio }) {
  const { event, major } = notify;
  const [golden, setGolden] = useState(null); // { left, top, until }
  const [rain, setRain] = useState([]); // miettes cliquables, animées en CSS
  const [flying, setFlying] = useState(null);

  const timersRef = useRef({ golden: null, rain: null, flying: null, hide: null });
  const clickLockRef = useRef(0);
  // Chaque événement se replanifie après son apparition: le ref casse le cycle
  // `spawn -> schedule -> spawn` que des const mutuellement référencées
  // rendraient dépendant de l'ordre de déclaration.
  const schedulersRef = useRef({ golden: null, rain: null, flying: null });

  const clearTimer = (key) => {
    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key]);
      timersRef.current[key] = null;
    }
  };

  // --- Cookie doré ---------------------------------------------------------

  const spawnGolden = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const area = document.getElementById("game-area");
    const r = area?.getBoundingClientRect();
    const width = r?.width || window.innerWidth;
    const height = r?.height || window.innerHeight;
    const left = rand(70, Math.max(140, Math.min(width, window.innerWidth) - 90));
    const top = rand(130, Math.max(220, Math.min(height, window.innerHeight) - 110));
    const lifespan = cfgFor(["events", "golden", "lifespan_s"], 11) * 1000;

    setGolden({ left, top, until: Date.now() + lifespan, id: Math.random().toString(36).slice(2) });
    audio.play("golden");
    // Le doré se signale par lui-même à l'écran: pas besoin d'un bandeau.

    clearTimer("hide");
    timersRef.current.hide = setTimeout(() => {
      setGolden(null);
      schedulersRef.current.golden?.();
    }, lifespan);
  }, [audio, stateRef]);

  const scheduleGolden = useCallback(() => {
    if (!isFeatureEnabled("ENABLE_GOLDEN_COOKIES") || !isFeatureEnabled("ENABLE_EVENTS")) return;
    clearTimer("golden");
    const s = stateRef.current;
    const rate = s ? prestigeEffects(s).goldenRate : 1;
    const [min, max] = cfgFor(["events", "golden", "cooldown_s"], [240, 420]);
    const delay = (rand(min, max) * 1000) / Math.max(0.2, rate);
    timersRef.current.golden = setTimeout(spawnGolden, delay);
  }, [spawnGolden, stateRef]);

  const clickGolden = useCallback(() => {
    if (!isFeatureEnabled("ENABLE_GOLDEN_COOKIES")) return;
    const now = Date.now();
    if (now < clickLockRef.current) return;
    clickLockRef.current = now + 600;

    clearTimer("hide");
    setGolden(null);
    scheduleGolden();

    audio.play("golden", 0.6);
    fx.burstGold(46);

    setState((prev) => {
      const stats = deriveStats(prev, now);
      const gcfg = cfgFor(["events", "golden"], {});

      // Rendements décroissants si on enchaîne les dorés: on descend d'un cran
      // dans une échelle de multiplicateurs ronds, au lieu de multiplier par
      // 0,8 et d'obtenir ×5,6 puis ×4,48.
      const window_ = (gcfg.dr_window_s ?? 180) * 1000;
      const recent = now - (prev.flags?.goldenLastTs || 0) < window_;
      const stacks = recent ? (prev.flags?.goldenStacks || 0) + 1 : 0;
      const pick = (echelle) => echelle[Math.min(echelle.length - 1, stacks)];
      const dr = pick(gcfg.lucky_mults || [1, 0.5, 0.25, 0.1]);

      const next = {
        ...prev,
        stats: { ...prev.stats, goldenClicks: (prev.stats?.goldenClicks || 0) + 1 },
        flags: { ...prev.flags, goldenLastTs: now, goldenStacks: stacks },
      };

      const roll = Math.random();
      if (roll < 0.35) {
        const m = pick(gcfg.cps_mults || [5, 3, 2]);
        next.buffs = { cpsMulti: m, cpcMulti: 1, until: now + 25_000, label: `Minage ×${m}` };
        major(`Minage ×${m} pendant 25 s`, "gold");
      } else if (roll < 0.65) {
        const m = pick(gcfg.cpc_mults || [10, 5, 3]);
        next.buffs = { cpsMulti: 1, cpcMulti: m, until: now + 15_000, label: `Clic ×${m}` };
        major(`Puissance de clic ×${m} pendant 15 s`, "gold");
      } else if (roll < 0.88) {
        // Le gain est posé sur la règle des valeurs AVANT d'être crédité:
        // « banque × 10 % » est un nombre quelconque, l'annonce et le solde
        // doivent dire le même nombre propre.
        const bonus = gainChance(prev, stats, dr);
        next.cookies = prev.cookies + bonus;
        next.lifetime = prev.lifetime + bonus;
        major(`Chance — +${fmt(bonus)} cookies`, "gold");
      } else {
        const bonus = gainJackpot(stats, dr);
        next.cookies = prev.cookies + bonus;
        next.lifetime = prev.lifetime + bonus;
        next.flags = { ...next.flags, discountAll: { value: 0.25, until: now + 45_000 } };
        major(`Jackpot — +${fmt(bonus)} cookies et -25 % sur les achats`, "gold");
      }

      return next;
    });
  }, [audio, fx, scheduleGolden, setState, major]);

  // --- Pluie de miettes ----------------------------------------------------
  // Les miettes tombent via une animation CSS: aucune boucle JS ne les déplace,
  // contrairement à l'ancienne version qui re-rendait le jeu toutes les 16 ms.

  const startRain = useCallback(() => {
    if (!isFeatureEnabled("ENABLE_RAIN")) return;
    const duration = cfgFor(["events", "rain", "duration_s"], 8);
    const count = cfgFor(["events", "rain", "count"], 28);
    const width = window.innerWidth;

    setRain(
      Array.from({ length: count }, () => ({
        id: Math.random().toString(36).slice(2),
        x: rand(20, Math.max(60, width - 60)),
        delay: rand(0, duration * 0.55),
        duration: rand(duration * 0.55, duration * 0.9),
      }))
    );
    event("Pluie de miettes — attrape-les", "gold");

    clearTimer("rain");
    timersRef.current.rain = setTimeout(() => {
      setRain([]);
      schedulersRef.current.rain?.();
    }, duration * 1000 + 800);
  }, [event]);

  const scheduleRain = useCallback(() => {
    if (!isFeatureEnabled("ENABLE_RAIN") || !isFeatureEnabled("ENABLE_EVENTS")) return;
    clearTimer("rain");
    const [min, max] = cfgFor(["events", "rain", "cooldown_s"], [180, 300]);
    timersRef.current.rain = setTimeout(startRain, rand(min, max) * 1000);
  }, [startRain]);

  const clickCrumb = useCallback(
    (id) => {
      setRain((list) => list.filter((c) => c.id !== id));
      setState((prev) => {
        const stats = deriveStats(prev);
        // Un cran net tiré au sort plutôt qu'un réel continu: une miette
        // rapportait « ×2,4713 fois le clic », un nombre que personne ne peut
        // lire. Et le produit « clic × ×2,5 » est ENSUITE posé sur la règle:
        // 1,25 × 2,5 = 3,125 n'existe pas, la miette crédite 3.
        const echelle = cfgFor(["events", "rain", "cpc_mults"], [2, 2.5, 3]);
        const mult = echelle[Math.floor(Math.random() * echelle.length)];
        const gain = gainMiette(stats, mult);
        return { ...prev, cookies: prev.cookies + gain, lifetime: prev.lifetime + gain };
      });
      audio.play("crunch", 0.25);
    },
    [audio, setState]
  );

  // --- Cookie volant -------------------------------------------------------

  const spawnFlying = useCallback(() => {
    if (!isFeatureEnabled("ENABLE_FLYING_COOKIE")) return;
    const area = document.getElementById("game-area");
    const r = area?.getBoundingClientRect();
    const width = r?.width || window.innerWidth;
    const height = Math.min(r?.height || window.innerHeight, window.innerHeight);
    const lifespan = cfgFor(["flying", "lifespan_s"], 5) * 1000;
    setFlying({
      id: Math.random().toString(36).slice(2),
      left: rand(60, Math.max(120, width - 80)),
      top: rand(140, Math.max(240, height - 120)),
      until: Date.now() + lifespan,
    });
    audio.play("golden", 0.3);
    clearTimer("flying");
    timersRef.current.flying = setTimeout(() => {
      setFlying(null);
      schedulersRef.current.flying?.();
    }, lifespan);
  }, [audio]);

  const scheduleFlying = useCallback(() => {
    if (!isFeatureEnabled("ENABLE_FLYING_COOKIE") || !isFeatureEnabled("ENABLE_EVENTS")) return;
    clearTimer("flying");
    const [min, max] = cfgFor(["flying", "cooldown_s"], [40, 90]);
    timersRef.current.flying = setTimeout(spawnFlying, rand(min, max) * 1000);
  }, [spawnFlying]);

  const clickFlying = useCallback(() => {
    clearTimer("flying");
    setFlying(null);
    scheduleFlying();
    audio.play("golden", 0.5);
    fx.burstGold(20);
    setState((prev) => ({
      ...prev,
      buffs: { cpsMulti: 1, cpcMulti: 2, until: Date.now() + 20_000, label: "Clic ×2" },
      stats: { ...prev.stats, goldenClicks: (prev.stats?.goldenClicks || 0) + 1 },
    }));
    event("Cookie volant — puissance de clic ×2 pendant 20 s", "gold");
  }, [audio, fx, scheduleFlying, setState, event]);

  // Publie les planificateurs après le commit: les rappels de minuterie ne
  // s'exécutent jamais pendant un rendu, ils lisent donc toujours une version
  // à jour.
  useEffect(() => {
    schedulersRef.current = { golden: scheduleGolden, rain: scheduleRain, flying: scheduleFlying };
  }, [scheduleGolden, scheduleRain, scheduleFlying]);

  /** Déclenche un doré immédiatement (récompense de progression). */
  const forceGolden = useCallback(() => {
    if (!isFeatureEnabled("ENABLE_GOLDEN_COOKIES") || !isFeatureEnabled("ENABLE_EVENTS")) return;
    clearTimer("golden");
    spawnGolden();
  }, [spawnGolden]);

  // Démarrage / arrêt global
  useEffect(() => {
    if (!isFeatureEnabled("ENABLE_EVENTS")) return;
    scheduleGolden();
    scheduleRain();
    scheduleFlying();
    const timers = timersRef.current;
    return () => {
      for (const key of Object.keys(timers)) {
        if (timers[key]) clearTimeout(timers[key]);
      }
    };
    // Volontairement monté une seule fois: les callbacks lisent l'état via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { golden, clickGolden, forceGolden, rain, clickCrumb, flying, clickFlying, startRain };
}
