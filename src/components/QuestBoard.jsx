import React, { memo } from "react";
import Icon from "./Icon.jsx";
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
    <div className="mt-2.5">
      <div className="mb-1.5 flex items-center justify-between text-[10px]">
        <span className={`inline-flex items-center gap-1.5 ${urgent ? "font-semibold text-lava" : "text-cream/50"}`}>
          <Icon name="clock" size={11} />
          Temps restant
        </span>
        <span className={`font-bold tabular-nums ${urgent ? "text-lava" : "text-cream/75"}`} aria-live="polite">
          {fmtClock(left)}
        </span>
      </div>
      <div
        className="meter h-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-label="Temps restant"
      >
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${
            urgent ? "meter-fill-lava" : "meter-fill"
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
  if (reward.cookies) chips.push({ key: "c", label: `+${fmt(Math.floor(reward.cookies * (ctx.questMult || 1)))}`, cls: "bg-honey/10 text-honey-light border-honey/25" });
  if (reward.crmb) chips.push({ key: "m", label: `+${fmtCrmb(reward.crmb)} CRMB`, cls: "bg-crmb/10 text-crmb border-crmb/25" });
  if (reward.buff) chips.push({ key: "b", label: reward.buff.label, cls: "bg-mint/10 text-mint border-mint/25" });
  if (reward.discount) chips.push({ key: "d", label: reward.discount.label, cls: "bg-lava/10 text-lava border-lava/25" });

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c.key} className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${c.cls}`}>
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
      className={`relative rounded-[20px] p-3.5 transition-all duration-200 ${
        daily ? "panel border-honey/30" : "panel"
      } ${nearlyDone ? "border-mint/30 shadow-[0_0_0_3px_rgba(127,216,168,.07)]" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${
            nearlyDone ? "border-mint/25 bg-mint/10 text-mint" : "border-honey/20 bg-honey/10 text-honey-light"
          }`}
          aria-hidden="true"
        >
          <Icon emoji={quest.icon || style.icon} size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[12.5px] font-bold leading-tight text-cream">{questTitle(quest, entry.meta)}</h4>
            {onReroll && (
              <button
                type="button"
                onClick={() => onReroll(entry.questId)}
                title="Remplacer cette quête"
                aria-label={`Remplacer la quête ${questTitle(quest, entry.meta)}`}
                className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl text-cream/40 transition-colors hover:bg-honey/10 hover:text-honey"
              >
                <Icon name="refresh" size={14} />
              </button>
            )}
          </div>
          <p className="mt-1 text-[10.5px] leading-snug text-cream/55">{questDesc(quest, entry.meta)}</p>
        </div>
      </div>

      <div className="mt-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-cream/50">
          <span className="capitalize">{quest.category}</span>
          <span className="tabular-nums font-semibold text-cream/75">
            {/* La progression est un compteur qui accumule des tics: « 817,42 »
                n'apprend rien de plus que « 817 », et sort de la règle. */}
            {fmtInt(entry.progress)} / {fmt(entry.target)}
          </span>
        </div>
        <div
          className="meter h-[7px]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div
            className={`h-full transition-[width] duration-500 ${nearlyDone ? "meter-fill-mint" : "meter-fill"}`}
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
  return <span className="text-[10px] text-cream/45 tabular-nums">Renouvelées dans {fmtDuration(resetAt - now)}</span>;
});

function QuestBoard({ state, ctx, onReroll }) {
  const quests = state.quests || {};
  const active = quests.active || [];
  const daily = quests.daily || [];
  const completedCount = Object.values(quests.completed || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2.5 flex items-baseline justify-between">
          <h3 className="font-display text-xl text-cream-bright">Quêtes</h3>
          <span className="text-[10.5px] text-cream/50">{completedCount} terminées</span>
        </div>
        <div className="space-y-2">
          {active.length === 0 && (
            <p className="py-3 text-center text-[12px] italic text-cream/45">
              Aucune quête disponible pour l&apos;instant — continue à jouer.
            </p>
          )}
          {active.map((entry) => (
            <QuestCard key={entry.questId} entry={entry} state={state} ctx={ctx} onReroll={onReroll} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="eyebrow flex items-center gap-2">
            Quêtes du jour
            {quests.streak > 0 && (
              <span className="btn-honey inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] tracking-normal">
                <Icon name="flame" size={10} />
                {quests.streak}
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
