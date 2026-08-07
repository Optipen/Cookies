import React, { memo, useMemo } from "react";
import Icon from "./Icon.jsx";
import { fmt, fmtCrmb } from "../utils/format.js";
import { classement, positionDuJoueur, RIVAUX } from "../data/rivaux.js";

/**
 * Le Classement.
 *
 * Ce qu'il répond, et c'est la seule question à laquelle le jeu ne répondait
 * pas: **à quoi ça sert de cliquer ?** Un multiplicateur affiché en haut de
 * l'écran est une information; quelqu'un devant soi est une raison.
 *
 * Les sept rivaux ne diffèrent QUE par leur cadence de clic — même catalogue,
 * mêmes prix, même façon d'acheter. Monter d'une place, c'est donc littéralement
 * appuyer plus qu'eux, et le classement est la traduction directe de l'effort.
 *
 * Ils ne sont pas des joueurs en ligne, et l'écran le dit. Un classement
 * alimenté par le navigateur du joueur — c'est-à-dire par une sauvegarde qu'on
 * peut réécrire en dix secondes dans la console — n'est pas un classement:
 * c'est un champ de texte. Le jeu préfère annoncer sept adversaires honnêtes
 * plutôt que d'en simuler mille faux.
 */

const RANG_STYLE = {
  1: "border-honey/60 bg-honey/15 text-honey",
  2: "border-cream/35 bg-cream/10 text-cream",
  3: "border-lava/40 bg-lava/10 text-lava",
};

const ordinal = (n) => (n === 1 ? "1ᵉʳ" : `${n}ᵉ`);

const Ligne = memo(function Ligne({ l, total }) {
  const style = RANG_STYLE[l.rang] || "border-honey/10 bg-honey-light/[0.03] text-cream/50";
  return (
    <li
      data-testid={l.moi ? "classement-moi" : `classement-${l.id}`}
      className={`flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 ${
        l.moi ? "border-honey/50 bg-gradient-to-r from-honey/20 to-honey/[0.04]" : "border-honey/10 bg-honey-light/[0.03]"
      }`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl border text-[11px] font-extrabold tabular-nums ${style}`}
      >
        {l.rang}
      </span>
      <Icon name={l.icone} size={16} className={l.moi ? "shrink-0 text-honey" : "shrink-0 text-cream/40"} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[12.5px] font-bold leading-tight ${l.moi ? "text-cream-bright" : "text-cream/85"}`}>
          {l.nom}
          {l.battu && !l.moi && (
            <span className="ml-1.5 align-middle text-mint" title="Rival déjà dépassé">
              <Icon name="check" size={11} />
            </span>
          )}
        </span>
        <span className="block truncate text-[10px] leading-tight text-cream/40">
          {l.moi ? `${ordinal(l.rang)} sur ${total}` : l.phrase}
        </span>
      </span>
      <span className={`shrink-0 text-right text-[12px] font-extrabold tabular-nums ${l.moi ? "text-honey" : "text-cream/55"}`}>
        {fmt(l.score)}
      </span>
    </li>
  );
});

/**
 * Le ruban: une ligne, sous le cookie.
 *
 * Il ne dit que ce qui bouge pendant qu'on joue — la place, le nom de celui
 * qui est juste devant, et la fraction déjà comblée. Tout le reste est dans
 * l'onglet Profil, à un appui de là.
 */
export const RubanClassement = memo(function RubanClassement({ state, onOuvrir }) {
  const p = useMemo(() => positionDuJoueur(state), [state]);
  if (!p) return null;

  const premier = !p.devant;
  const pct = Math.round((p.part || 0) * 100);

  return (
    <button
      type="button"
      onClick={onOuvrir}
      data-testid="ruban-classement"
      data-rang={p.rang}
      className="mt-2 mx-auto flex min-h-11 w-full max-w-sm items-center gap-2.5 rounded-2xl border border-honey/25 bg-honey-light/[0.05] px-2.5 py-1.5 text-left transition-colors hover:bg-honey/10"
    >
      <span
        className={`grid h-7 w-9 shrink-0 place-items-center rounded-xl border text-[11px] font-extrabold tabular-nums ${
          RANG_STYLE[p.rang] || "border-honey/25 bg-honey/10 text-honey"
        }`}
      >
        {ordinal(p.rang)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-bold leading-tight text-cream">
          {premier ? "Personne devant toi" : `${p.devant.nom} est devant`}
        </span>
        {!premier && (
          <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-honey-light/10">
            <span
              className="block h-full rounded-full bg-honey/70 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </span>
      {!premier && (
        <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-honey" data-testid="ruban-part">
          {pct} %
        </span>
      )}
      <Icon name="arrowRight" size={13} className="shrink-0 text-honey/50" />
    </button>
  );
});

/** Le panneau complet, dans l'onglet Profil. */
const Classement = memo(function Classement({ state }) {
  const lignes = useMemo(() => classement(state), [state]);
  const battus = RIVAUX.filter((r) => state?.classement?.battus?.[r.id]).length;
  const moi = lignes.find((l) => l.moi);

  return (
    <section aria-labelledby="classement-titre" data-testid="panneau-classement">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="classement-titre" className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-cream/70">
          Classement
        </h3>
        <span className="text-[11px] font-semibold tabular-nums text-cream/45">
          {battus} / {RIVAUX.length} dépassés
        </span>
      </div>

      <p className="mt-1 text-[11px] leading-snug text-cream/50">
        Chaque rival joue la même partie que toi, avec la même boutique et les mêmes prix. La seule chose qui les
        sépare, c&apos;est la cadence de clic — les dépasser, c&apos;est appuyer plus qu&apos;eux.
      </p>

      <ul className="mt-2.5 space-y-1.5">
        {lignes.map((l) => (
          <Ligne key={l.id} l={l} total={lignes.length} />
        ))}
      </ul>

      {moi && (
        <p className="mt-2 text-[11px] font-semibold tabular-nums text-cream/45">
          Cookies cuits depuis ta toute première partie : <span className="text-honey">{fmt(moi.score)}</span>
        </p>
      )}

      <p className="mt-2 rounded-2xl border border-honey/10 bg-honey-light/[0.03] px-3 py-2 text-[10.5px] leading-snug text-cream/40">
        Ces sept adversaires ne sont pas des joueurs en ligne : ce sont sept parties réelles, jouées par le simulateur
        du jeu à sept cadences différentes, et rejouées au fil de ton temps de jeu. Crumbora n&apos;envoie rien nulle
        part — un classement rempli par le navigateur de chacun se truque en dix secondes, et n&apos;aurait rien classé
        du tout.
      </p>

      <p className="mt-1.5 text-[10.5px] leading-snug text-cream/40">
        Chaque premier dépassement rapporte une minute de production et du CrumbCoin (de{" "}
        {fmtCrmb(RIVAUX[0].crmb)} à {fmtCrmb(RIVAUX[RIVAUX.length - 1].crmb)}).
      </p>
    </section>
  );
});

export default Classement;
