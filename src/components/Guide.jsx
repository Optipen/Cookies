import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "./Icon.jsx";
import { fmt } from "../utils/format.js";

/**
 * Le compagnon — et il n'a pas la même voix selon à qui il parle.
 *
 * DEUX FORMES, et c'est tout l'objet de ce fichier:
 *
 *   · DÉCOUVERTE (les sept premières étapes) — une vraie carte, large, qui
 *     explique, promet et emmène. Quelqu'un qui ouvre le jeu pour la première
 *     fois n'a aucune idée de ce qu'il regarde: à ce moment-là, prendre de la
 *     place est exactement ce qu'il faut faire.
 *
 *   · OBJECTIF (tout le reste de la vie du joueur) — UNE LIGNE. Le même bloc
 *     encombrant gardé après le tutoriel donnait un jeu qui tient la main
 *     indéfiniment: on n'apprend plus rien, on se fait juste dicter la suite,
 *     et le panneau mange la place de la boutique à chaque session.
 *
 * Le contenu ne change pas — c'est la place qu'il prend qui change. Un joueur
 * qui sait jouer veut un cap, pas un cours.
 */

/** La carte pleine: pour qui découvre. */
const CarteDecouverte = memo(function CarteDecouverte({ conseil, onAller, onMasquer, reducedMotion }) {
  return (
    <>
      <div className="flex items-start gap-2.5">
        {/* La pastille: elle rend le bloc identifiable comme « quelqu'un qui
            te parle » plutôt que comme un panneau d'information de plus. */}
        <span
          className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-honey-light to-honey-deep text-honey-dark shadow-glow ${
            reducedMotion ? "" : "animate-pulse-slow"
          }`}
          aria-hidden="true"
        >
          <Icon name="flame" size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-honey">
              À faire · {conseil.index}/{conseil.total}
            </span>
            <button
              type="button"
              onClick={onMasquer}
              aria-label="Masquer le guide"
              title="Masquer le guide"
              className="-mr-1.5 -mt-1 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl text-cream/35 transition-colors hover:bg-honey/10 hover:text-cream/70"
            >
              <Icon name="close" size={13} />
            </button>
          </div>

          {/* Plus gros que tout le reste de l'écran, et c'est voulu: la consigne
              était écrite dans le même corps que les libellés décoratifs, elle
              ne sautait aux yeux de personne. */}
          <h3 className="mt-0.5 text-[16px] font-extrabold leading-tight text-cream-bright">{conseil.titre}</h3>
          <p className="mt-1.5 text-[12.5px] leading-snug text-cream/80">{conseil.pourquoi}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px] font-semibold text-cream/60">
          <Icon name="arrowRight" size={13} className="shrink-0 text-honey" />
          <span className="truncate">{conseil.ou}</span>
        </span>
        {conseil.onglet && (
          <button
            type="button"
            onClick={() => onAller(conseil)}
            className="btn-honey min-h-11 shrink-0 rounded-xl px-4 text-[12.5px]"
          >
            Montre-moi
          </button>
        )}
      </div>

      {/* La récompense, annoncée AVANT l'effort. Un guide qui ne promet rien
          n'est qu'une liste de corvées. */}
      {conseil.recompense > 0 && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-mint/25 bg-mint/10 px-2 py-1 text-[11px] font-bold tabular-nums text-mint">
          <Icon name="coin" size={12} />+{fmt(conseil.recompense)} cookies à la clé
        </div>
      )}

      {/* La barre n'apparaît que quand elle raconte quelque chose: sur un
          objectif en un seul geste, « 0/1 » n'apprend rien à personne. */}
      {conseil.but > 1 && (
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[11px] font-semibold tabular-nums text-cream/55">
            <span>Avancement</span>
            <span>
              {fmt(conseil.fait)} / {fmt(conseil.but)}
            </span>
          </div>
          <div className="meter h-1.5">
            <div
              className="meter-fill transition-[width] duration-500"
              style={{ width: `${Math.min(100, (conseil.fait / conseil.but) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
});

/**
 * La ligne: pour qui sait jouer.
 *
 * Toute la carte tient sur une ligne tapable, et une barre d'un pixel et demi
 * sous elle quand il y a un avancement à montrer. Pas de titre de section, pas
 * de bouton, pas de promesse: le joueur connaît le jeu, il veut juste savoir
 * où il en est.
 */
const LigneObjectif = memo(function LigneObjectif({ conseil, onAller, onMasquer }) {
  const cliquable = !!conseil.onglet;
  const pct = conseil.but > 1 ? Math.min(100, (conseil.fait / conseil.but) * 100) : 0;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => cliquable && onAller(conseil)}
        disabled={!cliquable}
        className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left ${
          cliquable ? "transition-colors hover:bg-honey/10" : "cursor-default"
        }`}
      >
        <Icon name="target" size={13} className="shrink-0 text-honey" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold leading-tight text-cream">{conseil.titre}</span>
          {conseil.but > 1 && (
            <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-honey-light/10">
              <span className="block h-full rounded-full bg-honey/70 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
        {cliquable && <Icon name="arrowRight" size={13} className="shrink-0 text-honey/50" />}
      </button>
      <button
        type="button"
        onClick={onMasquer}
        aria-label="Masquer le guide"
        title="Masquer le guide"
        className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl text-cream/25 transition-colors hover:bg-honey/10 hover:text-cream/60"
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
});

const Guide = memo(function Guide({ conseil, onAller, onMasquer, reducedMotion }) {
  const decouverte = conseil?.phase === "decouverte";

  return (
    <AnimatePresence mode="wait">
      {conseil && (
        <motion.aside
          key={conseil.cle}
          data-testid="guide"
          data-phase={conseil.phase}
          aria-live="polite"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={reducedMotion ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 26 }}
          className={
            decouverte
              ? // Bordure franche et halo: la carte doit ATTIRER L'ŒIL. C'est le
                // premier endroit où un joueur qui découvre doit regarder, et il
                // ne le sait pas encore.
                "mt-2.5 sm:mt-3 mx-auto w-full max-w-sm rounded-[20px] border-2 border-honey/45 bg-gradient-to-br from-honey/[0.16] to-honey/[0.04] px-4 py-3.5 text-left shadow-glow"
              : // Discret: un liseré, pas de halo, pas de fond appuyé. Le joueur
                // sait jouer — le guide se range sans disparaître.
                "mt-2 mx-auto w-full max-w-sm rounded-2xl border border-honey/15 bg-honey-light/[0.04] px-1.5 py-0.5 text-left"
          }
        >
          {decouverte ? (
            <CarteDecouverte conseil={conseil} onAller={onAller} onMasquer={onMasquer} reducedMotion={reducedMotion} />
          ) : (
            <LigneObjectif conseil={conseil} onAller={onAller} onMasquer={onMasquer} />
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
});

export default Guide;
