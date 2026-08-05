# Matrice fonctionnelle — chaque fonctionnalité, deux contextes de test minimum

Colonnes « Contexte 1 / Contexte 2 » : où la fonctionnalité a été réellement
ouverte et utilisée. `pNN` = profil de campagne navigateur (avant ET après
correction) ; `unit` = fichier de tests ; `planche` = scène de capture
déterministe ; `script` = outil de mesure dédié. Verdict après campagne 2.

| Fonctionnalité | Contexte 1 | Contexte 2 | Verdict |
| --- | --- | --- | --- |
| Écran d'accueil / intro | p01, p02, p03 (lecture + « Commencer ») | unit `game.test` (intro → jeu) | <!--V--> |
| Démarrage clavier de l'intro (Entrée/Espace) | p20 | lecture code `Intro.jsx` (écouteur dédié) | <!--V--> |
| Cookie principal (clic, gain, particules) | tous les profils cliqueurs | unit `game.test`, `selectors.test` | <!--V--> |
| Puissance par clic (affichée = créditée) | p05, p07 (stat-par-clic suivi 20 s) | unit `grille-magnitudes`, `cadence-quart` | <!--V--> |
| Cadence mesurée (≈, quarts, crédités seulement) | p04–p08 (cadenceTexte en chronologie) | unit `cadence-quart` ; planche `statistiques` | <!--V--> |
| Production des clics (≈, dérivée de la cadence) | p05, p07 | unit `cadence-quart`, `statistiques` | <!--V--> |
| Minage /s | p09 (minage seul), p13 (pivot) | unit `selectors`, `grille-magnitudes` | <!--V--> |
| Production totale (= minage au repos) | p09, p10 (pauses) | unit `statistiques` | <!--V--> |
| Combo (4 crans, jauge, retombée) | p06, p07 (rafales, capture combo-plein) | unit `combo.test` ; planche `combo-plein` | <!--V--> |
| Cliqueurs (12 rangs) | p13 (que des Cliqueurs), p12 | unit `selectors` ; données `items` | <!--V--> |
| Mineurs (12 rangs) | p09 (que des Mineurs), p13 (pivot) | unit `selectors` | <!--V--> |
| Filtres Tout / Clic / Minage | p09, p13 (filtres pilotés) | p11 (aléatoire) ; planches gabarits | <!--V--> |
| Achats ×1 / ×10 / Max | p06, p11, p19 (Max/×10) | unit `prix.test` (lots = somme des unités) | <!--V--> |
| Prix groupés (lot jamais plus cher) | p19 (×10 tardifs) | unit `prix.test` | <!--V--> |
| Paliers de bâtiment (seuils ×2) | p12 (optimiseur les vise) | unit `upgrades` via `audit.test` ; `nextMilestone` | <!--V--> |
| Améliorations (catalogue infini, tri) | p03, p11, p12 | unit `selectors.test` (gains réels) | <!--V--> |
| Quêtes (3 actives, 3 quotidiennes, chrono, reroll) | p15 (chasse + reroll), p02 | unit `quests.test`, `quetes-contexte` | <!--V--> |
| Succès (55, filtres, récompenses) | p15, p05 (notifications groupées) | unit via `useAchievements` + `statistiques` panel | <!--V--> |
| Apparences (achat cookies + CRMB, essai au survol) | p11 (aléatoire), p19 (fixture ice équipée) | données `skins` ; planche profil | <!--V--> |
| Statistiques (Profil) | p05, p15 (captures fin) | planche `onglets-*--profil` | <!--V--> |
| Réglages (menu) | p20 (tout basculé) | planche `dialogue-reglages` | <!--V--> |
| Son (coupé/remis, volume clavier) | p20 | lecture `useAudio` (init après geste) | <!--V--> |
| Animations réduites | p20 (activé puis session) | planche contraste/animations | <!--V--> |
| Contraste élevé | p20 | planche | <!--V--> |
| Notifications (file, silence 11 s, groupage) | p15 (volume compté), p05 | unit `notices.test` (mesure d'une session type) | <!--V--> |
| Cookies dorés (attraper, buffs, DR) | p15 (tous), p05 (opportuniste) | unit `gains-evenements` ; hook `useEvents` | <!--V--> |
| Pluie de miettes | p15 (toutes attrapées) | unit `gains-evenements` | <!--V--> |
| Cookie volant | p15 (attrapé si présent) | lecture `useEvents` (buff ×2) | <!--V--> |
| Ventes flash / remises | p01–p03 (fenêtre de début) | unit `selectors` (remises cumulées) | <!--V--> |
| Cookie croqué (80 morsures, bonus) | p15 (compteur suivi) | unit `gains-evenements` (`gainCroque`) | <!--V--> |
| Gains hors-ligne (plafond 2 h, dégressif) | p20 (retour 2 h, encaissé au clavier) | unit `offline.test`, `crmb-centimes` | <!--V--> |
| Sauvegarde automatique (5 s + pagehide) | p20 (rechargement), p16/p17 | unit `state.test` | <!--V--> |
| Rechargement en cours de partie | p20, p17 (continuité mesurée) | — | <!--V--> |
| Onglet caché (minage continue, pas de sur-production) | p09 (+120 s mesurés), p10, p20 | unit `useGameLoop` (dt borné) via `game.test` | <!--V--> |
| Migration v3 | p16 (clés conservées, combo borné) | unit `migration.test` | <!--V--> |
| Migration v4 (staking à plat → position flexible) | p17 phase 1 | unit `migration.test` | <!--V--> |
| Migration v5 | p17 phase 2 (bascule one-shot, campagne 2) | unit `migration.test` | <!--V--> |
| Migration v6 → v6 (idempotence) | p17 (continuité après clear+reload, campagne 1) | unit `migration.test` (deux passes identiques) | <!--V--> |
| Sauvegarde corrompue (archivée, jamais effacée) | — (destructif: couvert hors navigateur) | unit `state.test`, `audit.test` | <!--V--> |
| Marché CRMB (cours, tendance, graphe) | p14 (achats au creux, ventes au sommet) | unit `crypto.test`, `crmb-centimes` | <!--V--> |
| Achat / vente CRMB (jambes entières, frais 2 %) | p14 (1/5/10/25) | unit `crmb-centimes` | <!--V--> |
| Staking flexible (retrait immédiat) | p14 (bloqué puis retiré) | unit `crypto.test` | <!--V--> |
| Staking verrouillé (1 h / 6 h / 24 h) | p14 (1 h + 6 h, verrou constaté) | unit `crypto.test` (paliers, poids) | <!--V--> |
| Extraction CRMB (machines, taux au centième) | p14 (3 machines) | unit `crmb-centimes` (taux posé) | <!--V--> |
| Registre (contrats définitifs) | p14 (2 contrats), p19 (survit à l'ascension) | unit `crmb.test` (`ledgerSteps`) | <!--V--> |
| Prestige / renaissance (confirmation, chips, +5 CRMB) | p18 (dialogue capturé), p16 | unit `ascension.test` ; planche confirmation | <!--V--> |
| Arbre céleste (8 nœuds, effets) | p18 (6 achats) | unit `grille.test` (crans propres) | <!--V--> |
| Ascension (étoiles, ce qui survit) | p19 (2e ascension, état vérifié) | unit `ascension.test` ; planche Voûte | <!--V--> |
| Horizon / Éclat / Écho | p19 (les trois montées) | unit `ascension.test` | <!--V--> |
| Bâtiments tardifs (rangs 8–11) | p19 (achetés ×10) | unit `ascension.test` (verrouillage) ; planche | <!--V--> |
| Anti-autoclicker: seau à jetons | p07 (99,4 % crédités), p08 (borné) | unit `anticheat-cadences` (matrice 3→50/s) | <!--V--> |
| Anti-autoclicker: score et signaux | p08 (7 vérifications) | unit `anticheat.test` + matrice | <!--V--> |
| Vérification humaine (question, relance, non-persistée) | p08 (répondues), planche dédiée | unit `anticheat.test` (défi) | <!--V--> |
| Pas de vérification sur inactivité | p09 (620 s presque sans clic) | unit `anticheat.test` | <!--V--> |
| Navigation mobile (barre basse, safe-area) | p01, p02, p20 (390/320 px) | script `mobile.mjs` (6 gabarits) | <!--V--> |
| Navigation clavier (Ctrl+1..6, Tab, Entrée) | p20 (parcours complet) | lecture `CookieCraze` (raccourcis) | <!--V--> |
| Accessibilité (aria, sr-only, focus) | p20 | lecture composants (roles, aria-labels) | <!--V--> |
| Responsive / débordements | auditeur: 20 s × 20 profils × 2 campagnes | script `mobile.mjs` ; planches 6 gabarits | <!--V--> |
| Console propre | 40 sessions instrumentées | script `console.mjs` (session longue) | <!--V--> |
| Mémoire | chronologies (heap Mo à 20 s) × 40 sessions | script `console.mjs` (GC forcé) | <!--V--> |
| Performances (rendu, boucle unique) | vidéos des campagnes (fluidité) | lecture architecture (commit 500 ms, particules hors React) | <!--V--> |
| Export / import de sauvegarde | — (dialogue fichier natif hors portée Playwright headless fiable) | unit `state.test` (`exportSave`/`importSave`, base64 v3) | <!--V--> |
| Onglet caché + événements (pas de spawn fantôme) | p09, p10, p20 | lecture `useEvents` (timers nettoyés) | <!--V--> |
