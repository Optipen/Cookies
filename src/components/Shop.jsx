import React, { memo, useCallback, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import { CLICKERS, MINER_ITEMS, LABELS, itemUnlocked } from "../data/items.js";
import { costOf, deriveStats, timeToAfford, maxAffordable, REF_CLICKS_PER_SECOND } from "../utils/selectors.js";
import { fmt, fmtExact, fmtPrix, fmtDuration } from "../utils/format.js";
import { snapDown } from "../utils/grid.js";
import { useClock, useTimeLeft } from "../hooks/useClock.js";

const FlashTimer = memo(function FlashTimer({ until }) {
  const left = useTimeLeft(until, 250);
  if (left <= 0) return null;
  return <span className="tabular-nums">{Math.ceil(left / 1000)}s</span>;
});

/**
 * Une carte de boutique, pensée pour le pouce.
 *
 * Fermée, elle ne dit que ce qu'il faut pour décider: quoi, combien j'en ai,
 * ce que ça rapporte, ce que ça coûte. L'ancienne version affichait en
 * permanence « 404,08K → 404,14K », deux nombres presque identiques qui
 * remplissaient la carte sans rien apprendre.
 *
 * Ouverte — un appui sur la carte — elle montre le détail: valeur propre,
 * avant/après, et le second gain des Mineurs.
 */
const ItemCard = memo(function ItemCard({
  item,
  owned,
  price,
  affordable,
  flash,
  isFree,
  qty,
  onBuy,
  before,
  after,
  gainMain,
  gainClick,
  unit,
  eta,
  progress,
  ouverte,
  onToggle,
}) {
  const achetable = affordable || isFree;
  const clic = item.mode === "click";

  return (
    <div className={`overflow-hidden rounded-[20px] transition-colors ${achetable ? "panel" : "panel-muted"}`}>
      <div className="flex items-stretch">
        {/* Zone d'information: ouvre le détail. Large, donc facile à viser. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={ouverte}
          aria-label={`Détail de ${item.name}`}
          className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left transition-colors active:bg-honey/[0.06]"
        >
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border ${
              clic
                ? "border-honey/20 bg-honey/10 text-honey-light"
                : "border-mint/25 bg-mint/10 text-mint"
            } ${achetable ? "" : "opacity-50 saturate-50"}`}
            aria-hidden="true"
          >
            <Icon emoji={item.emoji} size={20} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[12.5px] font-bold leading-tight text-cream line-clamp-2">{item.name}</span>
              {owned > 0 && (
                <span className="shrink-0 text-[10px] font-semibold text-honey tabular-nums">×{owned}</span>
              )}
            </span>
            {/* Le gain réel, en gros: c'est la seule chose qui décide l'achat. */}
            <span className={`block text-[11px] font-bold tabular-nums ${clic ? "text-honey-light" : "text-mint"}`}>
              +{fmt(gainMain)} {unit}
            </span>
          </span>
        </button>

        {/* Bouton d'achat séparé: on n'ouvre jamais le détail par erreur en
            voulant acheter, ni l'inverse. */}
        <button
          type="button"
          onClick={onBuy}
          disabled={!achetable}
          aria-label={`Acheter ${qty > 1 ? `${qty} ` : ""}${item.name} pour ${fmtPrix(price)} cookies`}
          title={isFree ? undefined : `${fmtExact(price)} cookies`}
          className={`relative w-[5.5rem] sm:w-24 shrink-0 flex flex-col items-center justify-center gap-0.5 border-l border-honey/15 transition-all ${
            achetable
              ? "bg-gradient-to-b from-honey-light to-honey-deep text-honey-dark active:brightness-95"
              : "bg-honey-light/[0.04] text-cream/40 cursor-not-allowed"
          }`}
        >
          {flash && (
            <span className="absolute -top-px right-1 rounded-full bg-lava-deep px-1.5 text-[9px] font-extrabold text-cream-bright">
              -{Math.round(flash.discount * 100)} % <FlashTimer until={flash.until} />
            </span>
          )}
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.1em] opacity-80">
            {isFree ? "Offert" : qty > 1 ? `Acheter ×${qty}` : "Acheter"}
          </span>
          {/* Le prix affiché EST le prix payé: plein sous le million, compact
              seulement quand il est exact — jamais « 125K » pour 124 800. */}
          <span className="text-[13px] font-extrabold tabular-nums">{isFree ? "0" : fmtPrix(price)}</span>
          {!achetable && eta != null && eta <= 86_400_000 && (
            <span className="text-[9px] tabular-nums opacity-70">~{fmtDuration(eta)}</span>
          )}
        </button>
      </div>

      {/* Barre de progression vers l'achat: le prochain objectif est toujours
          visible, même quand on ne peut pas encore se l'offrir. */}
      {!achetable && (
        <div className="h-1 bg-honey-light/[0.08]" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-honey-light to-honey-deep transition-[width] duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {ouverte && (
        <div className="border-t border-honey/10 bg-honey/[0.04] px-3.5 pb-3 pt-2 text-[11px] tabular-nums">
          <p className="mb-2 not-italic text-cream/55">{item.desc}</p>
          <dl className="space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-cream/45">Valeur de base</dt>
              <dd className="font-semibold text-cream">
                +{fmtExact(item.value)} {unit}
              </dd>
            </div>
            {gainClick > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-cream/45">Aussi, en puissance de clic</dt>
                <dd className="font-semibold text-honey-light">
                  +{fmt(gainClick)} {LABELS.click.unit}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-cream/45">{LABELS[item.mode].axis}</dt>
              <dd className="text-cream/70">
                {fmt(before)} <span aria-hidden="true">→</span>{" "}
                <span className="font-bold text-mint">
                  {fmt(after)} {unit}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
});

const Section = memo(function Section({ label, total, unit, rows, qty, onBuy, ouverte, onToggle }) {
  const mine = label === LABELS.mine;
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      {/* L'intertitre en capitales espacées: la famille à gauche, ce qu'elle
          rapporte à droite. Le miel pour les Cliqueurs, la menthe pour les
          Mineurs — la couleur dit déjà de quel axe on parle. */}
      <header className="flex items-baseline justify-between gap-2 px-1">
        <h4 className={`eyebrow ${mine ? "text-mint" : ""}`}>{label.many}</h4>
        <span className="text-[10.5px] text-cream/50 tabular-nums">
          <b className={mine ? "text-mint" : "text-honey"}>{fmt(total)}</b> {unit}
        </span>
      </header>
      {rows.map((r) => (
        <ItemCard
          key={r.item.id}
          {...r}
          qty={qty}
          ouverte={ouverte === r.item.id}
          onToggle={() => onToggle(r.item.id)}
          onBuy={() => onBuy(r.item.id, qty)}
        />
      ))}
    </section>
  );
});

function Shop({ state, filter = "all", onBuy, qty = 1, stats }) {
  const now = useClock(500);
  const [ouverte, setOuverte] = useState(null);
  const toggle = useCallback((id) => setOuverte((v) => (v === id ? null : id)), []);

  const build = useCallback(
    (list) => {
      const base = deriveStats(state, now, 0);
      // Les rangs que l'Ascension n'a pas ouverts n'apparaissent pas du tout:
      // une carte grisée qu'on ne peut pas débloquer n'est pas un objectif,
      // c'est un mur.
      return list.filter((item) => itemUnlocked(item, state)).map((item) => {
        const owned = state.items[item.id] || 0;
        // « Max » achète tout ce que la banque permet, au moins un exemplaire
        // pour que le prix affiché reste celui d'un achat possible.
        const n = qty === "max" ? Math.max(1, maxAffordable(state, item.id, 1000, now)) : qty;
        const price = costOf(state, item.id, n, now);
        const next = deriveStats({ ...state, items: { ...state.items, [item.id]: owned + n } }, now, 0);

        const isClick = item.mode === "click";
        const before = isClick ? base.perClickNoCombo : base.mining;
        const after = isClick ? next.perClickNoCombo : next.mining;
        // Un Mineur augmente aussi le clic, via la part reversée. C'est un
        // second gain, dans une autre unité: il ne s'additionne pas au premier.
        // Les ÉCARTS affichés sont pliés sur la règle: quand un achat fait
        // franchir cent, « entier − quart » rend un 499,25 qui n'existe pas.
        // Le détail avant → après reste exact pour qui veut vérifier.
        const gainClick = isClick ? 0 : snapDown(next.perClickNoCombo - base.perClickNoCombo);

        const flash =
          state.flags?.flash && state.flags.flash.itemId === item.id && now < state.flags.flash.until
            ? state.flags.flash
            : null;

        return {
          item,
          owned,
          price,
          flash,
          before,
          after,
          gainMain: snapDown(after - before),
          gainClick,
          unit: LABELS[item.mode].unit,
          isFree: price === 0,
          affordable: state.cookies >= price,
          eta: timeToAfford(state, price, base, REF_CLICKS_PER_SECOND),
          progress: price > 0 ? Math.min(1, (state.cookies || 0) / price) : 1,
        };
      });
    },
    [state, qty, now]
  );

  const clickRows = useMemo(() => (filter === "mine" ? [] : build(CLICKERS)), [build, filter]);
  const mineRows = useMemo(() => (filter === "click" ? [] : build(MINER_ITEMS)), [build, filter]);

  return (
    <div className="space-y-4" data-shop>
      <Section
        label={LABELS.click}
        total={stats.perClickNoCombo}
        unit={LABELS.click.unit}
        rows={clickRows}
        qty={qty}
        onBuy={onBuy}
        ouverte={ouverte}
        onToggle={toggle}
      />
      <Section
        label={LABELS.mine}
        total={stats.mining}
        unit={LABELS.mine.unit}
        rows={mineRows}
        qty={qty}
        onBuy={onBuy}
        ouverte={ouverte}
        onToggle={toggle}
      />
    </div>
  );
}

export default memo(Shop);
