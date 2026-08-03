import React, { memo, useMemo } from "react";
import { ITEMS } from "../data/items.js";
import { costOf, buyQuantity, deriveStats } from "../utils/selectors.js";
import { fmt, fmtPct } from "../utils/format.js";
import { useClock, useTimeLeft } from "../hooks/useClock.js";

// Compteur de vente flash isolé: seul ce petit composant se rafraîchit
const FlashTimer = memo(function FlashTimer({ until }) {
  const left = useTimeLeft(until, 250);
  if (left <= 0) return null;
  return <span className="tabular-nums">{Math.ceil(left / 1000)}s</span>;
});

const ItemRow = memo(function ItemRow({ item, owned, price, affordable, flash, isFree, qty, onBuy, gainLabel, share }) {
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={!affordable && !isFree}
      aria-label={`${item.name}, ${owned} possédés, coût ${fmt(price)} cookies, ${gainLabel}`}
      className={`group relative w-full text-left p-3 rounded-2xl border flex items-center gap-3 transition-all duration-150 ${
        affordable || isFree
          ? "bg-white/75 border-amber-200 hover:border-amber-400 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
          : "bg-stone-100/60 border-stone-200 opacity-60 cursor-not-allowed"
      }`}
    >
      {flash && (
        <span className="absolute -top-2 -right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-lg animate-pulse">
          -{Math.round(flash.discount * 100)} % <FlashTimer until={flash.until} />
        </span>
      )}

      <span className="text-2xl shrink-0 transition-transform duration-150 group-hover:scale-110" aria-hidden="true">
        {item.emoji}
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-amber-950 truncate">{item.name}</span>
          <span className="text-xs text-amber-700 tabular-nums shrink-0">×{owned}</span>
        </span>

        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={`text-sm font-bold tabular-nums ${
              isFree ? "text-emerald-600" : affordable ? "text-amber-700" : "text-stone-500"
            }`}
          >
            {isFree ? "OFFERT" : fmt(price)}
            {qty > 1 && !isFree && <span className="text-[10px] font-normal text-amber-600"> ×{qty}</span>}
          </span>
          {/* Gain réel après achat, calculé avec la formule du jeu. L'ancienne
              version affichait la contribution brute avant plafonnement:
              « +0,7 clic » pour un gain effectif de 0,476. */}
          <span className="text-[11px] font-semibold text-emerald-700 tabular-nums shrink-0">{gainLabel}</span>
        </span>

        {share > 0 && (
          <span className="mt-1 block h-1 rounded-full bg-amber-100 overflow-hidden">
            <span
              className="block h-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${Math.min(100, share * 100)}%` }}
            />
          </span>
        )}
      </span>
    </button>
  );
});

const Section = memo(function Section({ title, hint, rows, qty, onBuy }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 pt-1">
        <h4 className="text-sm font-bold text-amber-900">{title}</h4>
        {hint && <span className="text-[10px] text-amber-700/80">{hint}</span>}
      </div>
      {rows.map((r) => (
        <ItemRow key={r.item.id} {...r} qty={qty} onBuy={(e) => onBuy(r.item.id, buyQuantity(e))} />
      ))}
    </div>
  );
});

function Shop({ state, filter = "all", onBuy, qty, stats }) {
  // Les remises temporaires expirent: l'horloge partagée rafraîchit les prix
  // sans que le rendu ait à lire l'heure lui-même.
  const now = useClock(500);

  const rows = useMemo(() => {
    const base = deriveStats(state, now, 0);
    return ITEMS.map((item) => {
      const owned = state.items[item.id] || 0;
      const price = costOf(state, item.id, qty, now);
      const next = deriveStats({ ...state, items: { ...state.items, [item.id]: owned + qty } }, now, 0);

      const dCps = next.cps - base.cps;
      const dCpc = next.cpcBase - base.cpcBase;
      const gainLabel = item.mode === "cps" ? `+${fmt(dCps)} /s` : `+${fmt(dCpc)} /clic`;

      // Part de ce bâtiment dans le total de sa famille, pour la barre
      const share =
        item.mode === "cps"
          ? base.baseCps > 0
            ? (owned * item.cps * (base.perItemMult[item.id] || 1)) / base.baseCps
            : 0
          : base.clickWeight > 0
            ? (owned * item.mult * (base.perItemMult[item.id] || 1)) / base.clickWeight
            : 0;

      const flash =
        state.flags?.flash && state.flags.flash.itemId === item.id && now < state.flags.flash.until
          ? state.flags.flash
          : null;

      return {
        item,
        owned,
        price,
        flash,
        share,
        gainLabel,
        isFree: price === 0,
        affordable: state.cookies >= price,
      };
    });
  }, [now, state, qty]);

  const clickRows = rows.filter((r) => r.item.mode === "mult");
  const autoRows = rows.filter((r) => r.item.mode === "cps");

  return (
    <div className="space-y-3">
      {filter !== "cps" && (
        <Section
          title="👆 Puissance de clic"
          hint={`${fmtPct(stats.clickShare, 2)} de ta production par clic`}
          rows={clickRows}
          qty={qty}
          onBuy={onBuy}
        />
      )}
      {filter !== "mult" && (
        <Section title="⚙️ Production automatique" hint={`${fmt(stats.cps)} /s`} rows={autoRows} qty={qty} onBuy={onBuy} />
      )}
    </div>
  );
}

export default memo(Shop);
