import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Injecte l'URL canonique du site dans `index.html`.
 *
 * `og:url` et `<link rel="canonical">` demandent une adresse ABSOLUE: on ne
 * peut pas les écrire dans le HTML source sans coder en dur un domaine qui
 * n'existe peut-être pas encore. Elles étaient donc restées en commentaire, et
 * chaque partage sur un réseau social arrivait sans adresse canonique.
 *
 * On les pose ici, depuis `VITE_SITE_URL` (à définir dans les variables
 * d'environnement Vercel). Non définie, le marqueur disparaît simplement:
 * mieux vaut pas de balise qu'une balise qui pointe vers un domaine d'exemple.
 */
const metaSite = () => ({
  name: "crumbora-meta-site",
  transformIndexHtml(html, ctx) {
    const brut = ctx?.server ? "" : process.env.VITE_SITE_URL || "";
    if (!brut) return html.replace("<!--%SITE_META%-->", "");
    const base = brut.replace(/\/+$/, "");
    return (
      html
        .replace(
          "<!--%SITE_META%-->",
          [`<link rel="canonical" href="${base}/" />`, `<meta property="og:url" content="${base}/" />`].join("\n    ")
        )
        // Les images de partage passent en ABSOLU plutôt que d'être dupliquées:
        // un chemin relatif n'est pas résolu par tous les robots sociaux.
        .replaceAll('content="/og-image.png"', `content="${base}/og-image.png"`)
    );
  },
});

export default defineConfig({
  plugins: [react(), metaSite()],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // React et framer-motion changent rarement: les isoler permet au
        // navigateur de garder ces chunks en cache entre deux déploiements.
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/__tests__/**", "src/main.jsx"],
    },
  },
});
