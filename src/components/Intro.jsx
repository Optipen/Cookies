import React, { memo, useEffect } from "react";
import { motion } from "framer-motion";
import Icon from "./Icon.jsx";

/**
 * Écran d'accueil.
 *
 * L'ancienne version était un overlay monté par-dessus le jeu, avec un tutoriel
 * en 4 étapes piloté par 5 effets qui surveillaient clics, achats et onglets.
 * Le jeu tournait déjà derrière (production, quêtes, sauvegarde) alors que le
 * joueur n'avait rien commencé. Ici c'est un écran distinct: rien ne démarre
 * tant qu'on n'a pas cliqué « Commencer ».
 *
 * Mise en scène « Miel & Braise »: le cookie est la seule source de lumière de
 * la pièce. Il éclaire par le haut, le noir reprend vers le bas, et le texte
 * s'installe dans cette pénombre — jamais par-dessus la pleine lumière.
 */
// Décor figé au chargement du module: identique à chaque affichage de l'écran
// et surtout calculé hors du rendu, qui doit rester pur.
const FLOATING_CRUMBS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  top: Math.random() * 100,
  left: Math.random() * 100,
  size: 2 + Math.random() * 4,
  delay: Math.random() * 4,
  duration: 9 + Math.random() * 8,
}));

const FEATURES = [
  // Seize dès la première partie: les huit rangs d'Ascension ne se
  // promettent pas à quelqu'un qui n'a pas encore cliqué une fois.
  { icon: "bag", label: "16 bâtiments", tone: "text-honey" },
  { icon: "scroll", label: "Quêtes & quotidiennes", tone: "text-honey" },
  { icon: "crmb", label: "Marché crypto", tone: "text-crmb" },
  { icon: "spark", label: "Arbre céleste", tone: "text-honey" },
];

function Intro({ onStart, soundsOn, onToggleSound }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  return (
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-ink">
      {/* --- La lumière du four, au-dessus de l'écran --- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-22vh] h-[70vh] w-[130vw] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(245,185,66,.3), rgba(232,139,26,.09) 46%, transparent 70%)",
        }}
      />

      {/* --- Le cookie, en trophée --- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[4vh] grid place-items-center">
        <div className="relative grid place-items-center">
          <div className="absolute h-[min(74vw,20rem)] w-[min(74vw,20rem)] rounded-full border border-dashed border-honey/25" />
          <motion.img
            src="/cookie.png"
            alt=""
            draggable="false"
            initial={{ scale: 0.82, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 90, damping: 16 }}
            className="h-[min(64vw,17rem)] w-[min(64vw,17rem)] object-contain animate-float"
            style={{ filter: "drop-shadow(0 30px 50px rgba(0,0,0,.7)) drop-shadow(0 0 40px rgba(232,139,26,.4))" }}
          />
        </div>
      </div>

      {/* --- Poussière de miettes en suspension --- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {FLOATING_CRUMBS.map((c) => (
          <motion.span
            key={c.id}
            className="absolute rounded-full bg-honey-light"
            style={{ top: `${c.top}%`, left: `${c.left}%`, width: c.size, height: c.size }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: ["0%", "-1400%", "0%"], opacity: [0.05, 0.5, 0.05] }}
            transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* --- Le voile qui rend le texte lisible --- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,8,4,.15) 0%, rgba(11,8,4,.05) 26%, rgba(11,8,4,.72) 56%, rgba(11,8,4,.97) 78%)",
        }}
      />

      {/* --- Le contenu --- */}
      <div className="relative h-full w-full flex flex-col items-center justify-end text-center px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] overflow-y-auto">
        <motion.h1
          initial={{ y: 22, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 120, damping: 16 }}
          className="font-display text-[2.75rem] sm:text-6xl md:text-7xl leading-none tracking-wide text-cream-bright"
          style={{ textShadow: "0 4px 40px rgba(232,139,26,.45)" }}
        >
          CRUMBORA
        </motion.h1>

        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="mt-3.5 max-w-sm text-[0.8125rem] leading-relaxed text-cream/70"
        >
          Clique, bâtis ton empire du biscuit, accomplis des quêtes et fais fructifier ton{" "}
          <b className="text-crmb">CrumbCoin</b>.
        </motion.p>

        <motion.ul
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.26 }}
          className="mt-5 grid w-full max-w-sm grid-cols-2 gap-2"
        >
          {FEATURES.map((f) => (
            <li
              key={f.label}
              className="flex items-center gap-2 rounded-2xl border border-honey/20 bg-cream-bright/[0.06] px-2.5 py-2.5 text-left text-[0.6875rem] font-semibold text-cream/80 backdrop-blur-sm"
            >
              <Icon name={f.icon} size={15} className={f.tone} />
              {f.label}
            </li>
          ))}
        </motion.ul>

        <motion.button
          type="button"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.34 }}
          onClick={onStart}
          autoFocus
          className="mt-6 flex w-full max-w-sm items-center gap-3 rounded-full border border-honey/25 bg-cream-bright/[0.07] p-2 backdrop-blur-md transition-colors hover:bg-cream-bright/[0.12] focus:outline-none focus-visible:ring-4 focus-visible:ring-honey/50"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-honey-light to-honey-deep text-honey-dark shadow-glow">
            <Icon name="arrowRight" size={20} strokeWidth={2} />
          </span>
          <span className="flex-1 text-left text-[0.875rem] font-bold text-cream-bright">Commencer à cuire</span>
          <Icon name="arrowRight" size={16} className="mr-4 text-cream/40" />
        </motion.button>

        <p className="mt-3 text-[0.625rem] text-cream/40">Entrée ou Espace pour démarrer</p>

        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundsOn}
          className="btn-ghost mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs"
        >
          <Icon name={soundsOn ? "soundOn" : "soundOff"} size={14} className="text-honey" />
          {soundsOn ? "Sons activés" : "Sons coupés"}
        </button>
      </div>
    </div>
  );
}

export default memo(Intro);
