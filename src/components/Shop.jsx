import React, { memo, useMemo } from "react";
import { ITEMS } from "../data/items.js";
import { costOf, buyQuantity } from "../utils/selectors.js";
import { fmt } from "../utils/format.js";
import { useTimeLeft } from "../hooks/useClock.js";

// Compteur de vente flash isolé: seul ce petit composant se rafraîchit
const FlashTimer = memo(function FlashTimer({ until }) {
  const left = useTimeLeft(until, 250);
  if (left <= 0) return null;
  return <span className="tabular-nums">{Math.ceil(left / 1000)}s</span>;
});

const ItemRow = memo(function ItemRow({ item, owned, price, affordable, perItem, flash, isFree, qty, onBuy, contribution }) {
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={!affordable && !isFree}
      aria-label={`${item.name}, ${owned} possédés, coût ${fmt(price)} cookies`}
      className={`group relative w-full text-left p-3 rounded-2xl border flex items-center gap-3 transition-all duration-150 ${
        affordable || isFree
          ? "bg-white/70 border-amber-200 hover:border-amber-400 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
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

        <span className="block text-[11px] text-amber-800/70 truncate">{item.desc}</span>

        <span className="mt-1 flex items-center justify-between gap-2">
          <span
            className={`text-sm font-bold tabular-nums ${
              isFree ? "text-emerald-600" : affordable ? "text-amber-700" : "text-stone-500"
            }`}
          >
            {isFree ? "OFFERT" : fmt(price)}
            {qty > 1 && !isFree && <span className="text-[10px] font-normal text-amber-600"> ×{qty}</span>}
          </span>
          <span className="text-[11px] text-emerald-700 font-medium tabular-nums">
            {item.mode === "cps" ? `+${fmt(item.cps * perItem)} CPS` : `+${fmt(item.mult * perItem)} clic`}
          </span>
        </span>

        {owned > 0 && contribution > 0 && (
          <span className="mt-1 block h-1 rounded-full bg-amber-100 overflow-hidden">
            <span
              className="block h-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${Math.min(100, contribution * 100)}%` }}
            />
          </span>
        )}
      </span>
    </button>
  );
});

function Shop({ state, mode, onBuy, perItemMult, qty, totalCps, totalClickMult }) {
  const now = Date.now();
  const list = useMemo(() => ITEMS.filter((it) => (mode === "auto" ? it.mode === "cps" : it.mode === "mult")), [mode]);

  const rows = useMemo(
    () =>
      list.map((item) => {
        const owned = state.items[item.id] || 0;
        const price = costOf(state, item.id, qty, now);
        const perItem = perItemMult[item.id] || 1;
        const flash =
          state.flags?.flash && state.flags.flash.itemId === item.id && now < state.flags.flash.until
            ? state.flags.flash
            : null;
        // Part de ce bâtiment dans la production totale, pour la barre de contribution
        const contribution =
          item.mode === "cps"
            ? totalCps > 0
              ? (owned * item.cps * perItem) / totalCps
              : 0
            : totalClickMult > 1
              ? (owned * item.mult * perItem) / (totalClickMult - 1)
              : 0;
        return { item, owned, price, perItem, flash, contribution };
      }),
    // `now` change à chaque rendu: la liste est recalculée à la cadence du jeu (2 Hz),
    // ce qui reste négligeable pour 7 lignes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, state.items, state.cookies, state.flags, state.upgrades, qty, perItemMult, totalCps, totalClickMult]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 pb-1">
        <h3 className="text-base font-bold text-amber-950">{mode === "auto" ? "Production automatique" : "Puissance de clic"}</h3>
        <span className="text-[11px] text-amber-700 bg-amber-100/70 px-2 py-1 rounded-lg">
          <kbd className="font-semibold">Maj</kbd> ×10 · <kbd className="font-semibold">Ctrl</kbd> ×100
        </span>
      </div>

      {rows.map(({ item, owned, price, perItem, flash, contribution }) => (
        <ItemRow
          key={item.id}
          item={item}
          owned={owned}
          price={price}
          perItem={perItem}
          flash={flash}
          contribution={contribution}
          qty={qty}
          isFree={price === 0}
          affordable={state.cookies >= price}
          onBuy={(e) => onBuy(item.id, buyQuantity(e))}
        />
      ))}
    </div>
  );
}

export default memo(Shop);
