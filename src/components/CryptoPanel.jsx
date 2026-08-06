import React, { memo, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import {
  CRMB,
  MINERS,
  STAKE_TIERS,
  getTier,
  coutAchatCrmb,
  gainVenteCrmb,
  priceTrend,
  minerCost,
  stakedTotal,
  stakingBoost,
  isUnlocked,
  ledgerCost,
} from "../utils/crypto.js";
import { fmt, fmtPrix, fmtCrmb, fmtMult, fmtPct, fmtDuration } from "../utils/format.js";
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

  if (!path) return <div className="h-16" />;
  const up = history[history.length - 1] >= history[0];
  // Le cours monte en turquoise (la couleur du CRMB), descend en braise.
  const color = up ? "#6fd8cf" : "#ff5c38";

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-16" role="img" aria-label="Évolution du cours CRMB">
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
    <li className="flex items-center justify-between gap-2 rounded-2xl border border-crmb/20 bg-crmb/5 p-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-crmb/25 bg-crmb/10 text-crmb">
        <Icon name="lock" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold tabular-nums text-cream">{fmtCrmb(position.amount)} CRMB</div>
        <div className="text-[10px] text-cream/50">
          {tier.name} · {fmtPct(tier.perDay)} par jour
          {!unlocked && <span className="text-lava"> · {fmtDuration(remaining)}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onUnstake(position.id)}
        disabled={!unlocked}
        className={`min-h-11 shrink-0 rounded-xl px-3 text-[11px] ${unlocked ? "btn-ghost" : "btn-dead"}`}
      >
        {unlocked ? "Retirer" : "Verrouillé"}
      </button>
    </li>
  );
});

function CryptoPanel({ state, stats, onBuy, onSell, onStake, onUnstake, onBuyMiner, onSignLedger }) {
  const crypto = state.crypto || {};
  const [tradeAmount, setTradeAmount] = useState(1);
  const [stakeAmount, setStakeAmount] = useState(1);
  const [tierId, setTierId] = useState("flex");

  const price = crypto.price || CRMB.basePrice;
  const trend = priceTrend(crypto.priceHistory);
  const positions = crypto.positions || [];
  const staked = stakedTotal(positions);
  const boost = stakingBoost(positions);

  // Les montants affichés sont les montants appliqués: entiers de cookies,
  // arrondis contre le joueur d'au plus un cookie (plafond à l'achat,
  // plancher à la vente) — exactement ce que `cryptoBuy`/`cryptoSell` feront.
  const buyCost = coutAchatCrmb(price, tradeAmount);
  const sellGain = gainVenteCrmb(price, tradeAmount);
  const canBuy = state.cookies >= buyCost && tradeAmount > 0;
  const canSell = (crypto.balance || 0) >= tradeAmount && tradeAmount > 0;
  const canStake = (crypto.balance || 0) >= stakeAmount && stakeAmount > 0;
  const signes = crypto.ledger || 0;
  const prixContrat = ledgerCost(signes);
  const peutSigner = (crypto.balance || 0) >= prixContrat;

  const amounts = [1, 5, 10, 25];

  return (
    <div className="space-y-4">
      {/* --- Marché --- */}
      <section className="rounded-3xl border border-crmb/20 bg-gradient-to-br from-crmb/[0.09] to-crmb/[0.02] p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-xl text-cream-bright">CrumbCoin</h3>
          <span className="text-[11px] font-bold tabular-nums text-crmb">1 CRMB = {fmt(price)}</span>
        </div>

        <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-cream/45">Portefeuille</div>
        <div className="flex items-baseline gap-2">
          <span data-testid="crmb-solde" className="text-[2rem] font-extrabold leading-none tabular-nums text-crmb">
            {fmtCrmb(crypto.balance || 0)}
          </span>
          <span className="text-[11px] font-bold text-crmb/60">CRMB</span>
          {/* centimes × cours entier peut rendre un demi-cookie: la valeur
              indicative s'affiche en entier plancher, comme toute estimation. */}
          <span className="text-[10.5px] tabular-nums text-cream/45">
            ≈ {fmt(Math.floor((crypto.balance || 0) * price))} cookies
          </span>
        </div>

        <PriceChart history={crypto.priceHistory} />

        <div className="flex items-center justify-between text-[9px] font-semibold tabular-nums text-cream/35">
          <span>historique</span>
          <span className={trend >= 0 ? "text-mint" : "text-lava"}>
            {trend >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(trend), 1)}
          </span>
        </div>

        <div className="mt-3 flex gap-1.5" role="group" aria-label="Quantité à échanger">
          {amounts.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setTradeAmount(a)}
              className={`min-h-11 flex-1 rounded-xl text-[11px] ${
                tradeAmount === a ? "btn-honey" : "btn-ghost"
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
            className={`rounded-2xl px-3 py-2.5 text-[13px] ${canBuy ? "btn-honey" : "btn-dead"}`}
          >
            Acheter
            <span className="block text-[10px] font-semibold tabular-nums opacity-75">{fmtPrix(buyCost)}</span>
          </button>
          <button
            type="button"
            onClick={() => onSell(tradeAmount)}
            disabled={!canSell}
            className={`rounded-2xl px-3 py-2.5 text-[13px] ${
              canSell ? "btn-ghost border-crmb/35 text-crmb" : "btn-dead"
            }`}
          >
            Vendre
            <span className="block text-[10px] font-semibold tabular-nums opacity-75">+{fmtPrix(sellGain)}</span>
          </button>
        </div>
        <p className="mt-2 text-[10px] text-cream/45">
          Frais de marché {Math.round(CRMB.spread * 100)} % · Gains/pertes réalisés :{" "}
          <b className={(crypto.realizedPnl || 0) >= 0 ? "text-mint" : "text-lava"}>
            {(crypto.realizedPnl || 0) >= 0 ? "+" : ""}
            {fmt(crypto.realizedPnl || 0)}
          </b>
        </p>
      </section>

      {/* --- Staking --- */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="eyebrow">Staking</h3>
          <span className="pill pill-mint">Production {fmtPct(boost - 1, 1)}</span>
        </div>
        <p className="mb-2 text-[10px] text-cream/50">
          {/* Le rendement se lit PAR JOUR, comme les paliers l'annoncent, et en
              centimes: « ≈0,08 CRMB/j ». Sous le demi-centime: « <0,01 ». */}
          {fmtCrmb(staked)} CRMB bloqués · rendement ≈{fmtCrmb(stats.stakingYield * 86_400)} CRMB/j
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          {STAKE_TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierId(t.id)}
              className={`min-h-11 rounded-2xl px-2.5 py-2 text-left ${tierId === t.id ? "btn-honey" : "btn-ghost"}`}
            >
              <div className="text-[11px] font-bold">{t.name}</div>
              <div className={`text-[9.5px] ${tierId === t.id ? "opacity-75" : "text-cream/45"}`}>
                {fmtPct(t.perDay)} par jour · poids ×{t.boostMult}
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
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-honey/20 bg-honey-light/5 px-3 text-sm tabular-nums text-cream focus:outline-none focus:ring-2 focus:ring-honey"
          />
          <button
            type="button"
            onClick={() => setStakeAmount(crypto.balance || 0)}
            className="btn-ghost min-h-11 min-w-11 rounded-xl px-3 text-[11px]"
          >
            Max
          </button>
          <button
            type="button"
            onClick={() => onStake(stakeAmount, tierId)}
            disabled={!canStake}
            className={`min-h-11 rounded-xl px-4 text-[12px] ${canStake ? "btn-honey" : "btn-dead"}`}
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

      {/* --- Le Registre --- */}
      <section className="panel rounded-3xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 font-display text-lg text-cream-bright">
            <Icon name="scroll" size={16} className="text-honey" />
            Le Registre
          </h3>
          <span className="pill tabular-nums">
            {signes} contrat{signes > 1 ? "s" : ""} · ×{fmtMult(1 + 0.25 * signes)}
          </span>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-cream/55">
          Un contrat ajoute <b className="text-cream">+0,25</b> à la puissance de clic <i>et</i> au minage.{" "}
          <b className="text-cream">Définitivement</b> : il survit aux renaissances. Contrairement au staking, le CRMB
          dépensé ne revient pas.
        </p>
        <button
          type="button"
          onClick={onSignLedger}
          disabled={!peutSigner}
          className={`mt-3 min-h-[2.75rem] w-full rounded-2xl px-3 text-[12.5px] ${
            peutSigner ? "btn-honey" : "btn-dead"
          }`}
        >
          Signer un contrat — {fmtCrmb(prixContrat)} CRMB
        </button>
        {!peutSigner && (
          <p className="mt-1.5 text-center text-[10px] text-cream/45">
            Il te manque {fmtCrmb(prixContrat - (crypto.balance || 0))} CRMB.
          </p>
        )}
      </section>

      {/* --- Minage --- */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="eyebrow">Machines de minage</h3>
          <span className="pill pill-crmb tabular-nums">
            {/* Taux posé au centième par heure dans le moteur: exact, pas ≈. */}
            {fmtCrmb(stats.crmbRate * 3600)} CRMB/h
          </span>
        </div>
        <p className="mb-2 text-[10px] text-cream/45">
          Total extrait : {fmtCrmb(crypto.totalMined || 0)} CRMB · le matériel tourne aussi hors-ligne.
        </p>

        <div className="space-y-2">
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
                className={`flex min-h-11 w-full items-center gap-3 rounded-[18px] p-2.5 text-left transition-all ${
                  affordable ? "panel hover:-translate-y-0.5 hover:border-honey/30" : "panel-muted opacity-70 cursor-not-allowed"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border ${
                    affordable ? "border-honey/20 bg-honey/10 text-honey-light" : "border-honey/10 bg-honey/5 text-cream/40"
                  }`}
                  aria-hidden="true"
                >
                  <Icon emoji={m.emoji} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2">
                    <span className="truncate text-[12px] font-bold text-cream">{m.name}</span>
                    <span className="text-[10px] tabular-nums text-crmb">×{owned}</span>
                  </span>
                  <span className="flex justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums ${
                        affordable ? "text-honey" : "text-cream/40"
                      }`}
                    >
                      <Icon name="coin" size={11} />
                      {/* `fmtPrix` et non `fmt`: un prix affiché est un prix
                          payé, la forme compacte n'est admise que si elle est
                          exacte. Même règle que la boutique. */}
                      {fmtPrix(cost)}
                    </span>
                    <span className="text-[10.5px] font-bold tabular-nums text-crmb">+{fmtCrmb(m.perHour, 2)}/h</span>
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
