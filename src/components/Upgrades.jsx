import React from "react";

export default function Upgrades({ state, UPGRADES, buyUpgrade, canBuyUpgrade, ITEMS, fmt, stake, unstake, cryptoFlash }) {
  return (
    <>
      <div className="text-base font-semibold text-amber-900 mb-3">Améliorations</div>
      <div className="grid grid-cols-1 gap-3">
        {UPGRADES.map((u) => {
          const available = canBuyUpgrade(u);
          const purchased = !!state.upgrades[u.id];
          return (
            <button
              key={u.id}
              disabled={purchased || !available || state.cookies < u.cost}
              onClick={() => buyUpgrade(u)}
              className={`p-3 rounded-2xl border text-left btn-pressable card-shadow transition ${
                purchased
                  ? "bg-emerald-600/20 border-emerald-400/40 text-emerald-200"
                  : available
                  ? state.cookies >= u.cost
                    ? "glass-warm hover:border-amber-400/60"
                    : "bg-stone-900/40 border-stone-800"
                  : "bg-stone-900/30 border-stone-900 opacity-60"
              }`}
            >
              <div className="font-semibold">{u.name}</div>
              <div className="text-xs text-amber-700">
                {u.target === "all"
                  ? "Tous les bâtiments"
                  : u.target === "cpc"
                  ? "Puissance de clic"
                  : `Boost ${ITEMS.find((i) => i.id === u.target)?.name}`}
              </div>
              <div className="text-sm mt-1 text-cyan-200 font-extrabold drop-shadow">
                {purchased ? (
                  <span className="px-2 py-0.5 rounded-md badge-neon-green">Acheté</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md badge-neon-amber">Coût: {fmt(u.cost)}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-amber-900">
            {state.crypto.name} <span className="text-amber-700">({state.crypto.symbol})</span>
          </div>
          <div
            className={`text-sm px-2 py-1 rounded-lg border ${
              cryptoFlash
                ? "bg-emerald-600/20 border-emerald-400/60"
                : "glass-warm"
            }`}
          >
            Solde: <b>{(state.crypto.balance || 0).toFixed(3)} {state.crypto.symbol}</b>
          </div>
        </div>
        <div className="text-xs text-amber-700 mt-1">
          Faucet: <b>{state.crypto.perAmount} {state.crypto.symbol}</b> / <b>{fmt(state.crypto.perCookies)}</b> cookies cuits
        </div>
        <div className="mt-2 text-xs text-amber-700">
          Stake: <b>{(state.crypto.staked || 0).toFixed(3)} {state.crypto.symbol}</b> → Boost global <b>+{((state.crypto.staked || 0) * 50).toFixed(1)}%</b>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => stake(0.001)}
            disabled={(state.crypto.balance || 0) < 0.001}
            className="text-xs px-3 py-1 rounded-lg bg-emerald-600/20 border border-emerald-400/40 hover:bg-emerald-500/25 btn-pressable disabled:opacity-50"
          >
            Stake +0.001
          </button>
          <button
            onClick={() => unstake(0.001)}
            disabled={(state.crypto.staked || 0) < 0.001}
            className="text-xs px-3 py-1 rounded-lg glass-warm hover:border-amber-400/60 btn-pressable disabled:opacity-50"
          >
            Unstake -0.001
          </button>
        </div>
      </div>
    </>
  );
}

