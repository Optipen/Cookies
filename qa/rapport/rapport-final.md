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

Mesure sur simulateur complet (quêtes réelles, événements en espérance, joueur
à 5 clics/s, stratégie équilibre, **dix secondes de décision par achat** —
sans ce délai on mesure une machine) :

| Objectif | Cible | Mesuré | |
| --- | --- | --- | --- |
| Premier achat payé | 5–15 s | **8,9 s** | ✓ |
| Achats marquants, 1re minute | 2–4 | **2** | ✓ |
| Écart médian entre achats marquants, 0–5 min | 20–45 s | **30 s** | ✓ |
| Écart médian entre MOMENTS intéressants (achat marquant + quête + doré + succès), 0–5 min | 20–45 s | **10 s** | plus dense que la cible |
| Premier vrai palier de bâtiment | 10–20 min | **13,4 min** | ✓ |
| Premier prestige | 60–120 min | **64 min** | ✓ |
| Première ascension | 5–20 j | **5,4 j** | ✓ |
| Dernière nouveauté | 7–60 j | **13,4 j** | ✓ |

**Le « 70,5 s » d'origine est réglé par la mesure, pas par un coup
d'accélérateur** : l'ancien chiffre comptait les seuls achats d'un optimiseur
sans temps de décision, dans un jeu amputé de ses quêtes, dorés et succès.
Compté honnêtement, l'écart entre achats marquants tient la cible (30 s), et le
rythme vécu descend à ~10 s sur les cinq premières minutes — dominé par la
rafale d'apprentissage de la première minute. Aucune impasse durable après une
mauvaise stratégie : le profil p13 (tout-Cliqueurs puis pivot Minage) finit sa
session en croissance normale, et l'écart meilleure/pire stratégie reste borné
(voir §12). Vérité navigateur concordante : les notifications de p05 montrent
des temps forts toutes les ~15–25 s sur les deux premières minutes.

## 12. Équilibre Clic / Minage

Rapport actif/passif médian (famille mécanique, stratégie optimiser, cible
2,5–2,8× à cinq clics par seconde) après la pose de la règle des entiers :

| Cadence | 1 h | 1 j | 30 j | 365 j |
| --- | --- | --- | --- | --- |
| 5 clics/s | **2,47×** | **2,52×** | **2,55×** | **2,60×** |

La règle des entiers dès cent (qui rabote quelques quarts de crans sur les
grosses valeurs) déplace le rapport d'environ un centième — l'équilibre
documenté tient. Le doublement de cadence double toujours l'écart au passif,
sans plafond; l'autoclicker borné reste à ~1,8× le joueur très rapide en
régime établi (§14). Détail complet par famille et par horizon dans
`docs/simulations.txt`.

## 13. Économie CRMB

**Règle** : centimes partout, solde en centimes entiers, fractions accumulées
dans une réserve interne jamais perdue (testé : trois heures d'un CPU à
0,05 CRMB/h créditent 0,15 au centime près, alors qu'un arrondi par tic aurait
tout perdu). Cours entier, jambes d'échange entières, frais de 2 % par sens
maintenus, taux d'extraction posé au centième par heure dans le moteur.

**Gains par source et par horizon** (simulateur complet, joueur normal) :

| Horizon | Prestige | Quêtes | Succès | Extraction | Solde |
| --- | --- | --- | --- | --- | --- |
| 10 min | 0 | 11 | 1 | 0 | 12 |
| 30 min | 0 | 11 | 2 | 0 | 13 |
| 1 h | 0 | 11 | 3 | 0 | 14 |
| 1 j | 45 | 239 | 19 | 142 | 445 |
| 7 j | 135 | 1 346 | 28 | 2 864 | 4 373 |
| 30 j | 410 | 5 584 | 34 | 51 636 | 57 664 |

**En navigateur** (p14, 13 minutes réelles) : achats 1/5/10/25 au marché,
vente, staking flexible ouvert puis retiré, positions 1 h et 6 h verrouillées
(verrou constaté), deux contrats du Registre signés (10 puis 25), ventes au
sommet sur tendance haussière. Départ 64 CRMB (71 après rendements), arrivée
cohérente opération par opération, zéro nombre hors règle en campagne 2.

**Constat de rareté, sans fard** : « rare et utile » tient sur le premier mois
— les quêtes dominent d'abord, le Registre absorbe les premières dizaines de
pièces. Au-delà, l'extraction domine tout (51 636 CRMB au trentième jour
simulé) et les puits (4 435 CRMB pour les huit contrats) sont dépassés d'un
facteur dix, cent à l'année. Rééquilibrage possible (prix d'extraction, paliers
de contrats supplémentaires), **à décider par le propriétaire** — pas de nerf
silencieux dans cette passe.

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

**Sur le build final**, mesures dédiées :

| Mesure (`scripts/console.mjs`, GC forcé) | Résultat |
| --- | --- |
| Erreurs console (1 600 clics + achats + onglets) | **0** |
| Avertissements console | **0** |
| Nœuds du document | 461, stable |
| Tas mémoire (GC forcé) | 5,3 Mo → 7,5 Mo |

| Gabarits (`scripts/mobile.mjs`) | Résultat |
| --- | --- |
| Débordement horizontal (6 gabarits, 320→1440 px) | **aucun** |
| Cibles tactiles < 44 px | **0** |
| Textes < 11 px | **0** |
| Boutique au-dessus de la ligne de flottaison | oui partout (528 px sur 320×568) |

**Sur quarante sessions de campagne** (10–13 min chacune, sans GC forcé) :
tas relevé toutes les 20 s, 4 Mo au chargement → 8 à 33 Mo selon le profil,
sans dérive continue — les pics suivent l'activité, pas le temps.
**Zéro erreur console sur les 40 sessions**, campagne 1 comme campagne 2,
et zéro pendant les relances. Les vidéos des sessions montrent une interface
fluide, y compris à 12–15 clics/s (une boucle de jeu à commit unique de
500 ms, particules hors React).

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

Horizons couverts : 1 min · 5 min · 15 min · **1 h · 6 h · 1 j · 3 j · 7 j ·
30 j · 90 j · 365 j** — quatre familles, dans `docs/simulations.txt`
(régénéré sur le moteur corrigé, reproductible par `npm run simulations`).

**Ce qui manquait au simulateur précédent est modélisé** :
- **quêtes et succès** : leur VRAI moteur (`tickQuests`, conditions réelles),
  tranche par tranche, récompenses réelles;
- **dorés, pluie** : espérance mathématique paramétrée par un taux
  d'attrapage par profil (les barèmes réels du jeu, DR compris);
- **hors-ligne** : famille « onglet fermé » — sessions réelles, puis la vraie
  fonction `offlineGains` entre elles. Mesuré : 2 à 11 % de la production
  totale selon le rythme (plafond 2 h + dégressivité obligent);
- **temps de décision humain** : dix secondes par achat.

**Ce qui n'est pas modélisé, et pourquoi, précisément** :
- les **quêtes chronométrées** — les tranches de temps du simulateur dépassent
  leur chrono; elles échouent comme chez un joueur qui les ignore;
- le **trading CRMB** — marche aléatoire centrée avec retour à la moyenne et
  2 % de frais par sens: l'espérance de tout aller-retour est négative par
  construction, il n'y a pas de gain à modéliser;
- la **vérification humaine** — elle ne retire rien à un joueur honnête;
- le **plaisir** — un nombre dans une fourchette n'est pas un jeu réussi.

**Séparation des sources de vérité, comme exigé** : mesure réelle en
navigateur = campagnes (10–13 min); simulation mathématique = familles
1–4; état préparé par fixture = profils tardifs (16–19) et planches;
jugement humain = explicitement hors de portée, dit partout où c'est le cas.

Longue durée : premier prestige 64 min; ascension 5,4 j; 24 bâtiments
découverts au 13,4ᵉ jour; du 30ᵉ au 365ᵉ jour la production est encore
multipliée par ~50 (famille complète: 5,7e9/s → 6,3e11/s en total au
365ᵉ), l'Éclat et l'Écho restant les seuls leviers après l'Horizon complet
— la courbe s'aplatit après J90, limite connue et déjà documentée.

## 19. URL et statut de la Preview

<!-- PREVIEW -->

## 20. Limites restantes

1. **La vérification de la Preview Vercel n'a pas pu être faite d'ici.**
   `vercel.app` est inaccessible depuis cet environnement (politique réseau du
   proxy: connexion refusée même vers le domaine de production connu), et
   aucun connecteur Vercel n'est disponible dans la session. La branche seule
   a été poussée; si l'intégration Git du projet `cookies`
   (`prj_u8bZmUZiACxcchVQ8KdMaIutqmrr`) est active, la Preview se construit
   automatiquement. **À réautoriser pour que je vérifie moi-même**: un
   connecteur Vercel (ou l'accès réseau à `*.vercel.app`). En attendant, le
   contrôle se fait au tableau de bord: projet `cookies` → déploiement du
   commit de tête de `claude/cookie-craze-audit-tests-jo1ddp` → statut READY,
   cible Preview, aucun rattachement à Nyzora ni à cookie-craze.
2. **La protection anti-autoclicker reste entièrement côté client** — bornée,
   mesurée, honnête sur ce qu'elle ne peut pas faire (localStorage, console,
   recompilation). Rien ne change sans serveur.
3. **L'extraction CRMB déborde ses puits au très long terme** (§13):
   rééquilibrage à décider par le propriétaire, pas fait en silence ici.
4. **La courbe s'aplatit après J90** une fois l'Horizon complet — mieux qu'un
   plateau (Éclat/Écho continuent), pas une courbe qui tient l'année.
5. **Le plaisir n'est pas mesuré.** Vingt scripts ne remplacent pas vingt
   personnes: rien ici ne dit si le jeu est agréable, seulement qu'il est
   exact, stable et cadencé.
6. **Deux différences de scénario entre campagnes, assumées et documentées**:
   la bascule v5 de p17 (le scénario de campagne 1 testait — utilement — la
   continuité après `clear()`), et le `scrollIntoView` des clics mobiles
   (campagne 1 sous-créditait p01/p02 par artefact de harnais). Les
   comparaisons avant/après de ces cases se lisent avec cette note.
7. **Sessions de plusieurs heures non observées en navigateur** — dix à
   treize minutes par session, quarante sessions; la mémoire longue durée
   reste extrapolée.
8. **Les grands entiers perdent l'exactitude au-delà de 9,01e15** (~60ᵉ jour
   simulé), sans conséquence de gameplay — connu, documenté, inchangé.
