import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "./Icon.jsx";
import { fmt } from "../utils/format.js";

/**
 * Le compagnon qui explique le jeu, puis qui donne un cap.
 *
 * Il occupe la place qu'occupait « Prochain objectif », juste sous le cookie:
 * c'est là que le regard est déjà posé, et ça ne pousse pas la boutique plus
 * bas d'un pixel.
 *
 * Trois lignes, toujours les mêmes, et dans cet ordre — c'est ce qui permet de
 * le lire d'un coup d'œil au bout de la troisième fois:
 *
 *     QUOI FAIRE           en gras, un seul geste
 *     pourquoi ça vaut     une phrase, une promesse concrète
 *     où · [j'y vais]      l'endroit exact, et un bouton qui y emmène
 *
 * Pendant la découverte il porte un compteur d'étapes (3/7): savoir qu'il y a
 * une fin, et qu'elle est proche, change complètement la façon dont on le lit.
 */
const Guide = memo(function Guide({ conseil, onAller, onMasquer, reducedMotion }) {
  return (
    <AnimatePresence mode="wait">
      {conseil && (
        <motion.aside
          key={conseil.cle}
          data-testid="guide"
          aria-live="polite"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={reducedMotion ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 26 }}
          // Bordure franche et halo: la carte doit ATTIRER L'ŒIL, pas se fondre
          // dans le décor. C'est le premier endroit où un joueur qui découvre
          // doit regarder, et il ne le sait pas encore.
          className="mt-2.5 sm:mt-3 mx-auto w-full max-w-sm rounded-[20px] border-2 border-honey/45 bg-gradient-to-br from-honey/[0.16] to-honey/[0.04] px-4 py-3.5 text-left shadow-glow"
        >
          <div className="flex items-start gap-2.5">
            {/* La pastille: elle rend le bloc identifiable comme « quelqu'un qui
                te parle » plutôt que comme un panneau d'information de plus. */}
            <span
              className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-honey-light to-honey-deep text-honey-dark shadow-glow ${
                reducedMotion ? "" : "animate-pulse-slow"
              }`}
              aria-hidden="true"
            >
              <Icon name={conseil.phase === "decouverte" ? "flame" : "target"} size={18} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-honey">
                  {conseil.phase === "decouverte" ? `À faire · ${conseil.index}/${conseil.total}` : "Ton objectif"}
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

              {/* Plus gros que tout le reste de l'écran, et c'est voulu: la
                  consigne était écrite dans le même corps que les libellés
                  décoratifs, elle ne sautait aux yeux de personne. */}
              <h3 className="mt-0.5 text-[16px] font-extrabold leading-tight text-cream-bright">{conseil.titre}</h3>
              <p className="mt-1.5 text-[12.5px] leading-snug text-cream/80">{conseil.pourquoi}</p>
            </div>
          </div>

          {/* Où aller, et un bouton qui y va. Dire « onglet Améliorations » à
              quelqu'un qui découvre l'écran ne suffit pas: on l'y emmène. */}
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

          {/* La récompense, annoncée AVANT l'effort. Un guide qui ne promet
              rien n'est qu'une liste de corvées. */}
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
        </motion.aside>
      )}
    </AnimatePresence>
  );
});

export default Guide;
