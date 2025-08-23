import React, { useState } from "react";

export default function Skins({ state, SKINS, selectSkin, buySkin, fmt }) {
  const [previewSkin, setPreviewSkin] = useState(null);
  
  // Emit preview events for parent component
  const handlePreview = (skinId) => {
    setPreviewSkin(skinId);
    window.dispatchEvent(new CustomEvent('skinPreview', { detail: skinId }));
  };
  
  const stopPreview = () => {
    setPreviewSkin(null);
    window.dispatchEvent(new CustomEvent('skinPreview', { detail: null }));
  };
  return (
    <>
      <div className="text-sm font-semibold text-zinc-300 mb-3">Marché des Skins</div>
      <div className="grid grid-cols-1 gap-3">
        {Object.values(SKINS).map((skin) => {
          const isOwned = state.skinsOwned[skin.id];
          const isEquipped = state.skin === skin.id;
          const isPreviewing = previewSkin === skin.id;
          const canAfford = state.cookies >= skin.price;
          
          return (
            <div 
              key={skin.id} 
              className={`p-3 rounded-xl border transition-all duration-300 ${
                isPreviewing 
                  ? "bg-cyan-500/20 border-cyan-400/60 ring-2 ring-cyan-400/40" 
                  : isEquipped 
                  ? "bg-emerald-500/20 border-emerald-400/60"
                  : "bg-zinc-800/40 border-zinc-700/60 hover:border-zinc-600"
              }`}
              onMouseEnter={() => handlePreview(skin.id)}
              onMouseLeave={stopPreview}
            >
              <div className="relative">
                <img
                  src={skin.src}
                  alt={skin.name}
                  className={`h-16 w-16 mx-auto mb-2 select-none transition-transform duration-200 ${
                    isPreviewing ? "scale-110" : ""
                  } ${skin.className || ""}`}
                  draggable="false"
                />
                {isEquipped && (
                  <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                    ✓
                  </div>
                )}
                {isPreviewing && !isOwned && (
                  <div className="absolute -top-1 -left-1 bg-cyan-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                    👁️
                  </div>
                )}
              </div>
              
              <div className="text-center space-y-1">
                <div className="font-semibold">{skin.name}</div>
                {skin.description && (
                  <div className="text-xs text-zinc-400 leading-tight">{skin.description}</div>
                )}
                {!isOwned && (
                  <div className="text-xs text-cyan-300">Prix: {fmt(skin.price)}</div>
                )}
              </div>
              
              <div className="mt-3 space-y-2">
                {isOwned ? (
                  <>
                    <button
                      onClick={() => selectSkin(skin.id)}
                      disabled={isEquipped}
                      className={`w-full px-2 py-1.5 rounded-lg border transition-all duration-200 font-semibold ${
                        isEquipped
                          ? "bg-emerald-600/40 border-emerald-400/60 text-emerald-200 cursor-default"
                          : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      {isEquipped ? "✓ Équipé" : "Équiper"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => buySkin(skin.id)}
                      disabled={!canAfford}
                      className={`w-full px-2 py-1.5 rounded-lg border font-semibold transition-all duration-200 ${
                        canAfford
                          ? "bg-amber-600/30 border-amber-400/40 hover:bg-amber-500/40 hover:border-amber-300/60 text-amber-200"
                          : "bg-zinc-800/50 border-zinc-700/50 text-zinc-500 cursor-not-allowed opacity-60"
                      }`}
                    >
                      {canAfford ? `Acheter ${fmt(skin.price)}` : `Besoin de ${fmt(skin.price)}`}
                    </button>
                    {!canAfford && (
                      <div className="text-xs text-center text-zinc-500">
                        Manque {fmt(skin.price - state.cookies)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

