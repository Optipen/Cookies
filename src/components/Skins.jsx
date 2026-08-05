import React, { memo } from "react";
import { fmt } from "../utils/format.js";

const SkinCard = memo(function SkinCard({ skin, owned, equipped, affordable, missing, onPreview, onStopPreview, onBuy, onEquip }) {
  return (
    <div
      onMouseEnter={() => onPreview(skin.id)}
      onMouseLeave={onStopPreview}
      onFocus={() => onPreview(skin.id)}
      onBlur={onStopPreview}
      className={`relative p-3 rounded-2xl border transition-all duration-200 ${
        equipped
          ? "bg-gradient-to-br from-emerald-100 to-teal-50 border-emerald-400 ring-2 ring-emerald-300/50"
          : owned
            ? "bg-white/75 border-amber-200 hover:border-amber-400 hover:shadow-lg"
            : "bg-white/55 border-amber-200/70 hover:border-amber-300"
      }`}
    >
      {equipped && (
        <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
          Équipé
        </span>
      )}

      <div className="flex items-center gap-3">
        <img
          src={skin.src}
          alt=""
          aria-hidden="true"
          draggable="false"
          loading="lazy"
          className={`h-16 w-16 shrink-0 select-none drop-shadow-md transition-transform duration-200 hover:scale-110 ${
            skin.className || ""
          } ${!owned ? "opacity-60 grayscale-[0.35]" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-amber-950">{skin.name}</div>
          {skin.description && <div className="text-[11px] text-amber-800/75 leading-snug">{skin.description}</div>}
          {!owned && (
            <div className="mt-0.5 text-xs font-bold text-amber-700 tabular-nums">
              {skin.crmb ? `${skin.crmb} CRMB 🪙` : `${fmt(skin.price)} 🍪`}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2.5">
        {owned ? (
          <button
            type="button"
            onClick={() => onEquip(skin.id)}
            disabled={equipped}
            className={`w-full min-h-11 px-3 rounded-xl border text-sm font-bold transition-colors ${
              equipped
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-800 cursor-default"
                : "bg-amber-500 border-amber-600 text-white hover:bg-amber-400 shadow"
            }`}
          >
            {equipped ? "✓ Équipé" : "Équiper"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBuy(skin.id)}
            disabled={!affordable}
            className={`w-full min-h-11 px-3 rounded-xl border text-sm font-bold transition-colors ${
              affordable
                ? "bg-amber-500 border-amber-600 text-white hover:bg-amber-400 shadow"
                : "bg-stone-100 border-stone-200 text-stone-500 cursor-not-allowed"
            }`}
          >
            {affordable
              ? `Acheter · ${skin.crmb ? `${skin.crmb} CRMB` : fmt(skin.price)}`
              : `Manque ${skin.crmb ? `${fmt(missing)} CRMB` : fmt(missing)}`}
          </button>
        )}
      </div>
    </div>
  );
});

function Skins({ state, skins, onBuy, onEquip, onPreview, onStopPreview }) {
  const ownedCount = Object.values(state.skinsOwned || {}).filter(Boolean).length;
  const all = Object.values(skins);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-amber-950">Apparences</h3>
        <span className="text-[11px] text-amber-700">
          {ownedCount}/{all.length} débloquées
        </span>
      </div>
      <p className="text-[11px] text-amber-800/70">Survole un skin pour l&apos;essayer sur le grand cookie.</p>

      <div className="space-y-2">
        {all.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            owned={!!state.skinsOwned[skin.id]}
            equipped={state.skin === skin.id}
            affordable={
              skin.crmb ? (state.crypto?.balance || 0) >= skin.crmb : state.cookies >= skin.price
            }
            missing={
              skin.crmb
                ? Math.max(0, skin.crmb - (state.crypto?.balance || 0))
                : Math.max(0, skin.price - state.cookies)
            }
            onPreview={onPreview}
            onStopPreview={onStopPreview}
            onBuy={onBuy}
            onEquip={onEquip}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(Skins);
