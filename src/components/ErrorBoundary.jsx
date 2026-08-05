import React from "react";
import Icon from "./Icon.jsx";
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
      <div className="min-h-screen grid place-items-center bg-bakery p-6 text-center text-cream">
        <div className="max-w-md rounded-3xl glass-warm p-8">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-lava-deep/40 bg-lava-deep/10 text-lava">
            <Icon name="flame" size={26} />
          </span>
          <h1 className="font-display text-2xl text-cream-bright">Le four a surchauffé</h1>
          <p className="mt-2 text-sm text-cream/60">
            Une erreur inattendue s&apos;est produite. Ta sauvegarde est intacte : recharge la page pour reprendre.
          </p>
          <pre className="mt-4 max-h-28 overflow-auto rounded-xl border border-lava-deep/25 bg-lava-deep/5 p-2.5 text-left text-[11px] text-lava">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-honey rounded-2xl px-4 py-3 text-sm"
            >
              Recharger le jeu
            </button>
            <button
              type="button"
              onClick={this.downloadSave}
              className="btn-ghost inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px]"
            >
              <Icon name="download" size={14} className="text-honey" />
              Télécharger ma sauvegarde
            </button>
          </div>
        </div>
      </div>
    );
  }
}
