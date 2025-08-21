import React from "react";

export default function Upgrades({ state, UPGRADES, buyUpgrade, canBuyUpgrade, ITEMS, fmt, stake, unstake, cryptoFlash }) {
  return (
    <>
      <div className="text-sm font-semibold text-zinc-300 mb-2">Améliorations</div>
      <div className="grid grid-cols-1 gap-3">
        {UPGRADES.map((u) => {
          const available = canBuyUpgrade(u);
          const purchased = !!state.upgrades[u.id];
          return (
            <button
              key={u.id}
              disabled={purchased || !available || state.cookies < u.cost}
              onClick={() => buyUpgrade(u)}
              className={`p-3 rounded-xl border text-left transition ${
                purchased
                  ? "bg-emerald-600/20 border-emerald-400/40 text-emerald-200"
                  : available
                  ? state.cookies >= u.cost
                    ? "bg-zinc-800/70 hover:bg-zinc-800 border-zinc-700"
                    : "bg-zinc-900/40 border-zinc-800"
                  : "bg-zinc-900/30 border-zinc-900 opacity-60"
              }`}
            >
              <div className="font-semibold">{u.name}</div>
              <div className="text-xs text-zinc-400">
                {u.target === "all"
                  ? "Tous les bâtiments"
                  : u.target === "cpc"
                  ? "Puissance de clic"
                  : `Boost ${ITEMS.find((i) => i.id === u.target)?.name}`}
              </div>
              <div className="text-sm mt-1 text-amber-300">
                {purchased ? "Acheté" : `Coût: ${fmt(u.cost)}`}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-300">
            {state.crypto.name} <span className="text-zinc-500">({state.crypto.symbol})</span>
          </div>
          <div
            className={`text-sm px-2 py-1 rounded-lg border ${
              cryptoFlash
                ? "bg-emerald-600/30 border-emerald-400/60"
                : "bg-zinc-800/70 border-zinc-700"
            }`}
          >
            Solde: <b>{(state.crypto.balance || 0).toFixed(3)} {state.crypto.symbol}</b>
          </div>
        </div>
        <div className="text-xs text-zinc-400 mt-1">
          Faucet: <b>{state.crypto.perAmount} {state.crypto.symbol}</b> / <b>{fmt(state.crypto.perCookies)}</b> cookies cuits
        </div>
        <div className="mt-2 text-xs text-zinc-400">
          Stake: <b>{(state.crypto.staked || 0).toFixed(3)} {state.crypto.symbol}</b> → Boost global <b>+{((state.crypto.staked || 0) * 50).toFixed(1)}%</b>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => stake(0.001)}
            disabled={(state.crypto.balance || 0) < 0.001}
            className="text-xs px-3 py-1 rounded-lg bg-emerald-700/30 border border-emerald-500/40 disabled:opacity-50"
          >
            Stake +0.001
          </button>
          <button
            onClick={() => unstake(0.001)}
            disabled={(state.crypto.staked || 0) < 0.001}
            className="text-xs px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-50"
          >
            Unstake -0.001
          </button>
        </div>
      </div>
    </>
  );
}

