import { useEffect, useRef } from "react";
import { cpsFrom } from "../utils/calc.js";
import tuning from "../data/tuning.json";

// Boucle de jeu avec accumulation et commit moins fréquent pour réduire les re-renders
export function useGameLoop(state, setState, options = {}) {
  const mode = (tuning && tuning.mode) || 'standard';
  const cfg = (tuning && tuning[mode] && tuning[mode].loops) || {};
  const tickMs = options.tickMs ?? (cfg.loop_tick_ms || 300);
  const commitEveryMs = options.commitEveryMs ?? (cfg.loop_commit_ms || 600);
  const lastCommitRef = useRef(0);
  const accRef = useRef({ cookies: 0, lifetime: 0, mintedUnits: 0, cryptoAdded: 0, buffExpired: false, flashUntil: 0 });

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const stakeM = 1 + (state.crypto?.staked || 0) * 0.5;
      const cpsNow = cpsFrom(state.items, state.upgrades, state.prestige.chips, stakeM) * (now < state.buffs.until ? state.buffs.cpsMulti : 1);
      const dt = tickMs / 1000;

      // Accumule les cookies/lifetime
      accRef.current.cookies += cpsNow * dt;
      accRef.current.lifetime += cpsNow * dt;

      // Pré-calc faucet (basé sur lifetime post-commit approximatif)
      const lifetimeProjected = (state.lifetime || 0) + accRef.current.lifetime;
      const crypto = state.crypto || { perCookies: 20000, perAmount: 0.001, mintedUnits: 0, balance: 0 };
      const units = Math.floor(lifetimeProjected / crypto.perCookies);
      if (units > (crypto.mintedUnits + accRef.current.mintedUnits)) {
        const diff = units - (crypto.mintedUnits + accRef.current.mintedUnits);
        accRef.current.mintedUnits += diff;
        accRef.current.cryptoAdded += diff * crypto.perAmount;
        accRef.current.flashUntil = now + 1500;
      }

      // Buff expiry: si expiré, forcer un commit
      if (state.buffs?.until && now >= state.buffs.until) {
        accRef.current.buffExpired = true;
      }

      const shouldCommit = (now - (lastCommitRef.current || 0)) >= commitEveryMs || accRef.current.mintedUnits > 0 || accRef.current.buffExpired;
      if (!shouldCommit) return;

      lastCommitRef.current = now;
      const acc = accRef.current;
      accRef.current = { cookies: 0, lifetime: 0, mintedUnits: 0, cryptoAdded: 0, buffExpired: false, flashUntil: 0 };

      setState((s) => {
        const now2 = Date.now();
        // Applique les deltas
        let cookies = s.cookies + acc.cookies;
        let lifetime = s.lifetime + acc.lifetime;
        let flags = { ...s.flags };
        let crypto2 = { ...s.crypto };
        let buffs = { ...s.buffs };

        if (acc.mintedUnits > 0) {
          crypto2.mintedUnits = (crypto2.mintedUnits || 0) + acc.mintedUnits;
          crypto2.balance = Number(((crypto2.balance || 0) + acc.cryptoAdded).toFixed(6));
          flags.cryptoFlashUntil = acc.flashUntil || now2 + 1500;
        }

        if (acc.buffExpired) {
          buffs = { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" };
        }

        return { ...s, cookies, lifetime, buffs, crypto: crypto2, flags };
      });
    }, tickMs);

    return () => clearInterval(iv);
  }, [state, setState, tickMs, commitEveryMs]);
}


