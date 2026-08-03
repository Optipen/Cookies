import React, { memo, useMemo } from "react";
import { UPGRADES } from "../data/upgrades.js";
import { ITEMS } from "../data/items.js";
import { fmt } from "../utils/format.js";

const targetLabel = (target) => {
  if (target === "all") return "Tous les bâtiments";
  if (target === "cpc") return "Puissance de clic";
  return `Boost ${ITEMS.find((i) => i.id === target)?.name || target}`;
};

const UpgradeCard = memo(function UpgradeCard({ upgrade, purchased, unlocked, affordable, onBuy }) {
  const disabled = purchased || !unlocked || !affordable;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onBuy(upgrade)}
      aria-label={`${upgrade.name}, ${purchased ? "acheté" : `coût ${fmt(upgrade.cost)}`}`}
      className={`w-full p-3 rounded-2xl border text-left transition-all duration-150 ${
        purchased
          ? "bg-gradient-to-br from-emerald-100 to-emerald-50 border-emerald-300"
          : !unlocked
            ? "bg-stone-100/50 border-stone-200 opacity-55"
            : affordable
              ? "bg-white/75 border-amber-200 hover:border-amber-400 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg"
              : "bg-stone-100/60 border-stone-200 opacity-70 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-semibold ${purchased ? "text-emerald-900" : "text-amber-950"}`}>
            {!unlocked && "🔒 "}
            {upgrade.name}
          </div>
          <div className="text-[11px] text-amber-800/70">{targetLabel(upgrade.target)}</div>
        </div>
        <span
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${
            purchased ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-800"
          }`}
        >
          {purchased ? "✓ Acheté" : `×${upgrade.value}`}
        </span>
      </div>
      {!purchased && (
        <div className={`mt-1.5 text-sm font-bold tabular-nums ${affordable && unlocked ? "text-amber-700" : "text-stone-500"}`}>
          {fmt(upgrade.cost)} 🍪
        </div>
      )}
    </button>
  );
});

function Upgrades({ state, onBuy }) {
  const rows = useMemo(
    () =>
      UPGRADES.map((u) => {
        let unlocked = false;
        try {
          unlocked = !!u.unlock(state);
        } catch {
          unlocked = false;
        }
        return { upgrade: u, purchased: !!state.upgrades[u.id], unlocked, affordable: state.cookies >= u.cost };
      }),
    [state]
  );

  const available = rows.filter((r) => !r.purchased && r.unlocked);
  const locked = rows.filter((r) => !r.purchased && !r.unlocked);
  const owned = rows.filter((r) => r.purchased);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-amber-950">Améliorations</h3>
        <span className="text-[11px] text-amber-700">
          {owned.length}/{UPGRADES.length} achetées
        </span>
      </div>

      {available.length === 0 && locked.length === 0 && (
        <p className="text-sm text-amber-800/70 italic text-center py-4">Toutes les améliorations sont achetées 🎉</p>
      )}

      <div className="space-y-2">
        {available.map((r) => (
          <UpgradeCard key={r.upgrade.id} {...r} onBuy={onBuy} />
        ))}
      </div>

      {locked.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-amber-700 hover:text-amber-900 py-1 select-none">
            🔒 {locked.length} à débloquer
          </summary>
          <div className="mt-2 space-y-2">
            {locked.map((r) => (
              <UpgradeCard key={r.upgrade.id} {...r} onBuy={onBuy} />
            ))}
          </div>
        </details>
      )}

      {owned.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-900 py-1 select-none">
            ✓ {owned.length} achetées
          </summary>
          <div className="mt-2 space-y-2">
            {owned.map((r) => (
              <UpgradeCard key={r.upgrade.id} {...r} onBuy={onBuy} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default memo(Upgrades);
