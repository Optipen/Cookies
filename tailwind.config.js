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
    },
  },
  plugins: [],
}
