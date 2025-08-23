import React from "react";
import Tooltip from "./Tooltip.jsx";

const ProgressBar = ({ value, label }) => (
  <div className="w-full rounded-xl overflow-hidden bg-zinc-800/50 border border-zinc-700/60 relative">
    <div className="h-2 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" style={{ width: `${value * 100}%` }} />
    <div className="absolute inset-y-0 left-0 right-0 progress-shimmer" />
    {label && <div className="text-[10px] text-zinc-400 mt-1">{label}</div>}
  </div>
);

export default function Shop({ state, ITEMS, buy, costOf, perItemMult, fmt, clamp, tutorialStep }) {
  return (
    <>
      <div className="text-sm font-semibold text-zinc-200 flex items-center justify-between">
        <span>Boutique</span>
        <span className="text-[11px] text-zinc-400">Astuce: <b>Shift</b>=×10 · <b>Ctrl</b>=×100</span>
      </div>
      <div className="mt-2 text-xs font-semibold text-zinc-300">Clics (manuels)</div>
      {ITEMS.filter((it) => it.mode === 'mult').map((it) => {
        const ownedCount = state.items[it.id] || 0;
        const singleBase = Math.ceil(it.base * Math.pow(it.growth, ownedCount));
        const onFlash =
          state.flags.flash &&
          state.flags.flash.itemId === it.id &&
          Date.now() < state.flags.flash.until;
        const price1 = costOf(it.id, 1);
        const isFirstFreeCursor = (!state.ui.introSeen && tutorialStep === 2 && it.id === 'cursor' && ownedCount === 0 && price1 === 0);
        const preDiscountPrice = onFlash && state.flags.flash?.discount ? Math.ceil(price1 / (1 - state.flags.flash.discount)) : null;
        const affordable = state.cookies >= price1;
        return (
          <Tooltip
            key={it.id}
            position="right"
            panel={(
              <div className="max-w-[220px] space-y-1">
                <div className="font-semibold text-zinc-100">{it.name}</div>
                <div className="text-zinc-300">+{fmt((perItemMult[it.id] || 1) * (it.mult || 0))} CPC</div>
                <div className="text-zinc-400">Coût: {isFirstFreeCursor ? "0" : fmt(price1)} · Suivant: {fmt(Math.ceil(price1 * it.growth))}</div>
                <div className="text-zinc-500">{it.desc}</div>
              </div>
            )}
            className="block"
          >
          <button
            key={it.id}
            onClick={(e) => buy(it.id, e.shiftKey ? 10 : e.ctrlKey ? 100 : 1)}
            className={`relative w-full text-left p-3 rounded-2xl border flex items-center gap-3 btn-pressable transition ${
              affordable
                ? "glass-neon hover:border-sky-400/60"
                : "bg-zinc-900/40 border-zinc-800 opacity-70"
            } ${isFirstFreeCursor ? "animate-pulse ring-2 ring-cyan-300/60" : ""} card-shadow`}
          >
            {onFlash && (
              <span className="absolute -top-2 -left-2 text-[10px] px-2 py-0.5 rounded-full bg-pink-600/80 border border-pink-300/70 shadow">-25% 20s</span>
            )}
            {isFirstFreeCursor && (
              <span className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/80 border border-emerald-300/70 shadow">Gratuit</span>
            )}
            <div className="text-2xl drop-shadow">{it.emoji}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {it.name} <span className="text-xs text-zinc-500">×{ownedCount}</span>
                </div>
                <div className="text-cyan-200 font-extrabold flex items-center gap-2 drop-shadow">
                  {onFlash && <span className="line-through text-zinc-500 text-xs">{fmt(preDiscountPrice || singleBase)}</span>}
                  <span className="px-2 py-0.5 rounded-md badge-neon-cyan">{isFirstFreeCursor ? "0" : fmt(price1)}</span>
                </div>
              </div>
              <div className="text-xs text-zinc-400">{it.desc}</div>
              <div className="mt-1">
                <ProgressBar value={clamp(state.cookies / price1, 0, 1)} />
              </div>
            </div>
            <div className="text-right text-xs text-zinc-300 w-24 leading-tight">
              <span className="px-2 py-1 rounded-md badge-neon-amber inline-block">+{fmt((perItemMult[it.id] || 1) * (it.mult || 0))} CPC</span>
            </div>
          </button>
          </Tooltip>
        );
      })}
      <div className="mt-3 text-xs font-semibold text-zinc-300">Auto (production passive)</div>
      {ITEMS.filter((it) => it.mode === 'cps').map((it) => {
        const ownedCount = state.items[it.id] || 0;
        const singleBase = Math.ceil(it.base * Math.pow(it.growth, ownedCount));
        const onFlash =
          state.flags.flash &&
          state.flags.flash.itemId === it.id &&
          Date.now() < state.flags.flash.until;
        const price1 = costOf(it.id, 1);
        const preDiscountPrice = onFlash && state.flags.flash?.discount ? Math.ceil(price1 / (1 - state.flags.flash.discount)) : null;
        const affordable = state.cookies >= price1;
        return (
          <Tooltip
            key={it.id}
            position="right"
            panel={(
              <div className="max-w-[220px] space-y-1">
                <div className="font-semibold text-zinc-100">{it.name}</div>
                <div className="text-zinc-300">+x{fmt((perItemMult[it.id] || 1) * it.cps)} CPS</div>
                <div className="text-zinc-400">Coût: {fmt(price1)} · Suivant: {fmt(Math.ceil(price1 * it.growth))}</div>
                <div className="text-zinc-500">{it.desc}</div>
              </div>
            )}
            className="block"
          >
          <button
            key={it.id}
            onClick={(e) => buy(it.id, e.shiftKey ? 10 : e.ctrlKey ? 100 : 1)}
            className={`relative w-full text-left p-3 rounded-2xl border flex items-center gap-3 btn-pressable transition ${
              affordable ? "glass-neon hover:border-sky-400/60" : "bg-zinc-900/40 border-zinc-800 opacity-70"
            } card-shadow`}
          >
            {onFlash && (
              <span className="absolute -top-2 -left-2 text-[10px] px-2 py-0.5 rounded-full bg-pink-600/80 border border-pink-300/70 shadow">-25% 20s</span>
            )}
            <div className="text-2xl drop-shadow">{it.emoji}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {it.name} <span className="text-xs text-zinc-500">×{ownedCount}</span>
                </div>
                <div className="text-cyan-200 font-extrabold flex items-center gap-2 drop-shadow">
                  {onFlash && <span className="line-through text-zinc-500 text-xs">{fmt(preDiscountPrice || singleBase)}</span>}
                  <span className="px-2 py-0.5 rounded-md badge-neon-cyan">{fmt(price1)}</span>
                </div>
              </div>
              <div className="text-xs text-zinc-400">{it.desc}</div>
              <div className="mt-1">
                <ProgressBar value={clamp(state.cookies / price1, 0, 1)} />
              </div>
            </div>
            <div className="text-right text-xs text-zinc-300 w-24 leading-tight">
              <span className="px-2 py-1 rounded-md badge-neon-amber inline-block">x{fmt((perItemMult[it.id] || 1) * it.cps)}</span>
            </div>
          </button>
          </Tooltip>
        );
      })}
    </>
  );
}

