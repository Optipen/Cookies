import React, { memo, useMemo } from "react";
import Icon from "./Icon.jsx";
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
    <div className="mt-1.5 flex items-baseline gap-2 text-[10.5px] font-semibold tabular-nums">
      <span className="text-cream/45">Gain réel</span>
      {mining > 0 && (
        <span className="font-extrabold text-mint">
          +{fmt(mining)} {LABELS.mine.unit}
        </span>
      )}
      {click > 0 && (
        <span className="font-extrabold text-honey-light">
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
      className={`w-full rounded-[20px] p-3.5 text-left transition-all duration-150 ${
        buyable
          ? "panel border-honey/30 hover:-translate-y-0.5 hover:border-honey/50"
          : unlocked
            ? "panel-muted opacity-80 cursor-not-allowed"
            : "panel-muted opacity-75 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${
            buyable ? "border-honey/25 bg-honey/10 text-honey-light" : "border-honey/10 bg-honey/5 text-cream/40"
          }`}
          aria-hidden="true"
        >
          <Icon emoji={upgrade.emoji} size={17} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[12.5px] font-bold text-cream">{upgrade.name}</span>
            <span className="shrink-0 rounded-md bg-mint/15 px-2 py-0.5 text-[10px] font-extrabold text-mint">
              {upgrade.badge}
            </span>
          </div>
          <div className="truncate text-[10px] text-cream/50">{targetLabel(upgrade)}</div>
          <RealGain mining={gain.mining} click={gain.click} />
        </div>
      </div>

      {unlocked ? (
        <div className="mt-2.5 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 text-[13px] font-extrabold tabular-nums ${
              affordable ? "text-honey" : "text-cream/40"
            }`}
          >
            <Icon name="coin" size={13} />
            {fmtPrix(upgrade.cost)}
          </span>
          <span
            className={`rounded-xl px-4 py-2 text-[11px] font-extrabold ${affordable ? "btn-honey" : "btn-dead"}`}
          >
            Acheter
          </span>
        </div>
      ) : (
        <div className="mt-2">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-cream/45">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Icon name="lock" size={11} />
              <span className="truncate">{upgrade.hint}</span>
            </span>
            <span className="ml-2 shrink-0 tabular-nums">{Math.floor(progress * 100)} %</span>
          </div>
          <div className="meter h-1">
            <div className="meter-fill transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
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
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl text-cream-bright">Améliorations</h3>
        <span className="text-[10.5px] text-cream/50">{Object.keys(state.upgrades || {}).length} achetées</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-honey/20 bg-honey/[0.07] px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-cream/50">
            <Icon name="cursor" size={12} className="text-honey" />
            Puissance de clic
          </div>
          <div className="mt-0.5 text-[15px] font-extrabold tabular-nums text-cream">
            {fmt(stats.perClickNoCombo)} <span className="text-[10px] font-semibold opacity-50">/clic</span>
          </div>
        </div>
        <div className="rounded-2xl border border-mint/20 bg-mint/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-cream/50">
            <Icon name="pickaxe" size={12} className="text-mint" />
            Minage
          </div>
          <div className="mt-0.5 text-[15px] font-extrabold tabular-nums text-mint">
            {fmt(stats.mining)} <span className="text-[10px] font-semibold opacity-50">/s</span>
          </div>
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
          <div className="eyebrow pt-1">À venir</div>
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
