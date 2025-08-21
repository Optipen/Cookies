import React from "react";

const ProgressBar = ({ value, label }) => (
  <div className="w-full bg-zinc-800 rounded-xl overflow-hidden shadow-inner">
    <div className="h-2 bg-amber-400" style={{ width: `${value * 100}%` }}></div>
    {label && <div className="text-[10px] text-zinc-400 mt-1">{label}</div>}
  </div>
);

export default function Shop({ state, ITEMS, buy, costOf, perItemMult, fmt, clamp }) {
  return (
    <>
      <div className="text-sm font-semibold text-zinc-300 flex items-center justify-between">
        <span>Boutique</span>
        <span className="text-[11px] text-zinc-500">Astuce: <b>Shift</b>=×10 · <b>Ctrl</b>=×100</span>
      </div>
      {ITEMS.map((it) => {
        const ownedCount = state.items[it.id] || 0;
        const singleBase = Math.ceil(it.base * Math.pow(it.growth, ownedCount));
        const onFlash =
          state.flags.flash &&
          state.flags.flash.itemId === it.id &&
          Date.now() < state.flags.flash.until;
        const price1 = costOf(it.id, 1);
        const affordable = state.cookies >= price1;
        return (
          <button
            key={it.id}
            onClick={(e) => buy(it.id, e.shiftKey ? 10 : e.ctrlKey ? 100 : 1)}
            className={`relative w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${affordable ? "bg-zinc-800/70 hover:bg-zinc-800 border-zinc-700" : "bg-zinc-900/40 border-zinc-800 opacity-70"}`}
          >
            {onFlash && (
              <span className="absolute -top-2 -left-2 text-[10px] px-2 py-0.5 rounded-full bg-pink-600 border border-pink-300">-25% 20s</span>
            )}
            <div className="text-2xl">{it.emoji}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {it.name} <span className="text-xs text-zinc-500">×{ownedCount}</span>
                </div>
                <div className="text-amber-300 font-bold flex items-center gap-2">
                  {onFlash && <span className="line-through text-zinc-500 text-xs">{fmt(singleBase)}</span>}
                  <span>{fmt(price1)}</span>
                </div>
              </div>
              <div className="text-xs text-zinc-400">{it.desc}</div>
              <div className="mt-1">
                <ProgressBar value={clamp(state.cookies / price1, 0, 1)} />
              </div>
            </div>
            <div className="text-right text-xs text-zinc-400 w-24 leading-tight">
              +{fmt((perItemMult[it.id] || 1) * it.cps)} CPS
            </div>
          </button>
        );
      })}
    </>
  );
}

