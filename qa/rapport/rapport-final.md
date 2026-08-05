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

<!-- PROFILS -->

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

<!-- ANTICHEAT -->

## 15. Migrations

<!-- MIGRATIONS -->

## 16. Performances

<!-- PERFORMANCES -->

## 17. Tests

<!-- TESTS -->

## 18. Simulations longues

<!-- SIMULATIONS -->

## 19. URL et statut de la Preview

<!-- PREVIEW -->

## 20. Limites restantes

<!-- LIMITES -->
