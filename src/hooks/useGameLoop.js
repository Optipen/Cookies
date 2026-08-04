import { useEffect, useRef } from "react";
import { useLatestRef } from "./useLatestRef.js";
import { deriveStats } from "../utils/selectors.js";
import { stepMarket, addCrmb, CRMB } from "../utils/crypto.js";
import tuning from "../data/tuning.json";

/**
 * Boucle de jeu unique.
 *
 * Toute la simulation (production, faucet, minage, staking, marché, temps de
 * jeu) est regroupée dans un seul commit périodique. C'est ce qui garde le jeu
 * fluide: un `setState` toutes les ~500 ms au lieu d'un par sous-système.
 *
 * L'état est lu via un ref, donc acheter un bâtiment ou changer d'onglet ne
 * redémarre jamais l'intervalle.
 */
export function useGameLoop(state, setState, options = {}) {
  const cfg = tuning?.[tuning?.mode || "standard"]?.loops || {};
  const tickMs = options.tickMs ?? cfg.loop_tick_ms ?? 250;
  const commitMs = options.commitMs ?? cfg.loop_commit_ms ?? 500;

  const stateRef = useLatestRef(state);
  const setStateRef = useLatestRef(setState);
  const accRef = useRef({ cookies: 0, crmb: 0, elapsed: 0 });
  const lastCommitRef = useRef(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    lastCommitRef.current = Date.now();
    lastTickRef.current = Date.now();

    const tick = () => {
      const s = stateRef.current;
      if (!s) return;

      const now = Date.now();
      // Temps réellement écoulé plutôt que la période nominale: un onglet
      // ralenti ne sous-produit plus, un onglet gelé ne sur-produit pas.
      const dt = Math.min(5, Math.max(0, (now - lastTickRef.current) / 1000));
      lastTickRef.current = now;

      const stats = deriveStats(s, now);
      const acc = accRef.current;
      acc.cookies += stats.cps * dt;
      // `crmbRate`, pas `miningRate`: ce dernier n'existe pas dans deriveStats.
      // La faute rendait la somme NaN, `mined > 0` faux, et le matériel de
      // minage comme le staking ne créditaient donc JAMAIS le moindre CRMB.
      acc.crmb += (stats.crmbRate + stats.stakingYield) * dt;
      acc.elapsed += dt * 1000;

      const buffJustExpired = (s.buffs?.until || 0) > 0 && now >= s.buffs.until;
      const marketDue = now - (s.crypto?.lastMarketTs || 0) >= CRMB.tickMs;

      if (now - lastCommitRef.current < commitMs && !buffJustExpired && !marketDue) return;
      lastCommitRef.current = now;

      const gained = acc.cookies;
      const mined = acc.crmb;
      const elapsed = acc.elapsed;
      acc.cookies = 0;
      acc.crmb = 0;
      acc.elapsed = 0;

      setStateRef.current((prev) => {
        const now2 = Date.now();
        const next = { ...prev };

        if (gained > 0) {
          next.cookies = prev.cookies + gained;
          next.lifetime = prev.lifetime + gained;
        }

        // Buff expiré: retour aux multiplicateurs neutres
        if ((prev.buffs?.until || 0) > 0 && now2 >= prev.buffs.until) {
          next.buffs = { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" };
        }

        const crypto = { ...prev.crypto };
        let cryptoTouched = false;
        const lifetime = next.lifetime ?? prev.lifetime;

        // Il n'y a plus de faucet. Cuire des cookies ne rapporte aucun CRMB:
        // c'est une monnaie de récompense, versée par les quêtes, les gros
        // paliers, les succès qui comptent et les renaissances. L'ancien
        // robinet (0,001 tous les 20 000 cookies) en versait des centaines de
        // millions en fin de partie, et plus rien n'avait de valeur.

        // Minage matériel + rendement de staking. `addCrmb` rejette le seul
        // delta fautif: un rendement mal calculé ne doit pas emporter le
        // portefeuille avec lui.
        if (mined > 0) {
          crypto.balance = addCrmb(crypto.balance, mined);
          crypto.totalMined = addCrmb(crypto.totalMined, mined);
          cryptoTouched = true;
        }

        // Marché: un pas toutes les CRMB.tickMs
        if (now2 - (crypto.lastMarketTs || 0) >= CRMB.tickMs) {
          const { price, priceHistory } = stepMarket(crypto, lifetime);
          crypto.price = price;
          crypto.priceHistory = priceHistory;
          crypto.lastMarketTs = now2;
          cryptoTouched = true;
        }

        if (cryptoTouched) next.crypto = crypto;

        if (elapsed > 0) {
          const stats2 = deriveStats(next, now2);
          next.stats = {
            ...prev.stats,
            playtimeMs: (prev.stats?.playtimeMs || 0) + elapsed,
            bestCps: Math.max(prev.stats?.bestCps || 0, stats2.cps),
          };
        }

        next.lastTs = now2;
        return next;
      });
    };

    const iv = setInterval(tick, tickMs);
    return () => clearInterval(iv);
  }, [tickMs, commitMs, stateRef, setStateRef]);
}
