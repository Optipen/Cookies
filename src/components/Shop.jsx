import React, { memo, useCallback, useMemo } from "react";
import { CLICKERS, MINER_ITEMS, LABELS } from "../data/items.js";
import { costOf, buyQuantity, deriveStats, timeToAfford } from "../utils/selectors.js";
import { fmt, fmtDuration } from "../utils/format.js";
import { useClock, useTimeLeft } from "../hooks/useClock.js";

// Compteur de vente flash isolé: seul ce petit composant se rafraîchit
const FlashTimer = memo(function FlashTimer({ until }) {
  const left = useTimeLeft(until, 250);
  if (left <= 0) return null;
  return <span className="tabular-nums">{Math.ceil(left / 1000)}s</span>;
});

const ItemRow = memo(function ItemRow({
  item,
  owned,
  price,
  affordable,
  flash,
  isFree,
  qty,
  onBuy,
  before,
  after,
  bonus,
  unit,
  eta,
}) {
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={!affordable && !isFree}
      aria-label={`${item.name}, ${owned} possédés, coût ${fmt(price)} cookies, fait passer de ${fmt(before)} à ${fmt(after)} ${unit}`}
      className={`group relative w-full text-left p-3 rounded-2xl border flex items-center gap-3 transition-all duration-150 ${
        affordable || isFree
          ? "bg-white/80 border-amber-200 hover:border-amber-400 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
          : "bg-stone-100/60 border-stone-200 opacity-65 cursor-not-allowed"
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

        {/* Avant → après: le joueur voit exactement ce que l'achat change. */}
        <span className="mt-0.5 flex items-baseline gap-1.5 text-[11px] tabular-nums">
          <span className="text-amber-800/70">{fmt(before)}</span>
          <span className="text-amber-500" aria-hidden="true">
            →
          </span>
          <span className="font-bold text-emerald-700">
            {fmt(after)} {unit}
          </span>
          <span className="ml-auto font-semibold text-emerald-600">+{fmt(bonus)}</span>
        </span>

        <span className="mt-1 flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-bold tabular-nums ${
              isFree ? "text-emerald-600" : affordable ? "text-amber-700" : "text-stone-500"
            }`}
          >
            {isFree ? "OFFERT" : fmt(price)}
            {qty > 1 && !isFree && <span className="text-[10px] font-normal text-amber-600"> ×{qty}</span>}
          </span>
          {!affordable && !isFree && eta != null && isFinite(eta) && (
            <span className="text-[10px] text-amber-600/90 tabular-nums">dans ~{fmtDuration(eta)}</span>
          )}
        </span>
      </span>
    </button>
  );
});

const Section = memo(function Section({ label, total, unit, rows, qty, onBuy }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 pt-1">
        <h4 className="text-sm font-bold text-amber-900">
          {label.icon} {label.many}
        </h4>
        <span className="text-[11px] text-amber-700 tabular-nums">
          {label.axis} : <b>{fmt(total)}</b> {unit}
        </span>
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

  const build = useCallback((list) => {
    const base = deriveStats(state, now, 0);
    return list.map((item) => {
      const owned = state.items[item.id] || 0;
      const price = costOf(state, item.id, qty, now);
      const next = deriveStats({ ...state, items: { ...state.items, [item.id]: owned + qty } }, now, 0);

      const isClick = item.mode === "click";
      const before = isClick ? base.perClickNoCombo : base.mining;
      const after = isClick ? next.perClickNoCombo : next.mining;

      const flash =
        state.flags?.flash && state.flags.flash.itemId === item.id && now < state.flags.flash.until
          ? state.flags.flash
          : null;

      return {
        item,
        owned,
        price,
        flash,
        before,
        after,
        bonus: after - before,
        unit: LABELS[item.mode].unit,
        isFree: price === 0,
        affordable: state.cookies >= price,
        eta: timeToAfford(state, price, base, 5),
      };
    });
  }, [state, qty, now]);

  const clickRows = useMemo(() => (filter === "mine" ? [] : build(CLICKERS)), [build, filter]);
  const mineRows = useMemo(() => (filter === "click" ? [] : build(MINER_ITEMS)), [build, filter]);

  return (
    <div className="space-y-3">
      <Section
        label={LABELS.click}
        total={stats.perClickNoCombo}
        unit={LABELS.click.unit}
        rows={clickRows}
        qty={qty}
        onBuy={onBuy}
      />
      <Section
        label={LABELS.mine}
        total={stats.mining}
        unit={LABELS.mine.unit}
        rows={mineRows}
        qty={qty}
        onBuy={onBuy}
      />
    </div>
  );
}

export default memo(Shop);
