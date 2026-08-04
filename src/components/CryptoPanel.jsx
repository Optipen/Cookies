import React, { memo, useMemo, useState } from "react";
import {
  CRMB,
  MINERS,
  STAKE_TIERS,
  getTier,
  buyPrice,
  sellPrice,
  priceTrend,
  minerCost,
  stakedTotal,
  stakingBoost,
  isUnlocked,
} from "../utils/crypto.js";
import { fmt, fmtCrmb, fmtPct, fmtDuration } from "../utils/format.js";
import { useClock } from "../hooks/useClock.js";

// --- Graphique de cours en SVG pur (aucune dépendance) ---------------------
const PriceChart = memo(function PriceChart({ history }) {
  const path = useMemo(() => {
    if (!history || history.length < 2) return null;
    const w = 100;
    const h = 32;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = max - min || 1;
    const pts = history.map((p, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((p - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { line: `M ${pts.join(" L ")}`, area: `M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z` };
  }, [history]);

  if (!path) return <div className="h-8" />;
  const up = history[history.length - 1] >= history[0];
  const color = up ? "#059669" : "#dc2626";

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-8" role="img" aria-label="Évolution du cours CRMB">
      <defs>
        <linearGradient id="crmb-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#crmb-fill)" />
      <path d={path.line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
});

// --- Position de staking ---------------------------------------------------
const StakePosition = memo(function StakePosition({ position, onUnstake }) {
  const now = useClock(1000);
  const tier = getTier(position.tierId);
  const unlocked = isUnlocked(position, now);
  const remaining = Math.max(0, (position.unlockAt || 0) - now);

  return (
    <li className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/70 border border-cyan-200">
      <div className="min-w-0">
        <div className="text-sm font-bold text-cyan-950 tabular-nums">{fmtCrmb(position.amount)} CRMB</div>
        <div className="text-[11px] text-cyan-700">
          {tier.name} · {fmtPct(tier.apr)} APR
          {!unlocked && <span className="text-orange-600"> · 🔒 {fmtDuration(remaining)}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onUnstake(position.id)}
        disabled={!unlocked}
        className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
          unlocked
            ? "bg-white border-cyan-300 text-cyan-800 hover:bg-cyan-50"
            : "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
        }`}
      >
        {unlocked ? "Retirer" : "Verrouillé"}
      </button>
    </li>
  );
});

function CryptoPanel({ state, stats, onBuy, onSell, onStake, onUnstake, onBuyMiner }) {
  const crypto = state.crypto || {};
  const [tradeAmount, setTradeAmount] = useState(0.1);
  const [stakeAmount, setStakeAmount] = useState(0.1);
  const [tierId, setTierId] = useState("flex");

  const price = crypto.price || CRMB.basePrice;
  const trend = priceTrend(crypto.priceHistory);
  const positions = crypto.positions || [];
  const staked = stakedTotal(positions);
  const boost = stakingBoost(positions);

  const buyCost = buyPrice(price) * tradeAmount;
  const sellGain = sellPrice(price) * tradeAmount;
  const canBuy = state.cookies >= buyCost && tradeAmount > 0;
  const canSell = (crypto.balance || 0) >= tradeAmount && tradeAmount > 0;
  const canStake = (crypto.balance || 0) >= stakeAmount && stakeAmount > 0;

  const amounts = [0.01, 0.1, 1, 10];

  return (
    <div className="space-y-4">
      {/* --- Marché --- */}
      <section className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-cyan-950 flex items-center gap-1.5">🪙 CrumbCoin</h3>
            <div className="text-[11px] text-cyan-700">Marché en temps réel</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-cyan-900 tabular-nums leading-none">{fmt(price)}</div>
            <div className={`text-xs font-bold tabular-nums ${trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {trend >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(trend), 1)}
            </div>
          </div>
        </div>

        <PriceChart history={crypto.priceHistory} />

        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-white/70 border border-cyan-200 px-2 py-1.5">
            <div className="text-cyan-700">Portefeuille</div>
            <div data-testid="crmb-solde" className="font-bold text-cyan-950 tabular-nums">
              {fmtCrmb(crypto.balance || 0)} CRMB
            </div>
          </div>
          <div className="rounded-lg bg-white/70 border border-cyan-200 px-2 py-1.5">
            <div className="text-cyan-700">Valeur</div>
            <div className="font-bold text-cyan-950 tabular-nums">{fmt((crypto.balance || 0) * price)}</div>
          </div>
        </div>

        <div className="mt-2 flex gap-1" role="group" aria-label="Quantité à échanger">
          {amounts.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setTradeAmount(a)}
              className={`flex-1 text-[11px] py-1 rounded-md border font-semibold transition-colors ${
                tradeAmount === a ? "bg-cyan-600 border-cyan-600 text-white" : "bg-white/70 border-cyan-200 text-cyan-800 hover:bg-cyan-50"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onBuy(tradeAmount)}
            disabled={!canBuy}
            className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${
              canBuy
                ? "bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-400 shadow hover:shadow-md"
                : "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            Acheter
            <span className="block text-[10px] font-normal tabular-nums opacity-90">{fmt(buyCost)} 🍪</span>
          </button>
          <button
            type="button"
            onClick={() => onSell(tradeAmount)}
            disabled={!canSell}
            className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${
              canSell
                ? "bg-red-500 border-red-600 text-white hover:bg-red-400 shadow hover:shadow-md"
                : "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            Vendre
            <span className="block text-[10px] font-normal tabular-nums opacity-90">+{fmt(sellGain)} 🍪</span>
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-cyan-700/80">
          Frais de marché {Math.round(CRMB.spread * 100)} % · Gains/pertes réalisés : {" "}
          <b className={(crypto.realizedPnl || 0) >= 0 ? "text-emerald-700" : "text-red-700"}>
            {(crypto.realizedPnl || 0) >= 0 ? "+" : ""}
            {fmt(crypto.realizedPnl || 0)}
          </b>
        </p>
      </section>

      {/* --- Staking --- */}
      <section className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-violet-950">🔒 Staking</h3>
          <span className="text-xs font-bold text-violet-800 bg-violet-100 px-2 py-1 rounded-lg">
            Production {fmtPct(boost - 1, 1)}
          </span>
        </div>
        <p className="text-[11px] text-violet-700 mt-0.5">
          {fmtCrmb(staked)} CRMB bloqués · rendement {fmtCrmb(stats.stakingYield * 3600, 4)} CRMB/h
        </p>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {STAKE_TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierId(t.id)}
              className={`text-left px-2 py-1.5 rounded-lg border transition-colors ${
                tierId === t.id ? "bg-violet-600 border-violet-700 text-white" : "bg-white/70 border-violet-200 text-violet-900 hover:bg-violet-50"
              }`}
            >
              <div className="text-xs font-bold">{t.name}</div>
              <div className={`text-[10px] ${tierId === t.id ? "text-violet-100" : "text-violet-600"}`}>
                {fmtPct(t.apr)} APR · boost ×{t.boostMult}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5">
          <input
            type="number"
            min="0"
            step="0.01"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Montant à bloquer"
            className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded-lg border border-violet-200 bg-white/80 text-violet-950 tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button
            type="button"
            onClick={() => setStakeAmount(crypto.balance || 0)}
            className="text-xs px-2 rounded-lg border border-violet-200 bg-white/70 text-violet-800 hover:bg-violet-50"
          >
            Max
          </button>
          <button
            type="button"
            onClick={() => onStake(stakeAmount, tierId)}
            disabled={!canStake}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
              canStake
                ? "bg-violet-600 border-violet-700 text-white hover:bg-violet-500"
                : "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            Bloquer
          </button>
        </div>

        {positions.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {positions.map((p) => (
              <StakePosition key={p.id} position={p} onUnstake={onUnstake} />
            ))}
          </ul>
        )}
      </section>

      {/* --- Minage --- */}
      <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-zinc-50 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">🖥️ Extraction CRMB</h3>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg tabular-nums">
            {fmtCrmb(stats.crmbRate * 3600, 4)} CRMB/h
          </span>
        </div>
        <p className="text-[11px] text-slate-600 mt-0.5">
          Total extrait : {fmtCrmb(crypto.totalMined || 0)} CRMB · le matériel tourne aussi hors-ligne.
        </p>

        <div className="mt-2 space-y-1.5">
          {MINERS.map((m) => {
            const owned = crypto.miners?.[m.id] || 0;
            const cost = minerCost(m.id, owned);
            const affordable = state.cookies >= cost;
            // Un mineur reste caché tant qu'il est hors de portée: pas de mur de boutons grisés
            if (!owned && cost > state.cookies * 25) return null;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onBuyMiner(m.id)}
                disabled={!affordable}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
                  affordable
                    ? "bg-white/80 border-slate-200 hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5"
                    : "bg-stone-100/60 border-stone-200 opacity-60 cursor-not-allowed"
                }`}
              >
                <span className="text-xl" aria-hidden="true">
                  {m.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">{m.name}</span>
                    <span className="text-xs text-slate-500 tabular-nums">×{owned}</span>
                  </span>
                  <span className="flex justify-between gap-2">
                    <span className={`text-xs font-bold tabular-nums ${affordable ? "text-slate-700" : "text-stone-400"}`}>
                      {fmt(cost)} 🍪
                    </span>
                    <span className="text-[11px] text-cyan-700 tabular-nums">+{fmtCrmb(m.rate * 3600, 3)}/h</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default memo(CryptoPanel);
