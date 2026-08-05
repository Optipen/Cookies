import React, { memo } from "react";
import Icon from "./Icon.jsx";
import {
  PRESTIGE_UPGRADES,
  availableChips,
  upgradeCost,
  chipsFor,
  PRESTIGE_MIN_LIFETIME,
} from "../data/prestige.js";
import {
  ascensionEffects,
  availableStars,
  canAscend,
  starsFor,
  trackCost,
  trackLevel,
  isEndlessTrack,
  ASCENSION_MIN_CHIPS,
  TRACKS,
} from "../data/ascension.js";
import { fmt, fmtPct } from "../utils/format.js";

/**
 * Un nœud de l'arbre céleste.
 *
 * Mise en scène de la maquette: la pastille ronde à gauche est ALLUMÉE quand le
 * nœud est pris (miel coulé, halo), en pointillés tant qu'il ne l'est pas. Un
 * trait vertical relie les pastilles — c'est ce qui fait un arbre plutôt
 * qu'une liste.
 */
const NodeCard = memo(function NodeCard({ node, level, cost, affordable, maxed, onBuy }) {
  const endless = node.maxLevel === Infinity;
  // Un nœud sans fin n'a pas de barre de progression: on montre une jauge
  // logarithmique qui ne sature jamais, pour garder un repère visuel.
  const pct = endless ? Math.min(100, Math.log10(1 + level) * 45) : (level / node.maxLevel) * 100;
  const pris = level > 0;

  return (
    <div className="relative flex gap-3">
      {/* Le fil de l'arbre: il descend d'un nœud au suivant. */}
      <span
        aria-hidden="true"
        className="absolute left-[27px] top-14 bottom-[-0.75rem] w-px bg-gradient-to-b from-honey/40 to-honey/5"
      />
      <span
        aria-hidden="true"
        className={`relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full ${
          pris
            ? "border-2 border-honey-light/70 bg-gradient-to-br from-honey-light to-honey-deep text-honey-dark shadow-glow"
            : "border border-dashed border-honey/35 bg-honey-light/[0.07] text-honey-light/60"
        }`}
      >
        <Icon emoji={node.emoji} size={22} />
      </span>

      <div className={`min-w-0 flex-1 rounded-[18px] p-3 ${pris ? "panel border-honey/25" : "panel-muted"}`}>
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="truncate text-[12.5px] font-bold text-cream">{node.name}</h4>
          <span className="shrink-0 text-[10.5px] font-extrabold tabular-nums text-honey">
            {endless ? `niv. ${level}` : `${level}/${node.maxLevel}`}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] leading-snug text-cream/55">{node.desc}</p>

        <div className="meter mt-2 h-1.5">
          <div className="meter-fill transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>

        <button
          type="button"
          onClick={() => onBuy(node.id)}
          disabled={maxed || !affordable}
          className={`mt-2.5 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[12px] ${
            maxed ? "btn-ghost cursor-default text-honey" : affordable ? "btn-honey" : "btn-dead"
          }`}
        >
          <Icon name="spark" size={13} />
          {maxed ? "Niveau maximum" : `Améliorer · ${cost}`}
        </button>
      </div>
    </div>
  );
});

/**
 * La Voûte: les trois voies de l'Ascension.
 *
 * Elle n'apparaît qu'une fois la première ascension faite. Montrer une couche
 * verrouillée à un joueur qui découvre encore le prestige n'ajoute pas un
 * objectif, ça ajoute du bruit.
 */
const VaultTrack = memo(function VaultTrack({ track, level, cost, affordable, maxed, onBuy }) {
  return (
    <div className="panel rounded-[18px] p-3">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-honey/25 bg-honey/10 text-honey-light"
          aria-hidden="true"
        >
          <Icon emoji={track.emoji} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="truncate text-[12.5px] font-bold text-cream">{track.name}</h4>
            <span className="shrink-0 text-[10.5px] font-extrabold tabular-nums text-honey">
              {isEndlessTrack(track.id) ? `niv. ${level}` : `${level}/${track.maxLevel}`}
            </span>
          </div>
          <p className="text-[10px] leading-snug text-cream/60">{track.desc}</p>
          <p className="mt-0.5 text-[9.5px] leading-snug text-cream/40">{track.detail}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onBuy(track.id)}
        disabled={maxed || !affordable}
        className={`mt-2.5 flex min-h-[2.75rem] w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[12px] ${
          maxed ? "btn-ghost cursor-default text-honey" : affordable ? "btn-honey" : "btn-dead"
        }`}
      >
        <Icon name="star" size={13} />
        {maxed ? "Voie complète" : `Monter · ${cost}`}
      </button>
    </div>
  );
});

/** Les trois chiffres d'un palier, en ligne. */
const Trio = memo(function Trio({ items }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-honey/10 bg-honey-light/5 py-2.5">
          <div className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-cream/45">{it.label}</div>
          <div className="text-lg font-extrabold tabular-nums text-cream">{it.value}</div>
        </div>
      ))}
    </div>
  );
});

function PrestigePanel({ state, effects, onPrestige, onBuyNode, onAscend, onBuyTrack }) {
  const etoiles = availableStars(state);
  const asc = ascensionEffects(state);
  const chipsActuels = state.prestige?.chips || 0;
  const etoilesAGagner = starsFor(chipsActuels);
  const peutAscendre = canAscend(state);
  const aDejaAscendu = (state.ascension?.count || 0) > 0;
  // La couche du dessus ne se montre qu'à l'approche: à moins de la moitié du
  // seuil, elle n'est qu'un chiffre de plus à l'écran.
  const montrerAscension = aDejaAscendu || chipsActuels >= ASCENSION_MIN_CHIPS / 2;
  const progresAscension = Math.min(100, (chipsActuels / ASCENSION_MIN_CHIPS) * 100);

  const chips = availableChips(state);
  const potential = chipsFor(state.lifetime, ascensionEffects(state).chipMult);
  const gain = Math.max(0, potential - (state.prestige?.chips || 0));
  const canPrestige = gain > 0 && state.lifetime >= PRESTIGE_MIN_LIFETIME;
  const progress = Math.min(100, (state.lifetime / PRESTIGE_MIN_LIFETIME) * 100);

  return (
    <div className="space-y-4">
      {/* --- Renaissance --- */}
      <section className="rounded-3xl border border-honey/35 bg-gradient-to-br from-honey-deep/15 to-honey/5 p-4 text-center">
        <h3 className="font-display text-xl text-cream-bright">Renaissance céleste</h3>
        <p className="mx-auto mt-1.5 max-w-xs text-[10.5px] leading-relaxed text-cream/60">
          Recommence à zéro et convertis ta production totale en <b className="text-cream">chips célestes</b>. Les chips
          achètent des bonus permanents qui survivent à tous les prestiges suivants.
        </p>

        <Trio
          items={[
            { label: "Disponibles", value: chips },
            { label: "Gagnés", value: state.prestige?.chips || 0 },
            { label: "Prestiges", value: state.stats?.prestigeCount || 0 },
          ]}
        />

        {!canPrestige && (
          <div className="mt-3 text-left">
            <div className="mb-1.5 flex justify-between text-[10px] text-cream/55">
              <span>Prochain prestige</span>
              <span className="tabular-nums">
                {fmt(state.lifetime)} / {fmt(PRESTIGE_MIN_LIFETIME)}
              </span>
            </div>
            <div className="meter h-1.5">
              <div className="meter-fill transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onPrestige}
          disabled={!canPrestige}
          className={`mt-3.5 min-h-[3rem] w-full rounded-2xl px-4 text-[12.5px] ${
            canPrestige ? "btn-honey" : "btn-dead"
          }`}
        >
          {canPrestige ? `Renaître · +${gain} chips` : "Pas encore assez de cookies cuits"}
        </button>
      </section>

      {/* --- Ascension --- */}
      {montrerAscension && (
        <section className="panel rounded-3xl p-4 text-center">
          <h3 className="inline-flex items-center gap-2 font-display text-xl text-cream-bright">
            <Icon name="star" size={16} className="text-honey" />
            Ascension
          </h3>
          <p className="mx-auto mt-1.5 max-w-xs text-[10.5px] leading-relaxed text-cream/60">
            Au-dessus du prestige. Une ascension emporte la partie, les chips <i>et</i> l&apos;arbre céleste, et rend des{" "}
            <b className="text-cream">étoiles</b>. Tu gardes les étoiles, la Voûte, ton CRMB, le Registre, tes apparences
            et tes succès.
          </p>

          <Trio
            items={[
              { label: "Étoiles libres", value: etoiles },
              { label: "Ascensions", value: state.ascension?.count || 0 },
              { label: "Rangs ouverts", value: 16 + asc.horizon * 2 },
            ]}
          />

          {!peutAscendre && (
            <div className="mt-3 text-left">
              <div className="mb-1.5 flex justify-between text-[10px] text-cream/55">
                <span>Prochaine ascension</span>
                <span className="tabular-nums">
                  {fmt(chipsActuels)} / {fmt(ASCENSION_MIN_CHIPS)} chips
                </span>
              </div>
              <div className="meter h-1.5">
                <div className="meter-fill transition-[width] duration-500" style={{ width: `${progresAscension}%` }} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onAscend}
            disabled={!peutAscendre}
            className={`mt-3.5 flex min-h-[2.75rem] w-full items-center justify-center gap-1.5 rounded-2xl px-4 text-[12.5px] ${
              peutAscendre ? "btn-honey" : "btn-dead"
            }`}
          >
            {peutAscendre && <Icon name="star" size={13} />}
            {peutAscendre ? `Ascendre · +${etoilesAGagner}` : "Pas encore assez de chips célestes"}
          </button>

          {aDejaAscendu && (
            <div className="mt-4 space-y-2 text-left">
              <h4 className="eyebrow">La Voûte</h4>
              {TRACKS.map((track) => {
                const level = trackLevel(state, track.id);
                const cost = trackCost(track.id, level);
                return (
                  <VaultTrack
                    key={track.id}
                    track={track}
                    level={level}
                    cost={cost}
                    maxed={level >= track.maxLevel}
                    affordable={etoiles >= cost}
                    onBuy={onBuyTrack}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* --- L'arbre --- */}
      <section>
        <div className="mb-2.5 text-center">
          <h3 className="font-display text-xl text-cream-bright">Arbre céleste</h3>
          <span className="pill mt-2 px-4 py-2 text-[13px]">
            <Icon name="spark" size={14} />
            <b className="tabular-nums">{chips} chips</b>
          </span>
        </div>

        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          <span className="pill text-[10px]">Production {fmtPct(effects.cpsMult - 1)}</span>
          <span className="pill text-[10px]">Clic {fmtPct(effects.cpcMult - 1)}</span>
          <span className="pill text-[10px]">Coûts {fmtPct(effects.costMult - 1)}</span>
        </div>

        {/* `overflow-hidden` coupe le dernier fil de l'arbre: sans lui, le
            trait du dernier nœud dépasserait sous la liste. */}
        <div className="space-y-3 overflow-hidden">
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
