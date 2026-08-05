import React, { memo } from "react";

// === Icônes ===
//
// La refonte « Miel & Braise » remplace tous les emoji de l'interface par des
// icônes SVG fines. Un emoji est rendu par la police du système: il change de
// dessin, de couleur et de chasse d'un appareil à l'autre, il ne prend pas la
// couleur du texte, et sur fond noir la plupart deviennent des taches criardes.
//
// Le catalogue du jeu (bâtiments, quêtes, nœuds de prestige, machines) garde
// SES emoji en donnée: ce sont des identifiants lisibles, et les tests s'y
// appuient. La traduction se fait ici, au rendu, par `ICON_BY_EMOJI`. Un emoji
// non traduit s'affiche tel quel — le jeu ne perd jamais un pictogramme.
//
// Tout est dessiné dans une grille 24×24, au trait de 1,7, comme la maquette.

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Glyphes remplis: masse pleine, jamais de contour. */
const FILLED = new Set(["flame", "star", "spark", "bolt", "coin", "burst", "cookie"]);

const GLYPHS = {
  // --- Navigation ---------------------------------------------------------
  menu: <path d="M4 7h16M4 12h10M4 17h16" />,
  bag: (
    <>
      <path d="M6.5 8h11l-1 11.5h-9L6.5 8Z" />
      <path d="M9.5 8V6.5a2.5 2.5 0 0 1 5 0V8" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  scroll: (
    <>
      <path d="M7.5 4h9A2.5 2.5 0 0 1 19 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5v-11A2.5 2.5 0 0 1 7.5 4Z" />
      <path d="M9 9h6M9 13h6M9 17h3.5" />
    </>
  ),
  user: (
    <>
      <path d="M12 4.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8Z" />
      <path d="M5.5 19.5c1.4-3.2 3.8-4.8 6.5-4.8s5.1 1.6 6.5 4.8" />
    </>
  ),
  gear: (
    <>
      <path d="M12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z" />
      <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-1.9-3.3-2 .8a7.7 7.7 0 0 0-2.6-1.5L14.3 3h-3.8l-.3 2.2a7.7 7.7 0 0 0-2.6 1.5l-2-.8-1.9 3.3 1.7 1.3a7.7 7.7 0 0 0 0 3l-1.7 1.3 1.9 3.3 2-.8a7.7 7.7 0 0 0 2.6 1.5l.3 2.2h3.8l.3-2.2a7.7 7.7 0 0 0 2.6-1.5l2 .8 1.9-3.3-1.7-1.3Z" />
    </>
  ),

  // --- Les trois monnaies du jeu ------------------------------------------
  coin: (
    <>
      <circle cx="12" cy="12" r="9" opacity=".25" />
      <circle cx="12" cy="12" r="6" />
    </>
  ),
  crmb: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.5a3.6 3.6 0 1 0 0 5" />
    </>
  ),
  spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />,
  star: <path d="M12 3l2.7 6 6.3.7-4.7 4.2 1.3 6.1L12 16.9 6.4 20l1.3-6.1L3 9.7 9.3 9 12 3Z" />,

  // --- Les deux axes: cliquer, miner --------------------------------------
  cursor: <path d="M6 4l12 6.5-5.2 1.4L10.5 19 6 4Z" />,
  pickaxe: (
    <>
      <path d="M13.5 10.5 5 19" />
      <path d="M8 5.5c4-2.5 9-1.5 11.5 2.5" />
      <path d="M13.5 10.5 18 6" />
    </>
  ),
  flame: <path d="M12 3c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 .9-3.6 2-5 .3 1.2 1 2 2 2.5-.5-2.5 0-4.5 1-6.5Z" />,
  bolt: <path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2Z" />,
  cookie: (
    <>
      <path d="M12 3.2a8.8 8.8 0 1 0 8.8 8.8c-2 .4-3.4-.6-3.7-2.3-2 .3-3.3-.8-3.4-2.6-1.6.2-2.4-1.2-1.7-3.9Z" />
      <circle cx="9.2" cy="13.6" r="1.15" fill="#0b0804" stroke="none" />
      <circle cx="13.6" cy="15.4" r="1" fill="#0b0804" stroke="none" />
      <circle cx="12.6" cy="10.6" r=".85" fill="#0b0804" stroke="none" />
    </>
  ),

  // --- Bâtiments: Cliqueurs -----------------------------------------------
  mouse: (
    <>
      <path d="M12 3.5a5 5 0 0 1 5 5v6a5 5 0 0 1-10 0v-6a5 5 0 0 1 5-5Z" />
      <path d="M12 7.5v3" />
    </>
  ),
  grandma: (
    <>
      <circle cx="12" cy="7.5" r="3" />
      <path d="M6 20c.8-4 2.8-6 6-6s5.2 2 6 6" />
      <path d="M4.5 11.5c1.5 1 3 1.2 4.5.7M19.5 11.5c-1.5 1-3 1.2-4.5.7" />
    </>
  ),
  hand: (
    <>
      <path d="M8.5 12.5V7a1.4 1.4 0 0 1 2.8 0v4.2" />
      <path d="M11.3 11.2V6a1.4 1.4 0 0 1 2.8 0v5" />
      <path d="M14.1 11.4V8a1.4 1.4 0 0 1 2.8 0v6a6 6 0 0 1-6 6 5 5 0 0 1-5-5v-4.3a1.4 1.4 0 0 1 2.6-.7" />
    </>
  ),
  arm: (
    <>
      <path d="M4.5 20h6" />
      <path d="M5.5 20v-3.5a4 4 0 0 1 4-4h1.8" />
      <path d="M11.3 12.5 15 8.8" />
      <path d="M16.6 3.9 20 7.3l-2.9 2.9-3.4-3.4L16.6 4Z" />
    </>
  ),
  hourglass: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M7 3c0 4 5 5.5 5 9s-5 5-5 9M17 3c0 4-5 5.5-5 9s5 5 5 9" />
    </>
  ),
  spiral: <path d="M12 20.5a8.5 8.5 0 1 0-8.5-8.5 6.2 6.2 0 0 0 12.4 0 4 4 0 1 0-8 0 1.9 1.9 0 0 0 3.8 0" />,
  brain: (
    <>
      <path d="M11 4.5A3 3 0 0 0 6.6 7a3 3 0 0 0-1.1 5.6v3A3.6 3.6 0 0 0 11 18.4Z" />
      <path d="M13 4.5A3 3 0 0 1 17.4 7a3 3 0 0 1 1.1 5.6v3A3.6 3.6 0 0 1 13 18.4Z" />
      <path d="M12 4.5v15" />
    </>
  ),
  comet: (
    <>
      <path d="M17 3.5a3.9 3.9 0 1 1-3.6 5.4" />
      <path d="M13.4 8.9 4 20M7 12.5l-2.5 2M10.5 15l-2.5 2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.6 12h16.8" />
      <path d="M12 3.5a13.5 13.5 0 0 1 0 17 13.5 13.5 0 0 1 0-17Z" />
    </>
  ),

  // --- Bâtiments: Mineurs --------------------------------------------------
  oven: (
    <>
      <path d="M4 13c0-4 3.5-7 8-7s8 3 8 7c0 2.5-1.5 4.5-4 4.5H8c-2.5 0-4-2-4-4.5Z" />
      <path d="M8.5 10.8c1-.8 2.1-1.2 3.5-1.2" />
      <path d="M5.5 20.5h13" />
    </>
  ),
  wheat: (
    <>
      <path d="M12 20.5V8.5" />
      <path d="M12 8.5c-1.8-.6-2.9-2.2-2.9-4 1.8.6 2.9 2.2 2.9 4ZM12 8.5c1.8-.6 2.9-2.2 2.9-4-1.8.6-2.9 2.2-2.9 4Z" />
      <path d="M12 14c-1.8-.6-2.9-2.2-2.9-4 1.8.6 2.9 2.2 2.9 4ZM12 14c1.8-.6 2.9-2.2 2.9-4-1.8.6-2.9 2.2-2.9 4Z" />
    </>
  ),
  factory: (
    <>
      <path d="M3.5 20.5V11l5.5 3.2V11l5.5 3.2V8l5.5 3.4v9.1H3.5Z" />
      <path d="M7 17.5h1.5M12 17.5h1.5M17 17.5h1.5" />
    </>
  ),
  bank: (
    <>
      <path d="M3.5 10 12 4.5l8.5 5.5" />
      <path d="M6.5 10.5v7M10.2 10.5v7M13.8 10.5v7M17.5 10.5v7" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  temple: (
    <>
      <path d="M3.5 12.5h17L12 6.5 3.5 12.5Z" />
      <path d="M6 12.5v8M10 12.5v8M14 12.5v8M18 12.5v8" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  flask: (
    <>
      <path d="M10 3.5v5.8L5.4 17.9A2 2 0 0 0 7.1 21h9.8a2 2 0 0 0 1.7-3.1L14 9.3V3.5" />
      <path d="M9 3.5h6M8.4 14.5h7.2" />
    </>
  ),
  satellite: (
    <>
      <path d="M15.6 3.4 20.6 8.4l-3 3-5-5 3-3Z" />
      <path d="M8.4 8.4l7.2 7.2-3 3-7.2-7.2 3-3Z" />
      <path d="M8.4 15.6 3.4 20.6" />
      <path d="M15.5 18.5a4.5 4.5 0 0 0 3-3" />
    </>
  ),
  burst: <path d="M12 2.2l2.1 5.4 5-2.6-2.6 5 5.4 2.1-5.4 2.1 2.6 5-5-2.6-2.1 5.4-2.1-5.4-5 2.6 2.6-5L2.2 12.1l5.4-2.1-2.6-5 5 2.6L12 2.2Z" />,

  // --- Marché, machines ----------------------------------------------------
  laptop: (
    <>
      <path d="M5 6.5h14v9H5z" />
      <path d="M2.8 19h18.4" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7.6 7.5h8.8a4.5 4.5 0 0 1 4.4 5.4l-.6 3a3 3 0 0 1-5.1 1.5l-1.1-1.1H10l-1.1 1.1a3 3 0 0 1-5.1-1.5l-.6-3A4.5 4.5 0 0 1 7.6 7.5Z" />
      <path d="M7.5 11v2.4M6.3 12.2h2.4" />
      <path d="M15.6 11.4h.01M17.4 13.2h.01" />
    </>
  ),
  cpu: (
    <>
      <path d="M6.5 6.5h11v11h-11z" />
      <path d="M9.5 9.5h5v5h-5z" />
      <path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" />
    </>
  ),
  crane: (
    <>
      <path d="M4.5 20.5h15" />
      <path d="M6.5 20.5V4.5l12 3.6" />
      <path d="M6.5 8.3 15 10.9M12 10v3.5" />
      <path d="M10 20.5v-5h4v5" />
    </>
  ),
  atom: (
    <>
      <circle cx="12" cy="12" r="1.9" />
      <path d="M12 5.6c4.6 0 8.4 2.9 8.4 6.4s-3.8 6.4-8.4 6.4-8.4-2.9-8.4-6.4S7.4 5.6 12 5.6Z" />
      <path d="M12 5.6c4.6 0 8.4 2.9 8.4 6.4s-3.8 6.4-8.4 6.4-8.4-2.9-8.4-6.4S7.4 5.6 12 5.6Z" transform="rotate(60 12 12)" />
      <path d="M12 5.6c4.6 0 8.4 2.9 8.4 6.4s-3.8 6.4-8.4 6.4-8.4-2.9-8.4-6.4S7.4 5.6 12 5.6Z" transform="rotate(120 12 12)" />
    </>
  ),
  whale: (
    <>
      <path d="M3.5 13.5c2.2 3.3 5.3 5 8.5 5s6.3-1.7 8.5-5" />
      <path d="M7 11V6.8l2.8 2.4" />
      <path d="M12.5 9.4c1.6 0 3.1.8 4.2 2.1" />
    </>
  ),
  trendUp: (
    <>
      <path d="M3.5 17.5 9 12l3.2 3.2L20 7.5" />
      <path d="M14.8 7.5H20v5.2" />
    </>
  ),
  bars: <path d="M5 19.5V12M10 19.5V5.5M15 19.5v-5M20 19.5V9" />,

  // --- Objectifs, quêtes ---------------------------------------------------
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  cart: (
    <>
      <path d="M3.5 4.5h2.2l2.4 10.2h9.1l1.9-7.2H7" />
      <circle cx="9.5" cy="18.6" r="1.5" />
      <circle cx="16.8" cy="18.6" r="1.5" />
    </>
  ),
  box: (
    <>
      <path d="M12 3.2 4 7.1v9.8l8 3.9 8-3.9V7.1l-8-3.9Z" />
      <path d="M4 7.1l8 3.9 8-3.9M12 11v9.8" />
    </>
  ),
  puzzle: (
    <>
      <path d="M9.6 4.5h4.8v2.2a1.7 1.7 0 1 1 0 3.4v2.2H9.6v-2.2a1.7 1.7 0 1 0 0-3.4V4.5Z" />
      <path d="M9.6 12.3v2.2a1.7 1.7 0 1 0 0 3.4v1.6h4.8v-7.2" />
    </>
  ),
  calendar: (
    <>
      <path d="M6.5 5.5h11A2 2 0 0 1 19.5 7.5v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
      <path d="M8.5 3.5v4M15.5 3.5v4M4.5 10.5h15" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.5 0 2.2-.9 2.2-1.9 0-1.7 1.3-2.4 2.6-2.4h1.1a3 3 0 0 0 3-3c0-5.3-4.1-9.7-8.9-9.7Z" />
      <circle cx="8.6" cy="10.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="9.6" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  zen: (
    <>
      <circle cx="12" cy="5.4" r="2" />
      <path d="M4 12.5 8 15h8l4-2.5" />
      <path d="M8.4 15 6.8 20.5M15.6 15l1.6 5.5" />
    </>
  ),
  cloud: <path d="M7.5 18.5h9.2a3.8 3.8 0 0 0 .5-7.6 5.3 5.3 0 0 0-10.2-1A3.8 3.8 0 0 0 7.5 18.5Z" />,
  brick: (
    <>
      <path d="M3.5 7h17v10h-17z" />
      <path d="M3.5 12h17M9 7v5M15 12v5" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 3c3.2 2.4 4.8 5.6 4.8 9.4L14.4 16H9.6l-2.4-3.6C7.2 8.6 8.8 5.4 12 3Z" />
      <path d="M9.6 16 8 20l3-1.6h2l3 1.6-1.6-4" />
      <circle cx="12" cy="10" r="1.6" />
    </>
  ),
  sunrise: (
    <>
      <path d="M6.5 16.5a5.5 5.5 0 0 1 11 0" />
      <path d="M3 20.5h18M12 3v3M5 6l2 2M19 6l-2 2M2.5 12.5h2M19.5 12.5h2" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 17.5c1.2-1.3 1.4-2.6 1.4-4.6 0-3 .8-6 4.1-6s4.1 3 4.1 6c0 2 .2 3.3 1.4 4.6H6.5Z" />
      <path d="M10.4 20.2a2 2 0 0 0 3.2 0" />
    </>
  ),
  moon: <path d="M20.2 14.6A8.6 8.6 0 1 1 9.4 3.8a7 7 0 0 0 10.8 10.8Z" />,
  robot: (
    <>
      <path d="M6.5 8h11A2.5 2.5 0 0 1 20 10.5v6A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-6A2.5 2.5 0 0 1 6.5 8Z" />
      <path d="M12 4.5V8" />
      <circle cx="9.3" cy="12.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="12.8" r="1" fill="currentColor" stroke="none" />
      <path d="M9.8 16h4.4" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 13.6a4.4 4.4 0 0 0 7 0" />
      <circle cx="9.4" cy="9.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="9.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),

  // --- Interface ------------------------------------------------------------
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 2.1" />
    </>
  ),
  lock: (
    <>
      <path d="M8.5 10.5h7A2.5 2.5 0 0 1 18 13v4.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 17.5V13a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  arrowRight: <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4.5v4.2h-4.2" />
    </>
  ),
  tag: (
    <>
      <path d="M11.4 3.5H5.5a2 2 0 0 0-2 2v5.9l9.1 9.1 8-8-9.2-9Z" />
      <circle cx="8.2" cy="8.2" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  soundOn: (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" />
      <path d="M15.6 9.6a3.8 3.8 0 0 1 0 4.8M18.2 7.4a7.2 7.2 0 0 1 0 9.2" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" />
      <path d="M16 10l4.5 4.5M20.5 10 16 14.5" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
    </>
  ),
  wind: <path d="M3.5 8.5h9.3a2.6 2.6 0 1 0-2.6-2.6M3.5 12.5h13a2.6 2.6 0 1 1-2.6 2.6M3.5 16.5h7.8" />,
  download: (
    <>
      <path d="M12 4v10.5M8 11l4 4 4-4" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  upload: (
    <>
      <path d="M12 20V9.5M8 13l4-4 4 4" />
      <path d="M4.5 4.5h15" />
    </>
  ),
  check: <path d="M5 12.5 9.5 17 19 7" />,
};

/**
 * Traduction emoji → glyphe.
 *
 * Le catalogue du jeu continue d'écrire des emoji: ils sont lisibles en
 * diff, ils survivent aux copier-coller, et rien ne casse si cette table
 * oublie quelqu'un — l'emoji s'affiche alors tel quel.
 */
export const ICON_BY_EMOJI = {
  // Navigation et monnaies
  "🛍️": "bag",
  "⬆️": "arrowUp",
  "📜": "scroll",
  "🪙": "coin",
  "✨": "spark",
  "🌟": "spark",
  "✦": "spark",
  "🔮": "spark",
  "⭐": "star",
  "👤": "user",
  "⚙️": "gear",
  "🍪": "cookie",

  // Les deux axes
  "👆": "cursor",
  "🖱️": "mouse",
  "⛏️": "pickaxe",
  "🔥": "flame",
  "⚡": "bolt",
  "💨": "bolt",
  "🏃": "bolt",

  // Cliqueurs
  "👵": "grandma",
  "🧤": "hand",
  "🖐️": "hand",
  "🫱": "hand",
  "🦾": "arm",
  "🦿": "arm",
  "🤖": "robot",
  "⌛": "hourglass",
  "🌌": "spiral",
  "🧠": "brain",
  "☄️": "comet",
  "🌍": "globe",

  // Mineurs
  "🥖": "oven",
  "🌾": "wheat",
  "🏭": "factory",
  "🏦": "bank",
  "💰": "bank",
  "⛩️": "temple",
  "🧪": "flask",
  "🌀": "spiral",
  "🛰️": "satellite",
  "🛸": "satellite",
  "🌠": "comet",
  "💥": "burst",

  // Marché et machines
  "💻": "laptop",
  "🎮": "gamepad",
  "🖥️": "cpu",
  "🏗️": "crane",
  "⚛️": "atom",
  "📈": "trendUp",
  "📊": "bars",
  "🐋": "whale",

  // Quêtes
  "🎯": "target",
  "🛒": "cart",
  "📦": "box",
  "🧩": "puzzle",
  "🧘": "zen",
  "🎨": "palette",
  "📅": "calendar",
  "🔒": "lock",
  "😋": "smile",

  // Arbre céleste et Voûte
  "☁️": "cloud",
  "🧱": "brick",
  "🚀": "rocket",
  "🌙": "moon",
  "🌅": "sunrise",
  "🔔": "bell",

  // Réglages
  "🔊": "soundOn",
  "🔈": "soundOff",
  "🟨": "contrast",
  "⬜": "contrast",
  "🐢": "wind",
  "💾": "download",
  "📥": "upload",
  "♻️": "refresh",
  "↻": "refresh",
  "🏷️": "tag",
  "⏱": "clock",
  "✓": "check",
};

/**
 * Une icône.
 *
 * `name` désigne un glyphe directement, `emoji` le fait traduire. La couleur
 * vient toujours du texte (`currentColor`): une icône se colore comme la
 * phrase qui l'entoure, jamais autrement.
 *
 * Purement décorative par défaut (`aria-hidden`): le sens est porté par le
 * texte à côté, ou par le `aria-label` du bouton qui la contient. Quand une
 * icône est SEULE à porter le sens, on passe `title`, qui la rend annoncée.
 */
function Icon({ name, emoji, size = 16, className = "", strokeWidth = 1.7, title }) {
  const key = name || ICON_BY_EMOJI[emoji];
  const glyph = key ? GLYPHS[key] : null;

  // Filet: un pictogramme non traduit vaut mieux qu'un trou dans la phrase.
  if (!glyph) {
    return (
      <span className={className} aria-hidden={title ? undefined : "true"}>
        {emoji ?? null}
      </span>
    );
  }

  const filled = FILLED.has(key);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
      {...(filled ? { fill: "currentColor", stroke: "none" } : { ...STROKE, strokeWidth })}
    >
      {title && <title>{title}</title>}
      {glyph}
    </svg>
  );
}

export default memo(Icon);
