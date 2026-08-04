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
| `npm test`          | Suite de tests (143 tests)                    |
| `npm run test:watch`| Tests en continu                              |
| `npm run coverage`  | Rapport de couverture                         |
| `npm run lint`      | ESLint                                        |

## Équilibrage : deux axes, aucun plafond

Le jeu tourne sur deux axes qui fonctionnent **en même temps** :

- **Puissance de clic** — les cookies gagnés à chaque clic, portée par les
  **Cliqueurs** ;
- **Minage** — les cookies générés chaque seconde, porté par les **Mineurs**.

### La formule

```
minage          = Σ(mineurs   × valeur × palier) × (1 + 0,02·chips) × staking × céleste
puissance clic  = (1 + Σ(cliqueurs × valeur × palier)) × (1 + 0,02·chips) × staking × céleste
par clic        = (puissance clic + minage × 6 %) × combo
```

Les deux sommes sont **linéaires et sans plafond** : le millionième Cliqueur
ajoute exactement autant que le premier. Il n'existe aucune asymptote, aucun
softcap, aucun ×13.

Les 6 % sont un filet de sécurité à valeur fixe, pas un axe de progression :
même sans le moindre Cliqueur, la puissance de clic reste proportionnelle à
l'empire. Rien ne permet de les faire monter — une famille d'améliorations qui
le faisait envoyait le rapport actif/passif au-delà de 8×.

### Valeurs propres et additives

Un Mineur vaut dix fois son Cliqueur de même rang, et coûte exactement le même
prix. Le premier achat de la partie est donc un vrai choix, à prix égal :
produire pendant que tu ne joues pas, ou frapper plus fort quand tu joues.

| Rang | Cliqueur | | Mineur | | Prix de base |
| --- | --- | --- | --- | --- | --- |
| 1 | Curseur | +0,25 /clic | Four | +2 /s | 60 |
| 2 | Mamie | +1 | Boulangerie | +10 | 1 000 |
| 3 | Gant de frappe | +5 | Ferme | +50 | 8 000 |
| 4 | Bras robotisé | +25 | Usine | +250 | 60 000 |
| 5 | Exosquelette | +100 | Banque | +1 000 | 340 000 |
| 6 | IA de frappe | +500 | Temple | +5 000 | 2 400 000 |
| 7 | Machine à Temps | +2 500 | Laboratoire | +25 000 | 17 000 000 |
| 8 | Singularité tactile | +10 000 | Portail | +100 000 | 95 000 000 |

L'addition est exacte : puissance 1 + un Curseur = **exactement 1,25**. Le prix,
lui, croît de 15 % par exemplaire.

**Un Mineur rapporte deux gains, dans deux unités différentes.** Un Portail
donne **+100 000 /s de minage** *et*, par la part reversée, **+6 000 /clic**.
Ces deux nombres ne s'additionnent pas — l'un est une production par seconde,
l'autre une puissance par clic — et la boutique les affiche séparément.

### Paliers : ×1,7 espace les seuils, il ne multiplie rien

Deux nombres différents, souvent confondus :

| | Rôle | Valeurs |
| --- | --- | --- |
| **Seuil** (`tierThreshold`) | à combien d'exemplaires le palier se débloque | 10, 25, 50, 100, 200, 400, puis **×1,7** à chaque fois |
| **Multiplicateur** (`tierMultiplier`) | ce que le palier multiplie | **×2**, puis ×3, puis ×5 — jamais ×1,7 |

Le ×1,7 est donc un **espacement**. Le joueur ne voit que des multiplicateurs
nets. Les seuils montent sans fin : il n'y a pas de dernier palier.

### Calibration : 5 clics/seconde, combo moyen ×2,2

La référence d'un joueur « normalement actif » est **5 clics/seconde**, pas 7 :
sept est une cadence de souris soutenue, intenable au pouce sur mobile. Le combo
de référence est ×2,2 — celui qu'on tient en moyenne, pas son maximum de ×3.

```
rapport actif / passif = (minage + par clic hors combo × combo × clics/s) / minage
```

Mesuré en simulation sur **90 jours et 28 prestiges**, à 5 clics/s :

| Temps de jeu | 1 min | 10 min | 1 j | 7 j | 14 j | 30 j | 60 j | 90 j |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Actif / passif | 3,65× | 2,91× | **2,75×** | **2,75×** | **2,75×** | **2,76×** | **2,75×** | **2,75×** |

Le rapport se stabilise en dix minutes et **ne dérive plus** : il est identique
au premier jour et au quatre-vingt-dixième, après vingt-huit renaissances. Sur
un scénario extrême de **300 prestiges forcés** (renaissance toutes les six
heures, empire jamais mûr), il descend à 1,91× — le jeu actif reste toujours
devant le jeu passif, jamais l'inverse.

Le rapport suit l'effort réel, **sans plafond** — mesuré à 7 jours de jeu :

| Clics/s | 2 | 3 | **5** | 7 | 10 | 15 | 20 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Actif / passif | 1,70× | 2,04× | **2,75×** | 3,46× | 4,51× | 6,29× | 8,06× |

Doubler la cadence double l'écart au passif, à l'infini : les joueurs rapides
dépassent donc 3× sans que rien ne les en empêche. Le rapport est visible dans
**Profil → Statistiques**, pas au centre de l'écran.

### Les deux boutons de réglage

Ils vivent dans [`src/data/tuning.json`](src/data/tuning.json), section
`balance`, et ont été mesurés plutôt que devinés :

| Réglage | Valeur | Effet mesuré |
| --- | --- | --- |
| `click_share` | 0,06 | **Le levier utile.** 3 % → 2,41× · 5 % → 2,63× · 6 % → **2,75×** · 7 % → 2,85× |
| `click_price_factor` | 1 | Quasi sans effet sur un empire mûr (1,5 → 1 ne déplace le rapport que de 2,74× à 2,75×), mais remonte le plancher des parties à prestiges répétés de 1,76× à 1,91× |

Le prix est un levier faible parce que les prix sont exponentiels : diviser le
prix des Cliqueurs par 2,5 ne fait acheter que deux exemplaires de plus par
rang. C'est **l'échelle des valeurs**, pas les prix, qui fixe le rapport.

### Combo

Cliquer sans interruption fait monter un multiplicateur jusqu'à ×3 en trente
clics ; s'arrêter le fait retomber en quelques secondes.

## Le jeu

- **16 bâtiments** : 8 Cliqueurs et 8 Mineurs, aux prix géométriques (×1,15 par
  exemplaire), sans mur de progression.
- **Améliorations infinies** : générées à la demande. Chaque bâtiment débloque
  un palier à 10, 25, 50, 100, 200, 400 exemplaires puis tous les ×1,7 — ×2,
  puis ×3, puis ×5. Il n'y a pas de dernière amélioration.
- **26 quêtes** réparties en 8 catégories (clic, banque, achat, production,
  crypto, événement, style, quotidien). Trois quêtes actives, trois
  quotidiennes, une série de jours consécutifs, et un bouton pour passer une
  quête qui ne te plaît pas.
- **Économie CrumbCoin** : cours variable avec retour à la moyenne, achat/vente
  avec 2 % de frais, cinq machines de minage qui tournent même hors-ligne, et
  du staking à paliers verrouillés (5 % à 120 % APR) qui booste toute la
  production.
- **Arbre céleste** : 8 améliorations permanentes achetées avec les chips de
  prestige, dont six sans niveau maximum. Elles survivent à toutes les
  renaissances suivantes.
- **53 succès** en 9 catégories, avec récompense en cookies.
- **Événements** : cookies dorés, pluie de miettes, cookie volant, ventes flash.
- Progression hors-ligne, sauvegarde automatique, export/import, mode contraste
  élevé, animations réduites, réglage du volume.

Six onglets : Boutique (filtres Tout / Clic / Minage), Améliorations, Quêtes,
CRMB, Prestige, Profil (statistiques, succès, apparences).

### Ce qu'une ligne de boutique annonce

Trois informations, jamais mélangées :

```
🖱️  Curseur ×1 320                                    2,41M
    +0,25 /clic de base          ← valeur propre, elle ne bouge jamais
    Gain réel  +60 /clic         ← ce que CET achat ajoute, ici et maintenant
    329,97K → 330,03K /clic      ← avant → après
```

La valeur propre est le nombre rond de la fiche. Le gain réel est calculé avec
la formule du jeu, paliers, chips et staking compris — le chiffre annoncé est
celui que tu obtiendras. L'avant → après situe le gain dans l'échelle du moment,
et devient illisible tout seul quand l'empire est énorme : c'est exactement
pourquoi la ligne « gain réel » existe.

Un Mineur en affiche deux, chacun dans son unité :

```
🌀  Portail ×3
    +100 000 /s de base
    Gain réel  +100 000 /s   +6 000 /clic
    1,20M → 1,30M /s
```

Un objectif permanent reste visible sous le cookie : « Prochain palier : 24/25
Exosquelette ×2 » ou « Prochain achat dans ~18 s ».

### Aucun achat inutile

Le gain marginal du N+1-ième exemplaire, tous bâtiments déjà possédés à N :

| N | Curseur | Singularité | Four | Portail |
| --- | --- | --- | --- | --- |
| 0 | +0,25 /clic | +10 000 /clic | +2 /s · +0,12 /clic | +100 000 /s · +6 000 /clic |
| 10³ | +0,25 | +10 000 | +2 · +0,12 | +100 000 · +6 000 |
| 10⁶ | +0,25 | +10 000 | +2 · +0,12 | +100 000 · +6 000 |
| 10⁹ | +0,25 | +10 000 | +2 · +0,12 | +100 000 · +6 000 |

Le gain ne décroît jamais. Au-delà de 10¹² exemplaires **de chaque bâtiment**,
un +0,25 passe sous la précision d'un flottant 64 bits ; cet état est de toute
façon inatteignable, le prix du 10¹²-ième Curseur dépassant l'infini
représentable.

Raccourcis : `Ctrl`/`Cmd` + `1‑6` pour changer d'onglet, `Maj` + clic pour
acheter ×10, `Ctrl` + clic pour ×100.

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
