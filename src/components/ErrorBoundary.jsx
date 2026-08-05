import React from "react";
import { SAVE_KEY } from "../utils/state.js";

/**
 * Filet de sécurité.
 *
 * Sans ça, la moindre exception dans un composant laisse un écran blanc et le
 * joueur n'a aucun moyen de récupérer sa partie. Ici on affiche une issue et on
 * propose d'exporter la sauvegarde avant toute réinitialisation.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[Crumbora] Erreur non rattrapée :", error, info?.componentStack);
  }

  downloadSave = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "crumbora-secours.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Stockage ou téléchargement indisponible: rien de plus à tenter ici
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen grid place-items-center bg-bakery p-6 text-center">
        <div className="max-w-md rounded-3xl glass-warm shadow-xl p-8">
          <div className="text-5xl mb-3">🍪💥</div>
          <h1 className="text-xl font-black text-amber-950">Le four a surchauffé</h1>
          <p className="mt-2 text-sm text-amber-800/80">
            Une erreur inattendue s&apos;est produite. Ta sauvegarde est intacte : recharge la page pour reprendre.
          </p>
          <pre className="mt-3 text-[11px] text-left text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 overflow-auto max-h-28">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg hover:from-amber-400 hover:to-orange-400 transition-colors"
            >
              Recharger le jeu
            </button>
            <button
              type="button"
              onClick={this.downloadSave}
              className="px-4 py-2 rounded-xl bg-white/70 border border-amber-200 text-amber-900 text-sm font-semibold hover:bg-white transition-colors"
            >
              💾 Télécharger ma sauvegarde
            </button>
          </div>
        </div>
      </div>
    );
  }
}
