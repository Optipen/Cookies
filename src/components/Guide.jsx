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
          className="mt-2.5 sm:mt-3 mx-auto w-full max-w-sm rounded-[20px] border border-honey/25 bg-gradient-to-br from-honey/[0.10] to-honey/[0.02] px-3.5 py-3 text-left"
        >
          <div className="flex items-start gap-2.5">
            {/* La pastille: elle rend le bloc identifiable comme « quelqu'un qui
                te parle » plutôt que comme un panneau d'information de plus. */}
            <span
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-honey/35 bg-honey/15 text-honey-light"
              aria-hidden="true"
            >
              <Icon name={conseil.phase === "decouverte" ? "flame" : "target"} size={16} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[8.5px] font-semibold uppercase tracking-[0.16em] text-honey-deep">
                  {conseil.phase === "decouverte" ? `Étape ${conseil.index} sur ${conseil.total}` : "Ton objectif"}
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

              <h3 className="mt-0.5 text-[13px] font-extrabold leading-tight text-cream-bright">{conseil.titre}</h3>
              <p className="mt-1 text-[11px] leading-snug text-cream/65">{conseil.pourquoi}</p>
            </div>
          </div>

          {/* Où aller, et un bouton qui y va. Dire « onglet Améliorations » à
              quelqu'un qui découvre l'écran ne suffit pas: on l'y emmène. */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] text-cream/45">
              <Icon name="arrowRight" size={11} className="shrink-0 text-honey/70" />
              <span className="truncate">{conseil.ou}</span>
            </span>
            {conseil.onglet && (
              <button
                type="button"
                onClick={() => onAller(conseil.onglet)}
                className="btn-honey min-h-11 shrink-0 rounded-xl px-3.5 text-[11px]"
              >
                J&apos;y vais
              </button>
            )}
          </div>

          {/* La barre n'apparaît que quand elle raconte quelque chose: sur un
              objectif en un seul geste, « 0/1 » n'apprend rien à personne. */}
          {conseil.but > 1 && (
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-[9.5px] tabular-nums text-cream/40">
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
