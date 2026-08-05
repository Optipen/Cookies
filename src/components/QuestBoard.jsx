import React, { memo } from "react";
import { QUEST_BY_ID, questTitle, questDesc, CATEGORY_STYLE } from "../quests/catalog.js";
import { fmt, fmtInt, fmtCrmb, fmtClock, fmtDuration } from "../utils/format.js";
import { useTimeLeft, useClock } from "../hooks/useClock.js";

// Chronomètre isolé: se rafraîchit 5×/s sans re-rendre le reste du plateau
const QuestTimer = memo(function QuestTimer({ expiresAt, startedAt }) {
  const left = useTimeLeft(expiresAt, 200);
  if (!expiresAt) return null;
  const total = Math.max(1, expiresAt - startedAt);
  const ratio = Math.max(0, Math.min(1, left / total));
  const urgent = left < 6000;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className={urgent ? "text-red-600 font-semibold" : "text-amber-700"}>⏱ Temps restant</span>
        <span className={`tabular-nums font-bold ${urgent ? "text-red-600" : "text-amber-800"}`} aria-live="polite">
          {fmtClock(left)}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full bg-amber-100 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-label="Temps restant"
      >
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${
            urgent ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-amber-400 to-orange-500"
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
});

const RewardChips = memo(function RewardChips({ quest, state, ctx }) {
  let reward;
  try {
    reward = quest.reward?.(state, ctx, {});
  } catch {
    // Une récompense qui ne sait pas se calculer n'est simplement pas affichée
  }
  if (!reward) return null;

  const chips = [];
  // Même arithmétique que `resolveReward`: cookies × bonus de quête, PLANCHER
  // entier — et le CRMB tel quel, parce que le moteur ne le multiplie pas.
  // La carte annonçait « +1,25 CRMB » quand le joueur allait recevoir 1.
  if (reward.cookies) chips.push({ key: "c", label: `+${fmt(Math.floor(reward.cookies * (ctx.questMult || 1)))}`, cls: "bg-amber-100 text-amber-800 border-amber-300" });
  if (reward.crmb) chips.push({ key: "m", label: `+${fmtCrmb(reward.crmb)} CRMB`, cls: "bg-cyan-100 text-cyan-800 border-cyan-300" });
  if (reward.buff) chips.push({ key: "b", label: reward.buff.label, cls: "bg-emerald-100 text-emerald-800 border-emerald-300" });
  if (reward.discount) chips.push({ key: "d", label: reward.discount.label, cls: "bg-violet-100 text-violet-800 border-violet-300" });

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {chips.map((c) => (
        <span key={c.key} className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md border ${c.cls}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
});

const QuestCard = memo(function QuestCard({ entry, state, ctx, onReroll, daily }) {
  const quest = QUEST_BY_ID[entry.questId];
  if (!quest) return null;

  const pct = entry.target > 0 ? Math.min(100, (entry.progress / entry.target) * 100) : 0;
  const style = CATEGORY_STYLE[quest.category] || { color: "amber", icon: "🎯" };
  const nearlyDone = pct >= 80;

  return (
    <article
      className={`relative rounded-xl border p-3 transition-all duration-200 ${
        daily
          ? "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300/70"
          : "bg-white/75 border-amber-200 hover:border-amber-300"
      } ${nearlyDone ? "ring-2 ring-emerald-400/40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5" aria-hidden="true">
          {quest.icon || style.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold text-amber-950 leading-tight">{questTitle(quest, entry.meta)}</h4>
            {onReroll && (
              <button
                type="button"
                onClick={() => onReroll(entry.questId)}
                title="Remplacer cette quête"
                aria-label={`Remplacer la quête ${questTitle(quest, entry.meta)}`}
                className="shrink-0 text-xs text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded-md px-1.5 py-0.5 transition-colors"
              >
                ↻
              </button>
            )}
          </div>
          <p className="text-[11px] text-amber-800/75 leading-snug mt-0.5">{questDesc(quest, entry.meta)}</p>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-[11px] text-amber-700 mb-1">
          <span className="capitalize">{quest.category}</span>
          <span className="tabular-nums font-semibold">
            {/* La progression est un compteur qui accumule des tics: « 817,42 »
                n'apprend rien de plus que « 817 », et sort de la règle. */}
            {fmtInt(entry.progress)} / {fmt(entry.target)}
          </span>
        </div>
        <div
          className="h-2 rounded-full bg-amber-100 overflow-hidden shadow-inner"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div
            className={`h-full transition-[width] duration-500 ${
              nearlyDone ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-amber-400 to-orange-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {entry.expiresAt > 0 && <QuestTimer expiresAt={entry.expiresAt} startedAt={entry.startedAt} />}
      <RewardChips quest={quest} state={state} ctx={ctx} />
    </article>
  );
});

const DailyReset = memo(function DailyReset({ resetAt }) {
  const now = useClock(30_000, !!resetAt);
  if (!resetAt) return null;
  return <span className="text-[11px] text-orange-700 tabular-nums">Renouvelées dans {fmtDuration(resetAt - now)}</span>;
});

function QuestBoard({ state, ctx, onReroll }) {
  const quests = state.quests || {};
  const active = quests.active || [];
  const daily = quests.daily || [];
  const completedCount = Object.values(quests.completed || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-amber-950">Quêtes en cours</h3>
          <span className="text-[11px] text-amber-700">{completedCount} terminées</span>
        </div>
        <div className="space-y-2">
          {active.length === 0 && (
            <p className="text-sm text-amber-800/70 italic py-3 text-center">
              Aucune quête disponible pour l&apos;instant — continue à jouer.
            </p>
          )}
          {active.map((entry) => (
            <QuestCard key={entry.questId} entry={entry} state={state} ctx={ctx} onReroll={onReroll} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-orange-900 flex items-center gap-1.5">
            📅 Quêtes du jour
            {quests.streak > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500 text-white">
                🔥 {quests.streak}
              </span>
            )}
          </h3>
          <DailyReset resetAt={quests.dailyResetAt} />
        </div>
        <div className="space-y-2">
          {daily.map((entry) => (
            <QuestCard key={entry.questId} entry={entry} state={state} ctx={ctx} daily />
          ))}
        </div>
      </section>
    </div>
  );
}

export default memo(QuestBoard);
