import React, { memo, useEffect, useMemo } from "react";
import { motion } from "framer-motion";

/**
 * Écran d'accueil.
 *
 * L'ancienne version était un overlay monté par-dessus le jeu, avec un tutoriel
 * en 4 étapes piloté par 5 effets qui surveillaient clics, achats et onglets.
 * Le jeu tournait déjà derrière (production, quêtes, sauvegarde) alors que le
 * joueur n'avait rien commencé. Ici c'est un écran distinct: rien ne démarre
 * tant qu'on n'a pas cliqué « Commencer ».
 */
function Intro({ onStart, soundsOn, onToggleSound }) {
  const cookies = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 20 + Math.random() * 34,
        delay: Math.random() * 4,
        duration: 9 + Math.random() * 8,
      })),
    []
  );

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-amber-900 via-stone-950 to-black">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 22% 28%, rgba(251,191,36,0.18), transparent 42%), radial-gradient(circle at 78% 72%, rgba(255,255,255,0.09), transparent 46%)",
        }}
      />

      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        {cookies.map((c) => (
          <motion.span
            key={c.id}
            className="absolute select-none"
            style={{ top: `${c.top}%`, left: `${c.left}%`, fontSize: c.size }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: ["0%", "-22%", "0%"], opacity: [0.08, 0.45, 0.08] }}
            transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          >
            🍪
          </motion.span>
        ))}
      </div>

      <div className="relative h-full w-full flex flex-col items-center justify-center text-center px-6">
        <motion.h1
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="text-5xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-300 drop-shadow-lg"
        >
          COOKIE CRAZE
        </motion.h1>

        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="mt-4 text-stone-300 max-w-md leading-relaxed"
        >
          Clique, bâtis ton empire du biscuit, accomplis des quêtes et fais fructifier ton <b className="text-cyan-300">CrumbCoin</b>.
        </motion.p>

        <motion.ul
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="mt-6 grid grid-cols-2 gap-2 text-xs text-stone-300 max-w-sm w-full"
        >
          {[
            ["🛍️", "15 bâtiments"],
            ["📜", "Quêtes & quotidiennes"],
            ["🪙", "Marché crypto"],
            ["✨", "Arbre céleste"],
          ].map(([icon, label]) => (
            <li key={label} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 backdrop-blur-sm">
              <span aria-hidden="true">{icon}</span> {label}
            </li>
          ))}
        </motion.ul>

        <motion.button
          type="button"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.38 }}
          onClick={onStart}
          autoFocus
          className="mt-8 px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-stone-900 font-black text-lg shadow-2xl hover:from-amber-300 hover:to-orange-400 hover:scale-[1.03] active:scale-100 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60"
        >
          Commencer à cuire 🍪
        </motion.button>

        <p className="mt-3 text-[11px] text-stone-500">Entrée ou Espace pour démarrer</p>

        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundsOn}
          className="mt-6 text-xs px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:bg-white/10 transition-colors"
        >
          {soundsOn ? "🔊 Sons activés" : "🔈 Sons coupés"}
        </button>
      </div>
    </div>
  );
}

export default memo(Intro);
