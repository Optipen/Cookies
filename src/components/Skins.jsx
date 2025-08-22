import React from "react";

export default function Skins({ state, SKINS, selectSkin, buySkin, fmt }) {
  return (
    <>
      <div className="text-sm font-semibold text-zinc-300 mb-3">Marché des Skins</div>
      <div className="grid grid-cols-1 gap-3">
        {Object.values(SKINS).map((skin) => (
          <div key={skin.id} className="p-3 rounded-xl border bg-zinc-800/40">
            <img
              src={skin.src}
              alt={skin.name}
              className="h-16 w-16 mx-auto mb-2 select-none"
              draggable="false"
            />
            <div className="text-center font-semibold">{skin.name}</div>
            {state.skinsOwned[skin.id] ? (
              <button
                onClick={() => selectSkin(skin.id)}
                disabled={state.skin === skin.id}
                className={`mt-2 w-full px-2 py-1 rounded-lg border ${
                  state.skin === skin.id
                    ? "bg-emerald-600/30 border-emerald-400/40 text-emerald-200"
                    : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                }`}
              >
                {state.skin === skin.id ? "Équipé" : "Équiper"}
              </button>
            ) : (
              <button
                onClick={() => buySkin(skin.id)}
                disabled={state.cookies < skin.price}
                className="mt-2 w-full px-2 py-1 rounded-lg bg-amber-600/30 border border-amber-400/40 hover:bg-amber-500/40 disabled:opacity-50"
              >
                Acheter {fmt(skin.price)}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

