# Export / Import – Essentiels

But:
- Sauvegarder/partager/transferer la partie (backup manuel, changement d’appareil/navigateur).
- Importer une save (JSON ou ancien .txt base64) et la migrer via `migrate()`.

Où (code):
- Définitions: `src/components/CookieCraze.jsx` → `exportSave()`, `importSave(file)`.
- UI: mêmes fichiers → boutons "💾 Export" et champ fichier "📥 Import".

Comportement:
- Export: télécharge `cookiecraze_save.json` (état complet du jeu). LocalStorage continue d’exister en parallèle.
- Import: remplace l’état courant par la save importée; applique `migrate()`; toasts succès/erreur.

Risques / à savoir:
- Import remplace l’état actuel (perte des progrès non exportés juste avant).
- Fichiers invalides → toast "Import invalide".
- Versionning géré par `migrate()`.

Masquer proprement (recommandé):
- Mettre les actions dans un sous-menu "Avancé" (caché par défaut), visible si:
  - bouton "Avancé" cliqué, ou
  - environnement DEV (`import.meta.env.DEV`), ou
  - URL `?advanced=1`.

Tests rapides:
- Export → télécharge un JSON non vide.
- Import d’un export récent → état identique après reload.
- Import d’un ancien `.txt` base64 → migré et chargé.
- Reload → progression conservée (LocalStorage) même sans Import/Export.

Quand retirer/laisser:
- Système de compte côté serveur: garder temporairement (migration), puis cacher/retirer.


