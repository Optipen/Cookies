import React, { memo } from "react";
import Icon from "./Icon.jsx";
import { fmt } from "../utils/format.js";

const SkinCard = memo(function SkinCard({ skin, owned, equipped, affordable, missing, onPreview, onStopPreview, onBuy, onEquip }) {
  return (
    <div
      onMouseEnter={() => onPreview(skin.id)}
      onMouseLeave={onStopPreview}
      onFocus={() => onPreview(skin.id)}
      onBlur={onStopPreview}
      className={`relative rounded-[20px] p-3 transition-all duration-200 ${
        equipped ? "panel border-mint/40 shadow-[0_0_0_3px_rgba(127,216,168,.07)]" : owned ? "panel" : "panel-muted"
      }`}
    >
      {equipped && (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-mint px-2 py-0.5 text-[9px] font-extrabold text-ink">
          Équipé
        </span>
      )}

      <div className="flex items-center gap-3">
        {/* La VIGNETTE, pas le grand cookie: 128 px pour un rendu de 64, au
            lieu du fichier plein format. Ouvrir cet onglet téléchargeait
            5,3 Mo d'images pour cette seule liste. */}
        <img
          src={skin.apercu || skin.src}
          alt=""
          width="128"
          height="128"
          aria-hidden="true"
          draggable="false"
          loading="lazy"
          decoding="async"
          className={`h-16 w-16 shrink-0 select-none transition-transform duration-200 hover:scale-110 ${
            skin.className || ""
          } ${!owned ? "opacity-45 saturate-50" : ""}`}
          style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,.55))" }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-cream">{skin.name}</div>
          {skin.description && <div className="text-[10px] leading-snug text-cream/50">{skin.description}</div>}
          {!owned && (
            <div
              className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold tabular-nums ${
                skin.crmb ? "text-crmb" : "text-honey"
              }`}
            >
              <Icon name={skin.crmb ? "crmb" : "coin"} size={12} />
              {skin.crmb ? `${skin.crmb} CRMB` : fmt(skin.price)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        {owned ? (
          <button
            type="button"
            onClick={() => onEquip(skin.id)}
            disabled={equipped}
            className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[12px] ${
              equipped ? "btn-ghost cursor-default border-mint/40 text-mint" : "btn-honey"
            }`}
          >
            {equipped && <Icon name="check" size={13} />}
            {equipped ? "Équipé" : "Équiper"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBuy(skin.id)}
            disabled={!affordable}
            className={`min-h-11 w-full rounded-xl px-3 text-[12px] ${affordable ? "btn-honey" : "btn-dead"}`}
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
      <div className="flex items-baseline justify-between">
        <h3 className="eyebrow">Apparences</h3>
        <span className="text-[10.5px] tabular-nums text-cream/50">
          {ownedCount}/{all.length} débloquées
        </span>
      </div>
      <p className="text-[10px] text-cream/45">Survole un skin pour l&apos;essayer sur le grand cookie.</p>

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
