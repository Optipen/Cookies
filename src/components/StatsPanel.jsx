import React, { memo, useMemo, useState } from "react";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, TIER_STYLE } from "../data/achievements.js";
import { ITEMS } from "../data/items.js";
import { MINERS } from "../utils/crypto.js";
import { fmt, fmtInt, fmtDuration, fmtCrmb, fmtPct, fmtMult } from "../utils/format.js";
import { activeRatio, REF_CLICKS_PER_SECOND, REF_COMBO } from "../utils/selectors.js";
import { snap } from "../utils/grid.js";

const Stat = memo(function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-white/70 border border-amber-200 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-amber-700">{label}</div>
      <div className="text-sm font-bold text-amber-950 tabular-nums truncate">{value}</div>
      {hint && <div className="text-[11px] text-amber-700/70">{hint}</div>}
    </div>
  );
});

const Badge = memo(function Badge({ achievement, unlocked }) {
  const style = TIER_STYLE[achievement.tier] || TIER_STYLE[1];
  return (
    <div
      title={unlocked ? achievement.desc : "Succès verrouillé"}
      className={`p-2 rounded-xl border text-center transition-all duration-200 ${
        unlocked
          ? `bg-gradient-to-br ${style.bg} ${style.text} border-transparent ring-2 ${style.ring} shadow-sm`
          : "bg-stone-100/60 border-stone-200 text-stone-400"
      }`}
    >
      <div className="text-[11px] font-bold leading-tight truncate">{unlocked ? achievement.name : "???"}</div>
      <div className="text-[11px] opacity-70 mt-0.5 leading-tight line-clamp-2">
        {unlocked ? style.label : achievement.desc}
      </div>
    </div>
  );
});

function StatsPanel({ state, stats }) {
  const [filter, setFilter] = useState("tous");

  const unlockedCount = Object.keys(state.unlocked || {}).length;

  const buildings = useMemo(() => ITEMS.reduce((sum, it) => sum + (state.items?.[it.id] || 0), 0), [state.items]);
  const miners = useMemo(
    () => MINERS.reduce((sum, m) => sum + (state.crypto?.miners?.[m.id] || 0), 0),
    [state.crypto?.miners]
  );
  const questsDone = useMemo(
    () => Object.values(state.quests?.completed || {}).reduce((a, b) => a + b, 0),
    [state.quests?.completed]
  );

  const visible = useMemo(
    () => (filter === "tous" ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.cat === filter)),
    [filter]
  );

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-base font-bold text-amber-950 mb-2">Statistiques</h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cookies en banque" value={fmtInt(state.cookies)} />
          <Stat label="Cuits au total" value={fmtInt(state.lifetime)} />
          <Stat label="Minage" value={`${fmt(stats.mining)} /s`} hint={`Record ${fmt(state.stats?.bestCps || 0)} /s`} />
          <Stat label="Puissance de clic" value={`${fmt(stats.perClickNoCombo)} /clic`} />
          <Stat label="Clics" value={fmtInt(state.stats?.clicks || 0)} />
          <Stat label="Cookies dorés" value={fmtInt(state.stats?.goldenClicks || 0)} />
          <Stat label="Cliqueurs + Mineurs" value={fmtInt(buildings)} />
          <Stat label="Améliorations" value={`${Object.keys(state.upgrades || {}).length}`} />
          <Stat label="Quêtes terminées" value={fmtInt(questsDone)} hint={`Série ${state.quests?.streak || 0} j`} />
          <Stat label="Cookies croqués" value={fmtInt(state.cookieEatenCount || 0)} />
          <Stat label="CRMB extrait" value={fmtCrmb(state.crypto?.totalMined || 0)} hint={`${miners} machines`} />
          <Stat label="Boost staking" value={fmtPct(stats.stakeMult - 1, 1)} />
          <Stat label="Chips célestes" value={fmtInt(state.prestige?.chips || 0)} hint={`${state.stats?.prestigeCount || 0} prestiges`} />
          <Stat label="Temps de jeu" value={fmtDuration(state.stats?.playtimeMs || 0)} />
          <Stat
            label="Actif / passif"
            // Sans le moindre Mineur le rapport est infini: « — » dit mieux
            // « pas encore de passif à comparer » que « ≈∞× ».
            value={Number.isFinite(activeRatio(state)) ? `≈${fmtMult(snap(activeRatio(state)))}×` : "—"}
            hint={`Réf. ${REF_CLICKS_PER_SECOND} clics/s · combo ×${fmtMult(REF_COMBO)}`}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-amber-950">Succès</h3>
          <span className="text-[11px] text-amber-700 font-semibold">
            {unlockedCount}/{ACHIEVEMENTS.length}
          </span>
        </div>

        <div className="h-2 rounded-full bg-amber-100 overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-fuchsia-400 transition-[width] duration-500"
            style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="Filtrer les succès">
          {["tous", ...ACHIEVEMENT_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={filter === cat}
              onClick={() => setFilter(cat)}
              className={`shrink-0 text-[11px] px-2.5 py-1 rounded-lg font-semibold capitalize transition-colors ${
                filter === cat ? "bg-amber-500 text-white" : "bg-amber-100/70 text-amber-800 hover:bg-amber-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
          {visible.map((a) => (
            <Badge key={a.id} achievement={a} unlocked={!!state.unlocked?.[a.id]} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default memo(StatsPanel);
