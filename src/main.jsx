import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker: démarrage instantané aux visites suivantes et jeu jouable
// hors connexion. Uniquement en production — en dev il masquerait les
// rechargements à chaud de Vite.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // L'enregistrement échoue en contexte non sécurisé ou en iframe: le jeu
      // fonctionne à l'identique, simplement sans cache hors-ligne.
    });
  });
}
