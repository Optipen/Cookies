# Cookie Craze 🍪

Jeu de clic incrémental : bâtis ton empire du biscuit, accomplis des quêtes et
fais fructifier ton CrumbCoin.

React · Vite · Tailwind · Framer Motion — aucun backend.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
```

| Commande            | Rôle                                          |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Serveur de développement                      |
| `npm run build`     | Build de production dans `dist/`              |
| `npm run preview`   | Sert le build sur http://localhost:4173       |
| `npm test`          | Suite de tests (160 tests)                    |
| `npm run test:watch`| Tests en continu                              |
| `npm run coverage`  | Rapport de couverture                         |
| `npm run lint`      | ESLint                                        |

## Équilibrage : deux axes, aucun plafond

Le jeu tourne sur deux axes qui fonctionnent **en même temps** :

- **Puissance de clic** — les cookies gagnés à chaque clic, portée par les
  **Cliqueurs** ;
- **Minage** — les cookies générés chaque seconde, porté par les **Mineurs**.

### La grille : des nombres choisis, jamais calculés

**Aucun multiplicateur visible n'est le résultat d'un calcul.** Ils sont tous
pris sur une grille :

```
×1 · ×1,25 · ×1,50 · ×1,75 · ×2 · ×2,25 · ×2,50 · ×2,75 · ×3 …
```

Ce n'est pas un arrondi d'affichage : la valeur montrée **est** la valeur
utilisée dans la formule. Un ×1,02 ou un ×2,08 n'est donc pas corrigé, il est
impossible à produire. Les valeurs, prix et récompenses suivent la même
logique, sur l'échelle `1 · 2,5 · 5 · 10 · 25 · 50 · 100 · 250 …`.

Rien ne donne « +2 % ». Une source de bonus fait **franchir un palier**, et
franchir un palier ajoute exactement +0,25. Entre deux paliers le nombre ne
bouge pas — c'est une barre de progression qui montre ce qu'il reste, parce
qu'un palier qu'on voit approcher se remarque mieux qu'un pourcentage qui
grignote.

Tout vit dans [`src/utils/grid.js`](src/utils/grid.js).

### La formule

```
crans      = paliers(chips) + paliers(staking) + niveaux(arbre céleste)
global     = 1 + 0,25 × crans                        ← un multiple de 0,25, toujours
valeur(b)  = grille↓(valeur_base(b) × palier(b) × global)   ≥ valeur_base(b)
minage     = Σ(mineurs   × valeur(b))
puiss. clic= 1 + Σ(cliqueurs × valeur(b))
par clic   = (puissance clic + minage × 5 %) × combo
```

La **quantification par exemplaire** (`grille↓`) est ce qui garantit que le
nombre affiché est le nombre calculé. Sans elle, le Curseur — seul bâtiment dont
la valeur de base n'est pas entière — sortait de la grille pour 73 % des
multiplicateurs: `0,25 × 2,5 = 0,625`, que l'écran arrondissait en « +0,63 ».
Les quinze autres ont une valeur entière et ne sont pas concernés, entier × (k/4)
tombant toujours sur la grille.

Les sources de bonus **additionnent leurs crans** au lieu de multiplier leurs
multiplicateurs. C'est le point clé : ×2,25 × ×1,25 vaut ×2,8125, et un Curseur
annonçait alors « +2,81 /clic ». En sommant les crans on obtient ×2,75, et il
annonce « +2,75 ».

Les deux sommes sont **linéaires et sans plafond** : le millionième Cliqueur
ajoute exactement autant que le premier. Il n'existe aucune asymptote, aucun
softcap, aucun ×13.

Les 5 % sont un filet de sécurité à valeur fixe, pas un axe de progression :
même sans le moindre Cliqueur, la puissance de clic reste proportionnelle à
l'empire. Rien ne permet de les faire monter — une famille d'améliorations qui
le faisait envoyait le rapport actif/passif au-delà de 8×.

### Valeurs propres et additives

Un Mineur vaut dix fois son Cliqueur de même rang, et coûte exactement le même
prix. Le premier achat de la partie est donc un vrai choix, à prix égal :
produire pendant que tu ne joues pas, ou frapper plus fort quand tu joues.

| Rang | Cliqueur | | Mineur | | Prix de base |
| --- | --- | --- | --- | --- | --- |
| 1 | Curseur | +0,25 /clic | Four | +2 /s | 100 |
| 2 | Mamie | +1 | Boulangerie | +10 | 1 000 |
| 3 | Gant de frappe | +5 | Ferme | +50 | 10 000 |
| 4 | Bras robotisé | +25 | Usine | +250 | 100 000 |
| 5 | Exosquelette | +100 | Banque | +1 000 | 1 000 000 |
| 6 | IA de frappe | +500 | Temple | +5 000 | 10 000 000 |
| 7 | Machine à Temps | +2 500 | Laboratoire | +25 000 | 100 000 000 |
| 8 | Singularité tactile | +10 000 | Portail | +100 000 | 1 000 000 000 |

Un rang coûte dix fois le précédent et rapporte cinq fois plus : il devient
rentable après quelques exemplaires de celui d'en dessous, ce qui fait
apparaître un nouveau bâtiment toutes les trois à cinq minutes.

L'addition est exacte : puissance 1 + un Curseur = **exactement 1,25**. Le prix,
lui, croît de 22 % par exemplaire.

**Un Mineur rapporte deux gains, dans deux unités différentes.** Un Portail
donne **+100 000 /s de minage** *et*, par la part reversée, **+5 000 /clic**.
Ces deux nombres ne s'additionnent pas — l'un est une production par seconde,
l'autre une puissance par clic — et la boutique les affiche séparément.

### Paliers : doubler le parc, doubler le rendement

Une seule règle, et un seul nombre à retenir :

| | Rôle | Valeurs |
| --- | --- | --- |
| **Seuil** (`tierThreshold`) | à combien d'exemplaires le palier se débloque | 10, 20, 40, 80, 160, 320 … un doublement à chaque fois, sans fin |
| **Multiplicateur** (`tierMultiplier`) | ce que le palier multiplie | **×2**, toujours |

Doubler son parc le rend deux fois meilleur. L'échelle précédente (seuils
10/25/50/100/200/400, multiplicateurs ×2 puis ×3 puis ×5) cumulait **×360** à
quatre cents exemplaires et faisait s'emballer la partie en quelques minutes.

### Les cinq chiffres

Le jeu n'affichait qu'un seul axe en /s — le minage. Impossible, donc, de
répondre à la seule question qui compte. Cinq statistiques sont désormais sous
le compteur :

```
   PAR CLIC        CADENCE         CLICS
     401,7         ≈4,25 /s       1,72K /s
   ─────────────────────────────────────────
     ⛏️ 1,33K/s  +  👆 1,72K/s  =  3,05K/s
```

La **cadence est mesurée**, pas supposée: moyenne glissante sur trois secondes,
publiée à 5 Hz, éteinte après une seconde et demie sans clic. Elle s'affiche
arrondie au quart et préfixée de « ≈ » — c'est une moyenne, la donner au
millième serait faussement précis. Quand on arrête de cliquer, la colonne du
milieu s'éteint et le total retombe au minage seul : c'est exactement ce qu'on
veut montrer.

### Le rythme

Le chiffre exact de cookies compte moins que la cadence. Six profils de joueurs
sont simulés sur quatre-vingt-dix jours
([`src/data/tuning.json`](src/data/tuning.json) tient les réglages) :

| Profil | Premier achat | Premier palier | Premier prestige | Nouveau bâtiment |
| --- | --- | --- | --- | --- |
| Occasionnel (3 clics/s) | 20 s | 32 min | 105 min | ~5 min |
| **Normal (5 clics/s)** | **9 s** | **17 min** | **81 min** | **~3 min** |
| Très actif (7 clics/s) | 6 s | 11 min | 51 min | ~2 min |
| Minage surtout | 80 s | 26 min | 84 min | ~33 min |
| Achats au hasard | 10 s | 23 min | 89 min | ~3 min |
| Optimiseur | 6 s | 10 min | 41 min | ~2 min |

Cinq minutes de jeu donnent **24 000 cookies cuits** pour un joueur normal, là
où la version précédente en donnait 100 000 — et le premier prestige demandait
une demi-heure au lieu d'une heure et demie.

### Calibration : 5 clics/seconde, combo moyen ×2,25

La référence d'un joueur « normalement actif » est **5 clics/seconde**, pas 7 :
sept est une cadence de souris soutenue, intenable au pouce sur mobile. Le combo
de référence est ×2,25 — celui qu'on tient en moyenne, pas son maximum de ×3.

```
rapport actif / passif = (minage + par clic hors combo × combo × clics/s) / minage
```

Mesuré sur **90 jours**, pour les six profils :

| Profil | 5 min | 15 min | 1 h | 1 j | 3 j | 7 j | 30 j | 90 j |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Occasionnel | 2,08× | 1,86× | 1,81× | 1,78× | 1,62× | 1,76× | 1,77× | 1,73× |
| **Normal** | **2,97×** | **2,73×** | **2,74×** | **2,69×** | **2,66×** | **2,48×** | **2,67×** | **2,62×** |
| Très actif | 4,02× | 3,74× | 3,72× | 3,58× | 3,32× | 3,55× | 3,60× | 3,49× |
| Minage surtout | 1,13× | 1,07× | 1,06× | 1,06× | 1,06× | 1,06× | 1,06× | 1,06× |
| Au hasard | 2,85× | 2,66× | 2,55× | 2,00× | 3,02× | 2,97× | 2,52× | 2,43× |
| Optimiseur | 4,23× | 3,84× | 3,93× | 3,88× | 3,91× | 3,81× | 3,87× | 3,74× |

Le rapport se stabilise en un quart d'heure et **ne dérive plus** : il est le
même au premier jour et au quatre-vingt-dixième, après dix-neuf renaissances.

Il suit l'effort réel, **sans plafond** : doubler la cadence double l'écart au
passif, à l'infini. Un joueur très actif ou optimisateur dépasse donc 3× sans
que rien ne l'en empêche. Un joueur qui ne clique presque jamais reste à 1,06× —
son jeu tourne quand même, il gagne juste moins qu'en jouant. Le rapport est
visible dans **Profil → Statistiques**, pas au centre de l'écran.

### Les boutons de réglage

Tous dans [`src/data/tuning.json`](src/data/tuning.json), section `balance`, et
mesurés plutôt que devinés :

| Réglage | Valeur | Ce qu'il fait |
| --- | --- | --- |
| `price_scale` | 4 | Le temps de retour d'un achat, donc l'espacement entre deux achats. À 1 le premier achat tombait en 3 s et il s'en enchaînait 137 en dix minutes |
| `price_growth` | 1,22 | La vitesse générale. 1,15 → premier prestige à 30 min · 1,22 → 81 min · 1,30 → 41 min mais premier palier à 100 min |
| `tier_first` | 10 | Le premier palier de bâtiment. À 25, il n'arrivait qu'après une heure |
| `click_share` | 0,05 | Le rapport actif/passif. 3 % → 2,41× · 5 % → **2,7×** · 7 % → 2,85× |
| `click_price_factor` | 1 | Un Cliqueur coûte le même prix que le Mineur de même rang : le premier achat de la partie est un vrai choix, à prix égal |

Le prix unitaire est un levier faible sur un empire mûr — diviser le prix des
Cliqueurs par 2,5 ne fait acheter que deux exemplaires de plus par rang. C'est
**l'échelle des valeurs**, pas les prix, qui fixe le rapport actif/passif ; ce
sont les prix qui fixent le rythme.

### Combo

Huit crans nets, de ×1 à ×3, un tous les quatre clics enchaînés. La jauge montre
les huit segments et le cran suivant (« ×1,75 → ×2 ») : le multiplicateur ne
glisse jamais, il saute. S'arrêter le fait retomber en quelques secondes.

## Le jeu

- **16 bâtiments** : 8 Cliqueurs et 8 Mineurs, aux prix géométriques (×1,22 par
  exemplaire), sans mur de progression.
- **Améliorations infinies** : générées à la demande. Chaque bâtiment débloque
  un palier ×2 à 10, 20, 40, 80, 160 exemplaires — un doublement à chaque fois.
  Il n'y a pas de dernière amélioration.
- **26 quêtes** réparties en 8 catégories (clic, banque, achat, production,
  crypto, événement, style, quotidien). Trois quêtes actives, trois
  quotidiennes, une série de jours consécutifs, et un bouton pour passer une
  quête qui ne te plaît pas.
- **Économie CrumbCoin** : une monnaie de **récompense**, pas un compteur qui
  monte tout seul — voir plus bas.
- **Arbre céleste** : 8 améliorations permanentes achetées avec les chips de
  prestige, deux sans niveau maximum, chaque niveau valant +0,25. Elles
  survivent à toutes les renaissances suivantes.
- **53 succès** en 9 catégories, avec récompense en cookies — et en CRMB à
  partir du palier Or.
- **Événements** : cookies dorés, pluie de miettes, cookie volant, ventes flash.
- Progression hors-ligne, sauvegarde automatique, export/import, mode contraste
  élevé, animations réduites, réglage du volume.

Six onglets : Boutique (filtres Tout / Clic / Minage), Améliorations, Quêtes,
CRMB, Prestige, Profil (statistiques, succès, apparences).

### Le CRMB est une récompense, pas un revenu

Cuire des cookies ne rapporte **aucun** CRMB. Le robinet historique en versait
0,001 tous les 20 000 cookies, soit des centaines de millions en fin de partie :
une monnaie qu'on gagne sans effort ne récompense plus rien.

| Source | Montant | Fréquence |
| --- | --- | --- |
| Quêtes | +1, +2 ou +5 | 10 quêtes sur 26 en donnent — **≈ 4 CRMB par heure** de jeu actif |
| Succès Or | +1 | 15 succès |
| Succès Platine | +2 | 9 succès |
| Succès Légendaire | +5 | 4 succès |
| Prestige | +5 | à chaque renaissance |
| Matériel de minage | 0,05 à 25 CRMB **par heure** | à partir de 10 M de cookies pour le premier |

Les 53 succès rapportent **53 CRMB en tout** : c'est un plafond de partie, pas
un revenu. Toutes les récompenses sont des entiers — le bonus de quête de
l'arbre céleste ne s'applique qu'aux cookies, sinon il rendrait « 1,25 CRMB ».

Et il y a de quoi les dépenser :

- **Staking** — bloquer du CRMB fait franchir des paliers de production
  (+0,25 chacun) et rapporte 1 à 10 % **par jour** selon la durée du verrou.
  Premier palier après un quart d'heure, ×2 après deux heures et demie.
- **Les deux dernières apparences** ne s'achètent qu'en CRMB : 10 et 25, soit
  plusieurs sessions d'écart.
- **Le marché**, avec 2 % de frais dans les deux sens.

### Une seule notification, en haut, rarement

Le jeu récompensait tant de petites choses que la pile de notifications était
pleine en permanence — et, sur téléphone, posée pile sur la boutique.

| Ce qui arrive | Ce que ça donne |
| --- | --- |
| Un clic, un petit achat | Un chiffre qui monte sur place. Aucune notification |
| Un achat refusé | Une secousse courte. Aucun texte — le bouton grisé le disait déjà |
| Plusieurs succès ou quêtes d'un coup | **Une seule** notification groupée |
| Nouveau bâtiment, gros palier | Un bandeau |
| Prestige, cookie doré | Une grande animation, jamais écartée |

Un seul emplacement, **en haut** : la boutique et la navigation vivent sous le
pouce et rien ne les recouvre. Au plus **un bandeau ordinaire toutes les dix
secondes** ; ce qui arrive trop tôt est écarté, pas mis en file — une file ne
fait que retarder l'avalanche. Mesuré : 7 bandeaux par minute au maximum.

### Cliquer vite paie, automatiser non

Le rapport actif/passif suit la cadence sans plafond, comme voulu. Mais un
appui n'est crédité qu'une fois toutes les 40 ms, soit **25 clics/seconde**.

Un joueur rapide tient 12 à 15 clics/s à deux pouces : il ne touche jamais cette
borne. Un autoclicker à 50 clics/s, lui, obtenait cinq fois plus de cookies en
cinq minutes qu'un joueur très actif et un rapport de 24× ; il tombe à 12×, et
son avance sur un an est divisée par trois. Le clic répond quand même
visuellement au-delà de la borne : on refuse le gain, pas le geste.

### Pensé pour le pouce

- Boutique en **une seule colonne**, grandes cartes.
- Chaque carte sépare deux zones : la gauche ouvre le détail, la droite achète.
  On ne déclenche jamais l'un en visant l'autre.
- Fermée, une carte ne montre que ce qui décide l'achat : nom, quantité
  possédée, **gain réel**, prix. Le détail — valeur de base, second gain,
  avant → après — s'ouvre d'un appui.
- Une **barre de progression** vers l'achat quand il n'est pas encore payable.
- Sélecteur **×1 · ×10 · Max**, collé en haut de la liste.
- **Navigation en barre basse** sur téléphone, avec la marge de sécurité iOS ;
  la page réserve sa hauteur pour qu'aucun bouton ne finisse dessous. Au-dessus
  de `lg`, la même barre reprend sa place en tête du panneau.

### Aucun achat inutile

Le gain marginal du N+1-ième exemplaire, tous bâtiments déjà possédés à N :

| N | Curseur | Singularité | Four | Portail |
| --- | --- | --- | --- | --- |
| 0 | +0,25 /clic | +10 000 /clic | +2 /s · +0,10 /clic | +100 000 /s · +5 000 /clic |
| 10³ | +0,25 | +10 000 | +2 · +0,10 | +100 000 · +5 000 |
| 10⁶ | +0,25 | +10 000 | +2 · +0,10 | +100 000 · +5 000 |
| 10⁹ | +0,25 | +10 000 | +2 · +0,10 | +100 000 · +5 000 |

Le gain ne décroît jamais. Au-delà de 10¹² exemplaires **de chaque bâtiment**,
un +0,25 passe sous la précision d'un flottant 64 bits ; cet état est de toute
façon inatteignable, le prix du 10¹²-ième Curseur dépassant l'infini
représentable.

Raccourcis clavier : `Ctrl`/`Cmd` + `1‑6` pour changer d'onglet.

## Architecture

```
src/
├── components/    Interface — un panneau par onglet
├── hooks/         Systèmes: boucle de jeu, quêtes, succès, événements, audio
├── quests/        Catalogue de quêtes (données) + moteur (fonctions pures)
├── data/          Bâtiments, améliorations, succès, skins, prestige, tuning
└── utils/         État, calculs dérivés, économie CRMB, formatage
```

Trois principes tiennent l'ensemble :

**Le moteur de quêtes est pur.** `tickQuests(state, ctx, now)` rend un nouvel
état et la liste des événements survenus. Aucun `setState` imbriqué, donc
aucune boucle de rendu possible, et le moteur se teste sans React.

**Une seule boucle de jeu.** Production, faucet, minage, staking, marché et
temps de jeu sont regroupés dans un commit unique toutes les 500 ms, au lieu
d'un intervalle par sous-système.

**Les formules vivent au même endroit.** `deriveStats(state)` produit minage,
puissance de clic, part reversée et coûts. La boutique et le panneau
d'améliorations affichent le gain réel en appelant cette même fonction sur
l'état d'après achat, jamais une approximation : le chiffre annoncé est celui
que tu obtiendras.

**Les nombres visibles sont choisis, pas calculés.** `grid.js` ne convertit
jamais un pourcentage en multiplicateur : il compte des paliers franchis et rend
`1 + 0,25 × paliers`. Un ×1,02 ne peut donc pas exister, même transitoirement.
Et les sources s'additionnent avant conversion, une seule fois, pour que la
composition reste sur la grille.

**Les particules ne passent pas par React.** Elles vivent dans un ref et sont
animées en `requestAnimationFrame` qui écrit directement dans le DOM et
s'arrête dès que la scène est vide. La pluie de miettes tombe en animation CSS.
Aucune image ne déclenche de rendu React.

Le réglage de l'équilibrage vit dans [`src/data/tuning.json`](src/data/tuning.json) :
`balance` (part reversée, écart de prix, cadence et combo de référence), fenêtre
de début de partie, fréquence des événements, cadence des boucles, rendement
hors-ligne. Recalibrer le jeu ne demande donc pas de toucher au code.

## Montée en charge

Le jeu est entièrement client : la partie vit dans le `localStorage` du
joueur, il n'y a ni serveur de jeu ni base de données. Servir mille joueurs ou
un million revient donc à servir des fichiers statiques depuis un CDN.

Ce qui est en place pour ça :

- Assets versionnés par hash, servis en `immutable` pendant un an
  ([`vercel.json`](vercel.json)) ;
- Découpage du bundle : React et Framer Motion dans des chunks séparés qui
  restent en cache entre deux déploiements, panneaux secondaires chargés à la
  demande ;
- Service worker ([`public/sw.js`](public/sw.js)) : démarrage instantané aux
  visites suivantes et jeu utilisable hors connexion ;
- Sauvegarde tolérante aux pannes : `localStorage` indisponible, quota dépassé
  ou sauvegarde corrompue n'empêchent jamais le jeu de démarrer.

## Sauvegardes

La partie est stockée sous la clé `cookieCrazeSaveV5`. Les sauvegardes des
versions 1 à 4 sont migrées automatiquement au chargement : fusion profonde
avec l'état par défaut, valeurs aberrantes assainies, ancien staking converti
en position flexible, champs morts supprimés.

Export et import se font depuis ⚙️ → *Exporter / Importer la sauvegarde*.

## Déploiement

- **Vercel** : importer le dépôt, le reste est déjà configuré.
- **Netlify / autre statique** : `npm run build`, publier `dist/`, avec une
  réécriture de toutes les routes vers `/index.html`.

[`vercel.json`](vercel.json) fixe deux règles de cache opposées. Le format JSON
n'admet pas de commentaire — et le schéma Vercel rejette toute clé inconnue, y
compris un champ `comment` — donc elles sont expliquées ici :

| Chemin | Cache | Pourquoi |
| --- | --- | --- |
| `/assets/*` | un an, `immutable` | les fichiers produits par Vite portent un hash dans leur nom : un contenu différent a forcément une URL différente |
| `/sw.js` | `max-age=0, must-revalidate` | sans revalidation, un navigateur garderait l'ancien service worker et figerait le jeu sur une version périmée |
