# Rapport final — passe exhaustive Cookie Craze

> **Résumé pour lecture rapide, sans connaître le code.**
>
> Vingt profils automatisés — des scripts Playwright, jamais des personnes —
> ont joué chacun dix à treize minutes réelles dans leur propre navigateur,
> deux fois : avant puis après correction, mêmes graines, mêmes scénarios.
> Entre les deux campagnes, la règle définitive des nombres a été posée dans le
> moteur : quarts sous cent, entiers dès cent, CRMB en centimes, cadence au
> quart, affichage compact sans décimale (« 1 910K »). Chaque gain crédité
> respecte désormais la règle — pas seulement son affichage. Les campagnes ont
> produit 40 vidéos, ~600 captures, des chronologies à 20 secondes et zéro
> erreur console sur les deux passes. L'anti-autoclicker ne montre aucun faux
> positif à 12–15 clics/s humains et détecte l'autoclicker à 50/s en 17
> secondes. Le simulateur couvre enfin quêtes, événements et hors-ligne
> jusqu'à 365 jours simulés. Rien n'a été fusionné dans main ; la branche
> seule a été poussée pour générer une Preview. — Les limites restantes sont
> listées en §20, sans fard.

---

## 1. État Git avant / après

| | Avant la passe | Après |
| --- | --- | --- |
| Dépôt | `Optipen/Cookies` | inchangé |
| Branche de travail | `claude/cookie-craze-audit-tests-jo1ddp` (désignée pour cette session) | la même, poussée |
| Base de départ | `402d713` — tête de `claude/project-completeness-analysis-jod0ip` | — |
| `origin/main` | `7249ead` (« Refonte complète » déjà fusionnée — l'attendu `251ee4e` était antérieur à cette fusion) | **intact, jamais touché** |
| Branche `jod0ip` | `402d713` | **intacte** (sauvegarde conservée) |

Écarts constatés avec l'état annoncé dans la demande :
- `origin/main` n'était plus à `251ee4e` mais à `7249ead` : la « Refonte complète »
  avait été fusionnée dans main avant cette session. `251ee4e` (« v8 ») existe
  bien, plus bas dans l'historique.
- La branche désignée pour cette session est `claude/cookie-craze-audit-tests-jo1ddp`
  (consigne d'environnement) ; elle a été **basée sur `402d713`**, la tête de
  `claude/project-completeness-analysis-jod0ip`, qui descend de `origin/main` :
  rien du travail précédent n'est perdu, et `jod0ip` n'a pas été modifiée.
- Aucun force-push, aucune fusion, aucun déploiement production.

## 2. Liste des commits

<!-- COMMITS -->

## 3. Matrice complète des fonctionnalités

Voir `qa/rapport/matrice.md` — chaque fonctionnalité, ses deux contextes de
test minimum (profil de campagne + test unitaire ou planche), et son verdict.

## 4. Règles numériques finales

| Domaine | Règle | Portée |
| --- | --- | --- |
| Valeurs < 100 | quarts seulement : 0 · 0,25 · … · 99,75 | créditées ET affichées |
| Valeurs ≥ 100 | entiers seulement : 100 · 125 · 402 · 1 910 · 20 100 | créditées ET affichées |
| Multiplicateurs | pas de 0,25 à toute magnitude (×1,25 · … · ×101,25) | visibles et réels |
| CRMB | centimes (0,01) ; solde en centimes entiers ; fractions accumulées, jamais perdues ; affichage ≤ 2 décimales, zéros retirés | solde, récompenses, extraction, staking, échanges, frais, cours |
| Cours du marché | entier de cookies | appliqué = affiché |
| Cadence | mesurée finement, affichée au quart le plus proche, préfixe ≈, clics crédités seulement | affichage |
| Production des clics | « par clic × cadence affichée », repliée, préfixe ≈ (et le total avec, en jeu actif) | affichage dérivé recalculable de tête |
| Compact | jamais de décimale dans un suffixe : `1 910K`, pas `1,91M` ; exact quand c'est possible (`11 750K`) ; mantisse entière la plus haute (`25M`) | partout |
| Rapports d'audit | valeurs brutes conservées | interne |

## 5. Tableau des 20 profils

Tous les profils sont des **scripts automatisés** (personas simulées) — jamais
des personnes. Graine fixe par profil: la campagne 2 rejoue les mêmes
décisions. Les états tardifs viennent de **fixtures datées** (personne n'a
« attendu dix jours »).

| # | Profil | Écran | Durée | Sauvegarde de départ |
| --- | --- | --- | --- | --- |
| 1 | Nouveau très lent | 320×568 | 620 s | aucune (intro) |
| 2 | Nouveau normal mobile | 390×844 | 620 s | aucune (intro) |
| 3 | Nouveau ordinateur | 1366×768 | 620 s | aucune (intro) |
| 4 | Occasionnel ~3 clics/s | 1280×800 | 620 s | petit parc |
| 5 | Normal ~5 clics/s | 1440×900 | 620 s | petit parc |
| 6 | Rapide 8–11 clics/s | 1440×900 | 620 s | petit parc |
| 7 | Très rapide 12–15, rafales | 1440×900 | 620 s | petit parc |
| 8 | Autoclicker 50 clics/s | 1366×768 | 620 s | petit parc |
| 9 | Minage seul (2 clics) | 1280×800 | 620 s | parc moyen |
| 10 | Alternance clics/pauses | 1366×768 | 620 s | petit parc |
| 11 | Achats au hasard | 1366×768 | 620 s | parc moyen |
| 12 | Optimiseur | 1440×900 | 620 s | petit parc |
| 13 | Mauvaise stratégie puis pivot | 1366×768 | 620 s | petit parc |
| 14 | Spécialiste CRMB | 1440×900 | 780 s | fixture CRMB (64 CRMB, parc) |
| 15 | Chasseur de quêtes/événements | 1366×768 | 780 s | fixture quêtes |
| 16 | Sauvegarde v3 | 1280×800 | 620 s | **fixture v3 réelle** (champs morts, combo ×2,6) |
| 17 | Sauvegardes v4 puis v5 | 1280×800 | 660 s | **fixtures v4 et v5** (staking à plat, chips) |
| 18 | Prestige + arbre céleste | 1440×900 | 720 s | fixture au seuil (740 M cuits) |
| 19 | Ascension: Horizon/Éclat/Écho | 1440×900 | 720 s | fixture ascendue (9 ⭐, 6 400 chips) |
| 20 | Accessibilité | 390×844 | 720 s | fixture + absence 2 h |

## 6. Résultats avant / après par profil

Voir `qa-artifacts/campagne-2/analyse.md` (synthèses des deux campagnes +
comparaison profil par profil, régressions incluses).

<!-- AVANT-APRES -->

## 7. Index des vidéos

40 vidéos (20 par campagne), listées avec taille et durée dans :
- `qa-artifacts/campagne-1/index-videos.md`
- `qa-artifacts/campagne-2/index-videos.md`

Les vidéos et captures restent des **artefacts de QA locaux** (répertoire
`qa-artifacts/`, ignoré par Git — des centaines de Mo n'ont rien à faire dans
l'historique). L'environnement d'exécution étant éphémère, l'index et les
synthèses chiffrées sont, eux, committés sous `qa/rapport/`.

<!-- VIDEOS -->

## 8. Planches de captures

- `qa-artifacts/planches-avant/` — 35 scènes déterministes sur le build d'avant
- `qa-artifacts/planches-apres/` — les mêmes scènes sur le build corrigé
- couverture : 6 gabarits, 6 onglets × 2 tailles, 4 dialogues, 5 statistiques
  × 4 états, CRMB (marché/staking/registre), Voûte d'Ascension, bâtiments
  tardifs, frontière 99,75 → 100, milliards.

## 9. Défauts trouvés

Voir `qa/rapport/defauts.md` — 13 corrigés (8 P1, 2 P2, 3 P3), 3 constats
documentés, et le détail campagne par campagne dans les analyses.

## 10. Corrections effectuées

Une correction = un commit, chaque fois : test rouge d'abord, cause réelle,
vérification navigateur, effets de bord balayés par la suite complète.
Voir §2 et `qa/rapport/defauts.md`.

## 11. Chiffres de rythme

<!-- RYTHME -->

## 12. Équilibre Clic / Minage

<!-- EQUILIBRE -->

## 13. Économie CRMB

<!-- CRMB -->

## 14. Résultats anti-autoclicker

**En navigateur (campagnes, deux passes concordantes):**

| Profil | Envoyés | Crédités | Vérifications | Verdict |
| --- | --- | --- | --- | --- |
| p04 ~3 clics/s | 1 193 | 100 % | 0 | ✓ |
| p05 ~5 clics/s | 2 110 | 100 % | 0 | ✓ |
| p06 8–11 clics/s | 3 885 | 100 % | 0 | ✓ |
| p07 12–15 clics/s en rafales | 4 695 | **99,4 %** | **0** | ✓ aucun faux positif |
| p08 autoclicker (7 601 synthétiques à 50/s + 4 444 réguliers à ~30/s) | 12 045+ | borné (3 913 au compteur) | **7** — la première en **17 s** | ✓ détecté et borné |
| p09 inactif 620 s | 2 | — | **0** | ✓ jamais de vérification sur l'inactivité |

Le minage continue onglet caché (p09: +32 776 cookies pendant 120 s masqué) et
pendant les vérifications. La borne de 15 clics/s crédités est conservée, avec
la réserve de rafale de 8.

**En unitaire (`anticheat-cadences.test.js`)** — la matrice exigée: 3 · 5 · 8 ·
11 crédités à 100 % sans vérification; 12–15 en rafales giguées >95 % sans
vérification; 20/s borné sans accusation (le seau suffit); 50/s borné ET
vérifié; métronome parfait vérifié même à 8/s; deux rafales à fréquence
identique repérées sans condamner seules; multitouch >5 doigts signalé;
10 minutes d'événements synthétiques à cadence humaine jamais condamnées;
rechargement = garde neuf (non-persistance choisie).

**Limites, sans détour**: protection entièrement côté client. Elle ne prétend
pas empêcher la modification du `localStorage`, l'appel du moteur en console ni
la recompilation sans le garde — rien ne le peut sans serveur. La vérification
se contourne par rechargement, exprès, pour qu'un bug ne puisse enfermer
personne. Et même bornée, l'automatisation garde un avantage cumulatif (~10×
sur un an, composé par les renaissances): la borne rend l'écart fini, pas nul.

## 15. Migrations

**En navigateur:**
- **v3** (p16): clé `cookieCrazeSaveV3` **conservée**, partie jouable
  immédiatement, champs morts écartés, `bestCombo 2,6` ramené à 1,75,
  session de 620 s sans erreur. Solde CRMB v3 `0,412` migré au centime (0,41).
- **v4** (p17 phase 1): staking « à plat » (4,5) devenu **position flexible
  visible** avec bouton Retirer; identifiants d'améliorations legacy écartés.
- **v5** (p17 phase 2, campagne 2): chips et arbre céleste conservés, Ascension
  et Registre ajoutés à zéro. (En campagne 1, ce créneau a mesuré autre chose
  d'aussi précieux: après un `clear()` sauvage suivi d'un rechargement,
  l'autosauvegarde de `pagehide` restaure la partie en cours — le jeu ne perd
  pas le joueur, même quand on lui vide le stockage sous les pieds.)
- **v6 → v6**: rechargements multiples en cours de session (p17, p20) sans
  dérive; réglages d'accessibilité persistés à travers le rechargement (p20).

**En unitaire** (`migration.test.js`, inchangé et vert): NaN/Infinity assainis,
quantités négatives écartées seules, types entièrement faux → partie neuve sans
exception, horloge reculée/avancée de dix ans sans valeur négative, migration
jouée deux fois → résultat identique, sauvegarde illisible archivée sous
`cookieCrazeSaveV6_corrupted_<horodatage>`, jamais supprimée.

## 16. Performances

<!-- PERFORMANCES -->

## 17. Tests

**Validation sur copie propre** (clone frais du dépôt, branche de travail):

| Étape | Résultat |
| --- | --- |
| `npm ci` | propre, **0 vulnérabilité** |
| `npm test` | **25 fichiers, 461 tests, tous verts** (405 au départ de la passe) |
| `npm run lint` | **zéro erreur, zéro avertissement**, dépôt entier (harnais QA compris) |
| `npm run build` | ✓ en ~4 s |
| `npm audit` (complet et `--omit=dev`) | **0 vulnérabilité** |

56 tests ajoutés par cette passe, chacun né ROUGE avant sa correction :
`grille-magnitudes` (9), `format-compact` (10), `cadence-quart` (8),
`crmb-centimes` (9), `gains-evenements` (4), `quetes-contexte` (3),
`anticheat-cadences` (12), plus les specs historiques réécrites là où
l'ancienne règle était codée en dur (compact `1,23M`, `roundCrmb` au
millionième, gain unitaire `+0,25` à toute échelle).

## 18. Simulations longues

<!-- SIMULATIONS -->

## 19. URL et statut de la Preview

<!-- PREVIEW -->

## 20. Limites restantes

<!-- LIMITES -->
