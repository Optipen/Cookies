# Inventaire des défauts — audit final Cookie Craze

Chaque défaut porte: sa preuve (audit statique, test rouge, campagne navigateur),
sa correction (commit) ou sa raison de rester, et sa priorité.

- **P0** — perte de données, crash, valeur créditée fausse
- **P1** — règle des nombres violée sur une valeur créditée, affiché ≠ versé
- **P2** — incohérence, faux calcul de contexte, équilibrage mesurable
- **P3** — cosmétique, texte, précision d'affichage

## Corrigés dans cette passe

| # | P | Défaut | Preuve | Correction |
| --- | --- | --- | --- | --- |
| 1 | P1 | Valeurs créditées avec décimales dès 100 — « 401,75 par clic », « 199,5 », « 249,25 » | test rouge `grille-magnitudes` ; campagne 1: catégorie `entier-requis` sur stat-par-clic, détails de bâtiments | `snapDown` magnitude-conscient: quarts sous 100, entiers dès 100 |
| 2 | P1 | Suffixes à décimales — « 1,91M », « 7,5M », « 11,75M » | test rouge `format-compact` ; campagne 1: catégorie `compact-decimales` (solde, boutique, valeur CRMB) | compact « 1 910K »: mantisse entière, représentation exacte prioritaire |
| 3 | P1 | Cadence affichée entière au lieu du quart; production des clics sans ≈ et non dérivée de la cadence affichée | test rouge `cadence-quart` ; exigence explicite de l'audit | arrondi au quart le plus proche, `prodClics = plié(parClic × cadence affichée)`, ≈ sur clics et total actifs |
| 4 | P1 | CRMB au millionième: solde réel ≠ affiché (« 13,412 » chez p16 campagne 1), taux « 0,0042 CRMB/h » à 4 décimales | campagne 1: p16 `etatFinal.crmb = 13,412` ; catégorie `crmb-centimes` | centimes partout: `roundCrmb` 0,01, accumulateur `pending` sans perte, taux d'extraction posé au centième/h, staking annoncé ≈/jour |
| 5 | P1 | Cours du marché flottant (20 941,31…), jambes d'échange non entières: cookies payés ≠ affichés | audit statique `cryptoBuy`/`cryptoSell` | cours entier, `coutAchatCrmb` plafond / `gainVenteCrmb` plancher, affichage = appliqué |
| 6 | P1 | Gains d'événements hors règle: miette ×2,5 sur clic 1,25 = 3,125 crédité; doré « Chance » = 10 % d'une banque quelconque; cookie croqué idem | arithmétique + code `useEvents` | barèmes extraits dans `utils/gains.js`, pliés avant crédit, testés |
| 7 | P1 | Gains hors-ligne crédités bruts (float quelconque, CRMB sous le centime) | audit statique `offline.js` | cookies pliés sur la règle, CRMB au centime plancher |
| 8 | P1 | Carte de quête annonçant le CRMB × bonus d'arbre (« +1,25 CRMB ») quand le moteur verse 1 | audit statique `QuestBoard.RewardChips` vs `resolveReward` | affichage aligné sur le moteur: cookies × mult plancher entier, CRMB tel quel |
| 9 | P2 | Cran fantôme dans le contexte de quêtes: `stakingBoost` (multiplicateur ×1 min.) passé comme crans à `cpsFrom` — ctx.cps gonflé en permanence | test rouge `quetes-contexte` | contexte lu depuis `deriveStats`, le même calcul que l'écran |
| 10 | P2 | Simulateur aveugle aux quêtes/événements/hors-ligne (le « 70,5 s » mesurait un jeu sans ses temps forts) | reproduction: couche opt-in reproduit 70,5 s sans événements | familles « complet » et « onglet fermé », moments intéressants, temps de décision humain |
| 11 | P3 | « 15 bâtiments » à l'intro (il y en a 16 de base, 24 avec Ascension) | lecture | « 16 bâtiments » |
| 12 | P3 | Libellés de buff « ×1,5 » / « ×2,5 » (les multiplicateurs s'écrivent à deux décimales: ×1,50) | lecture catalogue | normalisés ×1,50 / ×2,50 |
| 13 | P3 | Auditeur du harnais: état de sauvegarde construit mais jamais retourné (chronologie sans état) | lint no-unused-vars | retourné; campagne 1 garde des chronologies au solde textuel, campagne 2 aura l'état complet |

## Constats documentés (pas de correction aveugle)

| # | P | Constat | Preuve | Décision |
| --- | --- | --- | --- | --- |
| C1 | P2 | Sous stratégie optimale parfaite, récompenses de quêtes ∝ production font boule de neige (×20+ sur 10 min simulées, invisible aux cadences humaines: p05 navigateur = 80 K en 10 min, sain) | simulateur avec/sans `decisionS` vs campagne | documenté; pas de nerf sans mesure joueur — le temps de décision humain (8–15 s/achat) est la vraie borne |
| C2 | P2 | Extraction CRMB à l'année ≈ 10⁵–10⁶ CRMB (3 machines de chaque): les puits (Registre 4 435 au total) sont dépassés de ×100+ au très long terme | simulation 365 j | documenté au rapport §CRMB: « rare et utile » tient jusqu'à ~30 j, plus au-delà — rééquilibrage à décider par le propriétaire |
| C3 | P2 | Au-delà de 100 de puissance, un Curseur seul (+0,25) ne bouge l'entier qu'une fois sur quatre — conséquence arithmétique assumée de la règle des entiers | test `grille-magnitudes` | documenté; +1 exact par groupe de quatre, jamais de perte |

| 14 | P1 | Gain affiché d'un achat franchissant cent: « +499,25 /clic » (entier − quart) en boutique et améliorations | campagne 2 (17 textes chez p05, 7 zones « Détail de… ») ; test rouge `gain-affiche` | écarts affichés pliés par `snapDown`; le détail avant → après reste exact; 16 scénarios rejoués → 0 |

## Défauts du HARNAIS lui-même (corrigés, comptés à part)

| # | Défaut | Preuve | Correction |
| --- | --- | --- | --- |
| H1 | Zone CRMB non reconnue quand « CRMB » et la valeur vivent dans deux nœuds (pastille d'en-tête) → centimes légaux comptés en violations | campagne 1, catégorie quart-requis (10 textes, tous CRMB) | ancêtre court (≤80 car.) mentionnant CRMB qualifie la zone |
| H2 | Clics mobiles envoyés à des coordonnées mortes après défilement de la boutique (p01: 71 crédités sur 300) | campagne 1, p01/p02 | `scrollIntoViewIfNeeded` avant chaque rafale |
| H3 | Bascule v5 de p17 annulée par l'autosauvegarde de `pagehide` après `clear()` — le jeu, correctement, reprenait la partie v4 | campagne 1, sondes de migration | bascule one-shot au chargement, avant le code du jeu |
| H4 | Note d'achat de machine d'extraction sans vérification d'état (p14: note émise, 0 machine persistée) | campagne 1 | vérification de la sauvegarde après chaque clic d'achat |
| H5 | Auditeur: photographie d'état construite mais jamais retournée | lint no-unused-vars | retournée; chronologies complètes en campagne 2 |

## Verdicts finals (après relance des scénarios marqués)

- **Nombres hors règle: 1 056 (campagne 1) → 0 (campagne 2 + relances), sur les vingt profils.**
- **Erreurs console: 0 partout, sur les deux campagnes et les relances.**
- **Régressions: 0** (analyse comparée `qa/rapport/analyse-comparee.md`).
- p07 (12–15 clics/s humains): **0 vérification** sur les deux campagnes; p08: vérification en ~17 s, 7 puis 8 au total, cadence créditée bornée.
- p09: minage continu onglet caché (+32 776 en 120 s), aucune vérification d'inactivité.
- p14: cycle CRMB complet en centimes exacts; p17: v4 → position flexible, v5 → chips/arbre conservés; p19: seconde Ascension avec survie exacte (CRMB, Registre, skin, succès); p20: hors-ligne encaissé au clavier, réglages persistés au rechargement.
