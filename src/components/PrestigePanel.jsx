import React, { memo } from "react";
import {
  PRESTIGE_UPGRADES,
  availableChips,
  upgradeCost,
  chipsFor,
  PRESTIGE_MIN_LIFETIME,
} from "../data/prestige.js";
import { fmt, fmtPct } from "../utils/format.js";

const NodeCard = memo(function NodeCard({ node, level, cost, affordable, maxed, onBuy }) {
  const endless = node.maxLevel === Infinity;
  // Un nœud sans fin n'a pas de barre de progression: on montre une jauge
  // logarithmique qui ne sature jamais, pour garder un repère visuel.
  const pct = endless ? Math.min(100, Math.log10(1 + level) * 45) : (level / node.maxLevel) * 100;

  return (
    <div
      className={`p-3 rounded-2xl border transition-colors ${
        maxed
          ? "bg-gradient-to-br from-fuchsia-100 to-violet-50 border-fuchsia-300"
          : level > 0
            ? "bg-white/75 border-violet-300"
            : "bg-white/55 border-violet-200"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-2xl leading-none" aria-hidden="true">
          {node.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-bold text-violet-950 truncate">{node.name}</h4>
            <span className="text-xs font-bold text-violet-700 tabular-nums shrink-0">
              {endless ? `niv. ${level}` : `${level}/${node.maxLevel}`}
            </span>
          </div>
          <p className="text-[11px] text-violet-800/75 leading-snug">{node.desc}</p>

          <div className="mt-1.5 h-1.5 rounded-full bg-violet-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-500 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onBuy(node.id)}
        disabled={maxed || !affordable}
        className={`mt-2 w-full px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors ${
          maxed
            ? "bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-800 cursor-default"
            : affordable
              ? "bg-violet-600 border-violet-700 text-white hover:bg-violet-500 shadow"
              : "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
        }`}
      >
        {maxed ? "✦ Niveau maximum" : `Améliorer · ${cost} 🔮`}
      </button>
    </div>
  );
});

function PrestigePanel({ state, effects, onPrestige, onBuyNode }) {
  const chips = availableChips(state);
  const potential = chipsFor(state.lifetime);
  const gain = Math.max(0, potential - (state.prestige?.chips || 0));
  const canPrestige = gain > 0 && state.lifetime >= PRESTIGE_MIN_LIFETIME;
  const progress = Math.min(100, (state.lifetime / PRESTIGE_MIN_LIFETIME) * 100);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-violet-300 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-violet-50 p-4">
        <h3 className="text-base font-bold text-violet-950 flex items-center gap-1.5">✨ Renaissance céleste</h3>
        <p className="text-[11px] text-violet-800/80 mt-1 leading-snug">
          Recommence à zéro et convertis ta production totale en <b>chips célestes</b>. Les chips achètent des bonus
          permanents qui survivent à tous les prestiges suivants.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/70 border border-violet-200 py-2">
            <div className="text-[10px] text-violet-700 uppercase tracking-wide">Disponibles</div>
            <div className="text-lg font-black text-violet-900 tabular-nums">{chips}</div>
          </div>
          <div className="rounded-xl bg-white/70 border border-violet-200 py-2">
            <div className="text-[10px] text-violet-700 uppercase tracking-wide">Gagnés</div>
            <div className="text-lg font-black text-violet-900 tabular-nums">{state.prestige?.chips || 0}</div>
          </div>
          <div className="rounded-xl bg-white/70 border border-violet-200 py-2">
            <div className="text-[10px] text-violet-700 uppercase tracking-wide">Prestiges</div>
            <div className="text-lg font-black text-violet-900 tabular-nums">{state.stats?.prestigeCount || 0}</div>
          </div>
        </div>

        {!canPrestige && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-violet-800 mb-1">
              <span>Prochain prestige</span>
              <span className="tabular-nums">
                {fmt(state.lifetime)} / {fmt(PRESTIGE_MIN_LIFETIME)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-500 transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onPrestige}
          disabled={!canPrestige}
          className={`mt-3 w-full px-4 py-2.5 rounded-xl font-bold border transition-all ${
            canPrestige
              ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 border-violet-700 text-white hover:from-violet-500 hover:to-fuchsia-500 shadow-lg"
              : "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
          }`}
        >
          {canPrestige ? `Renaître · +${gain} chips` : "Pas encore assez de cookies cuits"}
        </button>
      </section>

      <section>
        <h3 className="text-base font-bold text-violet-950 mb-2">Arbre céleste</h3>
        <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
          <span className="px-2 py-1 rounded-lg bg-violet-100 text-violet-800 font-semibold">
            Production {fmtPct(effects.cpsMult - 1)}
          </span>
          <span className="px-2 py-1 rounded-lg bg-violet-100 text-violet-800 font-semibold">
            Clic {fmtPct(effects.cpcMult - 1)}
          </span>
          <span className="px-2 py-1 rounded-lg bg-violet-100 text-violet-800 font-semibold">
            Coûts {fmtPct(effects.costMult - 1)}
          </span>
        </div>

        <div className="space-y-2">
          {PRESTIGE_UPGRADES.map((node) => {
            const level = state.prestige?.upgrades?.[node.id] || 0;
            const maxed = level >= node.maxLevel;
            const cost = upgradeCost(node.id, level);
            return (
              <NodeCard
                key={node.id}
                node={node}
                level={level}
                cost={cost}
                maxed={maxed}
                affordable={chips >= cost}
                onBuy={onBuyNode}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default memo(PrestigePanel);
