import React, { memo, useMemo } from "react";
import { availableUpgrades } from "../data/upgrades.js";
import { ITEM_BY_ID, LABELS } from "../data/items.js";
import { deriveStats } from "../utils/selectors.js";
import { snapDown } from "../utils/grid.js";
import { useClock } from "../hooks/useClock.js";
import { fmt, fmtPrix, fmtExact } from "../utils/format.js";

const targetLabel = (upgrade) => {
  if (upgrade.target === "all") return "Cliqueurs et Mineurs";
  const item = ITEM_BY_ID[upgrade.target];
  return item ? `${LABELS[item.mode].one} · ${item.name}` : upgrade.target;
};

/**
 * Comme en boutique: le multiplicateur net (×2) est la valeur propre de
 * l'amélioration, le « gain réel » est ce qu'elle rapporte à cet instant. Les
 * deux axes gardent leur unité — un bonus global augmente le minage ET le clic,
 * mais /s et /clic ne se somment pas.
 */
const RealGain = memo(function RealGain({ mining, click }) {
  if (mining <= 0 && click <= 0) return null;
  return (
    <div className="mt-1 flex items-baseline gap-2 text-[11px] tabular-nums">
      <span className="text-amber-900/60">Gain réel</span>
      {mining > 0 && (
        <span className="font-bold text-emerald-700">
          +{fmt(mining)} {LABELS.mine.unit}
        </span>
      )}
      {click > 0 && (
        <span className="font-bold text-sky-700">
          +{fmt(click)} {LABELS.click.unit}
        </span>
      )}
    </div>
  );
});

const UpgradeCard = memo(function UpgradeCard({ upgrade, unlocked, affordable, progress, gain, onBuy }) {
  const buyable = unlocked && affordable;

  return (
    <button
      type="button"
      disabled={!buyable}
      onClick={() => onBuy(upgrade)}
      aria-label={`${upgrade.name}, ${unlocked ? `coût ${fmtPrix(upgrade.cost)}` : upgrade.hint}`}
      title={unlocked ? `${fmtExact(upgrade.cost)} cookies` : undefined}
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
            <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              {upgrade.badge}
            </span>
          </div>
          <div className="text-[11px] text-amber-800/70 truncate">{targetLabel(upgrade)}</div>
          <RealGain mining={gain.mining} click={gain.click} />
        </div>
      </div>

      {unlocked ? (
        <div className={`mt-1.5 text-sm font-bold tabular-nums ${affordable ? "text-amber-700" : "text-stone-500"}`}>
          {fmtPrix(upgrade.cost)} 🍪
        </div>
      ) : (
        <div className="mt-1.5">
          <div className="flex items-center justify-between text-[11px] text-amber-700 mb-1">
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
  // Même horloge partagée que la boutique: sans elle, `deriveStats` croirait la
  // partie éternellement dans sa fenêtre de début et gonflerait les gains.
  const now = useClock(1000);

  const rows = useMemo(() => {
    const base = deriveStats(state, now, 0);
    const list = availableUpgrades(state).map((upgrade) => {
      let unlocked = false;
      let progress = 0;
      try {
        unlocked = !!upgrade.unlock(state);
        progress = upgrade.progress ? upgrade.progress(state) : unlocked ? 1 : 0;
      } catch {
        // Une condition invalide laisse simplement l'amélioration verrouillée
      }
      // Le gain annoncé est calculé avec la formule du jeu, pas approché — et
      // l'écart AFFICHÉ est plié sur la règle: « entier − quart » au passage
      // de cent rendrait un 499,25 qui n'existe pas dans ce jeu.
      const next = deriveStats({ ...state, upgrades: { ...state.upgrades, [upgrade.id]: true } }, now, 0);
      const gain = {
        mining: snapDown(next.mining - base.mining),
        click: snapDown(next.perClickNoCombo - base.perClickNoCombo),
      };
      return { upgrade, unlocked, progress, gain, affordable: state.cookies >= upgrade.cost };
    });

    // Les achetables d'abord, puis les plus proches d'être débloquées
    return list.sort((a, b) => {
      const rank = (r) => (r.unlocked && r.affordable ? 0 : r.unlocked ? 1 : 2);
      return rank(a) - rank(b) || b.progress - a.progress || a.upgrade.cost - b.upgrade.cost;
    });
  }, [state, now]);

  const buyable = rows.filter((r) => r.unlocked && r.affordable);
  const rest = rows.filter((r) => !(r.unlocked && r.affordable)).slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-amber-950">Améliorations</h3>
        <span className="text-[11px] text-amber-700">{Object.keys(state.upgrades || {}).length} achetées</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-amber-100/60 border border-amber-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-amber-700">👆 Puissance de clic</div>
          <div className="text-sm font-bold text-amber-950 tabular-nums">{fmt(stats.perClickNoCombo)} /clic</div>
        </div>
        <div className="rounded-xl bg-emerald-100/60 border border-emerald-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-emerald-700">⛏️ Minage</div>
          <div className="text-sm font-bold text-emerald-950 tabular-nums">{fmt(stats.mining)} /s</div>
        </div>
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
