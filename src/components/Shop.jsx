import React, { memo, useCallback, useMemo, useState } from "react";
import { CLICKERS, MINER_ITEMS, LABELS } from "../data/items.js";
import { costOf, deriveStats, timeToAfford, maxAffordable, REF_CLICKS_PER_SECOND } from "../utils/selectors.js";
import { fmt, fmtDuration, LOCALE } from "../utils/format.js";
import { useClock, useTimeLeft } from "../hooks/useClock.js";

// La valeur propre s'écrit en toutes lettres — « +100 000 /s », pas « +100K ».
// C'est le nombre rond de la fiche: le compacter lui ferait perdre sa raison
// d'être. Il ne dépasse jamais 100 000, il tient donc toujours sur la ligne.
const valeurPropre = (n) => n.toLocaleString(LOCALE, { maximumFractionDigits: 2 });

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
    <div
      className={`rounded-2xl border overflow-hidden transition-colors ${
        achetable ? "bg-white/85 border-amber-200" : "bg-stone-100/70 border-stone-200"
      }`}
    >
      <div className="flex items-stretch">
        {/* Zone d'information: ouvre le détail. Large, donc facile à viser. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={ouverte}
          aria-label={`Détail de ${item.name}`}
          className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left active:bg-amber-50/60"
        >
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl ${
              clic ? "bg-amber-100" : "bg-emerald-100"
            } ${achetable ? "" : "grayscale opacity-70"}`}
            aria-hidden="true"
          >
            {item.emoji}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5">
              <span className="font-bold text-amber-950 leading-tight line-clamp-2">{item.name}</span>
              {owned > 0 && (
                <span className="shrink-0 text-xs font-semibold text-amber-600 tabular-nums">×{owned}</span>
              )}
            </span>
            {/* Le gain réel, en gros: c'est la seule chose qui décide l'achat. */}
            <span className={`block text-sm font-bold tabular-nums ${clic ? "text-amber-700" : "text-emerald-700"}`}>
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
          aria-label={`Acheter ${qty > 1 ? `${qty} ` : ""}${item.name} pour ${fmt(price)} cookies`}
          className={`relative w-24 sm:w-28 shrink-0 flex flex-col items-center justify-center gap-0.5 border-l transition-all ${
            achetable
              ? "border-amber-200 bg-gradient-to-b from-amber-400 to-orange-500 text-white active:from-amber-500 active:to-orange-600"
              : "border-stone-200 bg-stone-200/60 text-stone-500 cursor-not-allowed"
          }`}
        >
          {flash && (
            <span className="absolute -top-0.5 right-1 px-1.5 rounded-full text-[10px] font-bold bg-red-600 text-white shadow">
              -{Math.round(flash.discount * 100)} % <FlashTimer until={flash.until} />
            </span>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
            {isFree ? "Offert" : qty > 1 ? `Acheter ×${qty}` : "Acheter"}
          </span>
          <span className="text-sm font-black tabular-nums">{isFree ? "0" : fmt(price)}</span>
          {!achetable && eta != null && eta <= 86_400_000 && (
            <span className="text-[10px] tabular-nums opacity-80">~{fmtDuration(eta)}</span>
          )}
        </button>
      </div>

      {/* Barre de progression vers l'achat: le prochain objectif est toujours
          visible, même quand on ne peut pas encore se l'offrir. */}
      {!achetable && (
        <div className="h-1 bg-stone-200" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-amber-300 to-orange-400 transition-[width] duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {ouverte && (
        <div className="px-3 pb-3 pt-1 text-[11px] tabular-nums border-t border-amber-100 bg-amber-50/50">
          <p className="text-amber-800/80 mb-1.5 not-italic">{item.desc}</p>
          <dl className="space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-amber-900/60">Valeur de base</dt>
              <dd className="font-semibold text-amber-900">
                +{valeurPropre(item.value)} {unit}
              </dd>
            </div>
            {gainClick > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-amber-900/60">Aussi, en puissance de clic</dt>
                <dd className="font-semibold text-sky-700">
                  +{fmt(gainClick)} {LABELS.click.unit}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-amber-900/60">{LABELS[item.mode].axis}</dt>
              <dd className="text-amber-900">
                {fmt(before)} <span aria-hidden="true">→</span>{" "}
                <span className="font-bold text-emerald-700">
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
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between gap-2 px-0.5">
        <h4 className="text-sm font-bold text-amber-900">
          {label.icon} {label.many}
        </h4>
        <span className="text-[11px] text-amber-700 tabular-nums">
          <b>{fmt(total)}</b> {unit}
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
      return list.map((item) => {
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
        const gainClick = isClick ? 0 : next.perClickNoCombo - base.perClickNoCombo;

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
          gainMain: after - before,
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
    <div className="space-y-4">
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
