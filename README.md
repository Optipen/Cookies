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
| `npm test`          | Suite de tests (110 tests)                    |
| `npm run test:watch`| Tests en continu                              |
| `npm run coverage`  | Rapport de couverture                         |
| `npm run lint`      | ESLint                                        |

## Le jeu

- **15 bâtiments** répartis en deux familles : production automatique (CPS) et
  puissance de clic (CPC), avec des synergies croisées et un renchérissement
  par paliers de possession.
- **26 quêtes** réparties en 8 catégories (clic, banque, achat, production,
  crypto, événement, style, quotidien). Trois quêtes actives, trois
  quotidiennes, une série de jours consécutifs, et un bouton pour passer une
  quête qui ne te plaît pas.
- **Économie CrumbCoin** : cours variable avec retour à la moyenne, achat/vente
  avec 2 % de frais, cinq machines de minage qui tournent même hors-ligne, et
  du staking à paliers verrouillés (5 % à 120 % APR) qui booste toute la
  production.
- **Arbre céleste** : 8 améliorations permanentes achetées avec les chips de
  prestige. Elles survivent à toutes les renaissances suivantes.
- **50 succès** en 9 catégories, avec récompense en cookies.
- **Événements** : cookies dorés, pluie de miettes, cookie volant, ventes flash.
- Progression hors-ligne, sauvegarde automatique, export/import, mode contraste
  élevé, animations réduites, réglage du volume.

Raccourcis : `Ctrl`/`Cmd` + `1‑8` pour changer d'onglet, `Maj` + clic pour
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
