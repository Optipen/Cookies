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
| `npm test`          | Suite de tests (136 tests)                    |
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
par clic        = (puissance clic + minage × 3 %) × combo
```

Les deux sommes sont **linéaires et sans plafond** : le millionième Cliqueur
ajoute exactement autant que le premier. Il n'existe aucune asymptote, aucun
softcap, aucun ×13.

### Valeurs propres et additives

| Cliqueurs | | Mineurs | |
| --- | --- | --- | --- |
| Curseur | +0,25 /clic | Four | +2 /s |
| Mamie | +1 | Boulangerie | +10 |
| Gant de frappe | +5 | Ferme | +50 |
| Bras robotisé | +25 | Usine | +250 |
| Exosquelette | +100 | Banque | +1 000 |
| IA de frappe | +500 | Temple | +5 000 |
| Machine à Temps | +2 500 | Laboratoire | +25 000 |
| Singularité tactile | +10 000 | Portail | +100 000 |

L'addition est exacte : puissance 1 + un Curseur = **exactement 1,25**. Les
multiplicateurs nets (×2, ×3, ×5) sont réservés aux paliers de possession
(10, 25, 50, 100, 200, 400, puis ×1,7).

### Comment le rapport reste tenu sans plafond

Un Mineur vaut dix fois son Cliqueur de même rang, et coûte 1,5 fois moins.
C'est cette échelle de valeurs — pas un amortissement — qui fixe le rapport
entre jeu actif et jeu passif. Mesuré en simulation sur 7 jours et 21
prestiges, à 7 clics/s et combo moyen ×2,2 :

| Temps de jeu | 1 min | 10 min | 1 j | 3 j | 7 j |
| --- | --- | --- | --- | --- | --- |
| Actif / passif | 3,77× | 2,78× | **2,98×** | **2,98×** | **2,98×** |

Le rapport suit l'effort réel : 3 clics/s → 1,83× · 5 → 2,40× · 7 → 2,98× ·
12 → 4,43×. Il est visible dans **Profil → Statistiques**, pas au centre de
l'écran.

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

Chaque achat affiche l'avant → après (`1 → 1,25 /clic`) et un objectif permanent
reste visible sous le cookie : « Prochain palier : 24/25 Exosquelette ×2 » ou
« Prochain achat dans ~18 s ».

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

**Les formules vivent au même endroit.** `deriveStats(state)` produit CPS, CPC,
part de clic et coûts. La boutique affiche le gain réel calculé avec cette
fonction, jamais une approximation : le chiffre annoncé est celui que tu
obtiendras.

**Les particules ne passent pas par React.** Elles vivent dans un ref et sont
animées en `requestAnimationFrame` qui écrit directement dans le DOM et
s'arrête dès que la scène est vide. La pluie de miettes tombe en animation CSS.
Aucune image ne déclenche de rendu React.

Le réglage de l'équilibrage vit dans [`src/data/tuning.json`](src/data/tuning.json) :
fenêtre de début de partie, fréquence des événements, cadence des boucles,
rendement hors-ligne, paliers de prix.

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
