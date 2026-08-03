import React, { memo, useMemo } from "react";
import { availableUpgrades } from "../data/upgrades.js";
import { ITEMS } from "../data/items.js";
import { fmt, fmtPct } from "../utils/format.js";

const targetLabel = (upgrade) => {
  if (upgrade.target === "all") return "Tous les bâtiments";
  if (upgrade.target === "cpc") return "Puissance de clic";
  if (upgrade.target === "share") return "Part de production par clic";
  return ITEMS.find((i) => i.id === upgrade.target)?.name || upgrade.target;
};

const UpgradeCard = memo(function UpgradeCard({ upgrade, unlocked, affordable, progress, onBuy }) {
  const buyable = unlocked && affordable;

  return (
    <button
      type="button"
      disabled={!buyable}
      onClick={() => onBuy(upgrade)}
      aria-label={`${upgrade.name}, ${unlocked ? `coût ${fmt(upgrade.cost)}` : upgrade.hint}`}
      className={`w-full p-3 rounded-2xl border text-left transition-all duration-150 ${
        buyable
          ? "bg-white/80 border-amber-300 hover:border-amber-400 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg"
          : unlocked
            ? "bg-stone-100/60 border-stone-200 opacity-75 cursor-not-allowed"
            : "bg-white/40 border-amber-200/60 opacity-70 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none mt-0.5" aria-hidden="true">
          {upgrade.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-amber-950 truncate">{upgrade.name}</span>
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              {upgrade.type === "share" ? `+${(upgrade.value * 100).toFixed(2)} pt` : `×${upgrade.value}`}
            </span>
          </div>
          <div className="text-[11px] text-amber-800/70 truncate">{targetLabel(upgrade)}</div>
        </div>
      </div>

      {unlocked ? (
        <div className={`mt-1.5 text-sm font-bold tabular-nums ${affordable ? "text-amber-700" : "text-stone-500"}`}>
          {fmt(upgrade.cost)} 🍪
        </div>
      ) : (
        <div className="mt-1.5">
          <div className="flex items-center justify-between text-[10px] text-amber-700 mb-1">
            <span className="truncate">🔒 {upgrade.hint}</span>
            <span className="tabular-nums shrink-0 ml-2">{Math.floor(progress * 100)} %</span>
          </div>
          <div className="h-1 rounded-full bg-amber-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-orange-400 transition-[width] duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
});

function Upgrades({ state, stats, onBuy }) {
  const rows = useMemo(() => {
    const list = availableUpgrades(state).map((upgrade) => {
      let unlocked = false;
      let progress = 0;
      try {
        unlocked = !!upgrade.unlock(state);
        progress = upgrade.progress ? upgrade.progress(state) : unlocked ? 1 : 0;
      } catch {
        // Une condition invalide laisse simplement l'amélioration verrouillée
      }
      return { upgrade, unlocked, progress, affordable: state.cookies >= upgrade.cost };
    });

    // Les achetables d'abord, puis les plus proches d'être débloquées
    return list.sort((a, b) => {
      const rank = (r) => (r.unlocked && r.affordable ? 0 : r.unlocked ? 1 : 2);
      return rank(a) - rank(b) || b.progress - a.progress || a.upgrade.cost - b.upgrade.cost;
    });
  }, [state]);

  const buyable = rows.filter((r) => r.unlocked && r.affordable);
  const rest = rows.filter((r) => !(r.unlocked && r.affordable)).slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-amber-950">Améliorations</h3>
        <span className="text-[11px] text-amber-700">{Object.keys(state.upgrades || {}).length} achetées</span>
      </div>

      <div className="rounded-xl bg-amber-100/60 border border-amber-200 px-3 py-2">
        <div className="flex items-center justify-between text-[11px] text-amber-800">
          <span>👆 Production reversée par clic</span>
          <b className="tabular-nums text-amber-900">{fmtPct(stats.clickShare, 2)}</b>
        </div>
        <p className="text-[10px] text-amber-700/80 mt-0.5 leading-snug">
          Chaque clic te rapporte cette fraction de ta production automatique. Les bâtiments de clic et les
          améliorations « Doigté » la font monter, sans limite.
        </p>
      </div>

      {buyable.length > 0 && (
        <div className="space-y-2">
          {buyable.map((r) => (
            <UpgradeCard key={r.upgrade.id} {...r} onBuy={onBuy} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <>
          <div className="text-[11px] font-semibold text-amber-700 pt-1">À venir</div>
          <div className="space-y-2">
            {rest.map((r) => (
              <UpgradeCard key={r.upgrade.id} {...r} onBuy={onBuy} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(Upgrades);
