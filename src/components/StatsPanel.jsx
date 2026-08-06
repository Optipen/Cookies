import React, { memo, useMemo, useState } from "react";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, TIER_STYLE } from "../data/achievements.js";
import { ITEMS } from "../data/items.js";
import { MINERS } from "../utils/crypto.js";
import { fmt, fmtInt, fmtDuration, fmtCrmb, fmtPct, fmtMult } from "../utils/format.js";
import { activeRatio, REF_CLICKS_PER_SECOND, REF_COMBO } from "../utils/selectors.js";
import { snap } from "../utils/grid.js";

const Stat = memo(function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-honey/10 bg-honey-light/5 px-3 py-2.5">
      <div className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-cream/45">{label}</div>
      <div className="truncate text-[15px] font-extrabold tabular-nums text-cream">{value}</div>
      {hint && <div className="text-[9px] text-cream/40">{hint}</div>}
    </div>
  );
});

const Badge = memo(function Badge({ achievement, unlocked }) {
  const style = TIER_STYLE[achievement.tier] || TIER_STYLE[1];
  return (
    <div
      title={unlocked ? achievement.desc : "Succès verrouillé"}
      className={`rounded-2xl border p-2 text-center transition-all duration-200 ${
        unlocked ? `${style.bg} ${style.text} ${style.border}` : "border-honey/10 bg-honey-light/[0.03] text-cream/40"
      }`}
    >
      <div className="truncate text-[10px] font-extrabold leading-tight">{unlocked ? achievement.name : "???"}</div>
      <div className="mt-0.5 line-clamp-2 text-[8.5px] leading-tight opacity-70">
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

  // Compteurs à VIE: rien ne les remet à zéro, et ce sont eux que les succès
  // cumulatifs comptent. Le repli couvre une sauvegarde à peine migrée.
  const vie = state.lifetimeStats || {
    clicks: state.stats?.clicks || 0,
    goldenClicks: state.stats?.goldenClicks || 0,
    cookiesEaten: state.cookieEatenCount || 0,
    questsCompleted: questsDone,
    bestStreak: state.quests?.streak || 0,
  };

  const visible = useMemo(
    () => (filter === "tous" ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.cat === filter)),
    [filter]
  );

  return (
    <div className="space-y-4">
      <section>
        <h3 className="font-display text-xl text-cream-bright mb-2.5">Profil</h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cookies en banque" value={fmtInt(state.cookies)} />
          <Stat label="Cuits au total" value={fmtInt(state.lifetime)} />
          <Stat label="Minage" value={`${fmt(stats.mining)} /s`} hint={`Record ${fmt(state.stats?.bestCps || 0)} /s`} />
          <Stat label="Puissance de clic" value={`${fmt(stats.perClickNoCombo)} /clic`} />
          {/* Les cumuls affichés sont ceux de la VIE du joueur — ce sont eux que
              les succès comptent. Le chiffre de la partie en cours reste juste
              en dessous: sans lui, un compteur qui ne redescend jamais donne
              l'impression que la renaissance n'a rien remis à zéro. */}
          <Stat label="Clics" value={fmtInt(vie.clicks)} hint={`Partie en cours ${fmtInt(state.stats?.clicks || 0)}`} />
          <Stat
            label="Cookies dorés"
            value={fmtInt(vie.goldenClicks)}
            hint={`Partie en cours ${fmtInt(state.stats?.goldenClicks || 0)}`}
          />
          <Stat label="Cliqueurs + Mineurs" value={fmtInt(buildings)} />
          <Stat label="Améliorations" value={`${Object.keys(state.upgrades || {}).length}`} />
          <Stat
            label="Quêtes terminées"
            value={fmtInt(vie.questsCompleted)}
            hint={`Série ${state.quests?.streak || 0} j · record ${vie.bestStreak || 0} j`}
          />
          <Stat
            label="Cookies croqués"
            value={fmtInt(vie.cookiesEaten)}
            hint={`Partie en cours ${fmtInt(state.cookieEatenCount || 0)}`}
          />
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
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="eyebrow">Succès</h3>
          <span className="text-[10.5px] font-bold tabular-nums text-cream/55">
            {unlockedCount}/{ACHIEVEMENTS.length}
          </span>
        </div>

        <div className="meter mb-2.5 h-1.5">
          <div
            className="meter-fill transition-[width] duration-500"
            style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Filtrer les succès">
          {["tous", ...ACHIEVEMENT_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={filter === cat}
              onClick={() => setFilter(cat)}
              className={`min-h-11 shrink-0 rounded-xl px-3 text-[11px] capitalize ${
                filter === cat ? "btn-honey" : "btn-ghost"
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
