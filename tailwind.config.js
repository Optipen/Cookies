/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Le plus petit écran qu'on vise réellement est l'iPhone SE, 320 px de
        // large. Entre lui et le premier palier de Tailwind (`sm`, 640 px) il y
        // a tous les téléphones ordinaires: `xs` sert à ne pas leur imposer la
        // mise en page du plus petit d'entre eux.
        xs: '360px',
      },

      // ----------------------------------------------------------------------
      // Palette « Miel & Braise »
      //
      // Fond noir chaud, verre fumé bordé d'ambre, UN SEUL accent: le miel doré.
      // Le vert menthe est réservé au minage, le turquoise au CRMB, l'orangé
      // brûlé aux urgences. Aucun violet, aucun bleu: la partie se lit à la
      // couleur — si c'est doré, ça vient du four; si c'est vert, ça tombe tout
      // seul; si c'est turquoise, c'est de la monnaie.
      // ----------------------------------------------------------------------
      colors: {
        ink: {
          DEFAULT: '#0b0804', // fond de page
          950: '#0b0804',
          900: '#0c0805', // fond des panneaux, bas de dégradé
          800: '#140e08',
          700: '#161009', // haut de dégradé des panneaux
          600: '#1d130a',
          500: '#241a0f',
        },
        honey: {
          DEFAULT: '#f5b942', // l'accent
          light: '#ffd27a',
          deep: '#e88b1a', // braise
          dark: '#2a1704', // texte POSÉ SUR le miel
        },
        cream: {
          DEFAULT: '#f6ead3', // texte courant
          bright: '#fff8ea', // grands titres
        },
        mint: {
          DEFAULT: '#7fd8a8', // minage
          deep: '#4db386',
        },
        crmb: {
          DEFAULT: '#6fd8cf', // CrumbCoin
          deep: '#3fa9a2',
        },
        lava: {
          DEFAULT: '#ff9a6b', // compte à rebours, chaleur
          deep: '#ff5c38', // refus, danger
        },
      },

      fontFamily: {
        // Sora pour toute l'interface: chiffres tabulaires nets, lisible à 9 px.
        sans: [
          'Sora',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        // Marcellus pour les grands moments: titres d'écran, renaissance, skins.
        display: ['Marcellus', 'ui-serif', 'Georgia', 'Cambria', 'serif'],
      },

      boxShadow: {
        // Le miel n'éclaire jamais par une ombre portée: il rayonne.
        glow: '0 0 30px rgba(245,185,66,.35)',
        'glow-lg': '0 10px 36px rgba(232,139,26,.45)',
        panel: '0 20px 50px rgba(0,0,0,.55)',
      },
    },
  },
  plugins: [],
}
