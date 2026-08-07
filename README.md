# Crumbora 🍪

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
| `npm test`          | Suite de tests (564 tests)                    |
| `npm run test:watch`| Tests en continu                              |
| `npm run coverage`  | Rapport de couverture                         |
| `npm run lint`      | ESLint                                        |

## Équilibrage : deux axes, aucun plafond

Le jeu tourne sur deux axes qui fonctionnent **en même temps** :

- **Puissance de clic** — les cookies gagnés à chaque clic, portée par les
  **Cliqueurs** ;
- **Minage** — les cookies générés chaque seconde, porté par les **Mineurs**.

### La règle des nombres : quarts sous cent, entiers dès cent

**Aucun multiplicateur visible n'est le résultat d'un calcul.** Ils sont tous
pris sur une grille, en pas de 0,25 à toute magnitude :

```
×1 · ×1,25 · ×1,50 · ×1,75 · ×2 · ×2,25 · ×2,50 · ×2,75 · ×3 …
```

Les **valeurs** — cookies, production, prix, gains, bonus — suivent une règle
à deux étages :

- **sous cent**, seuls les quarts existent : `0 · 0,25 · 0,50 · … · 99,75` ;
- **à partir de cent**, seuls les entiers : `100 · 125 · 402 · 1 910 · 20 100`.

Un « 401,75 par clic » ou un « 125,50 » n'existe plus, ni à l'écran ni dans la
banque : c'est la valeur **créditée** qui respecte la règle, pas seulement son
affichage. Le **CRMB est l'exception assumée**, au centième — voir sa section.
Ce n'est pas un arrondi d'affichage : la valeur montrée **est** la valeur
utilisée dans la formule. Un ×1,02 ou un ×2,08 n'est donc pas corrigé, il est
impossible à produire. Les seuils et récompenses suivent l'échelle
`1 · 2,5 · 5 · 10 · 25 · 50 · 100 · 250 …`.

Rien ne donne « +2 % ». Une source de bonus fait **franchir un palier**, et
franchir un palier ajoute exactement +0,25. Entre deux paliers le nombre ne
bouge pas — c'est une barre de progression qui montre ce qu'il reste, parce
qu'un palier qu'on voit approcher se remarque mieux qu'un pourcentage qui
grignote.

Tout vit dans [`src/utils/grid.js`](src/utils/grid.js).

### La formule

```
crans      = paliers(chips) + paliers(staking) + niveaux(arbre céleste)
           + contrats(Registre) + niveaux(Éclat)
global     = 1 + 0,25 × crans                        ← un multiple de 0,25, toujours
valeur(b)  = grille↓(valeur_base(b) × palier(b) × global)   ≥ valeur_base(b)
minage     = grille↓(Σ(mineurs × valeur(b)) × buff)
puiss. clic= grille↓(1 + Σ(cliqueurs × valeur(b)) + grille↓(minage × 6 %))
par clic   = grille↓(puissance clic × combo)  ≥ puissance clic
combo      = 1 + 0,25 × niveau,  niveau de 0 à 3
prix       = quart de 10^⌊log₁₀⌋ au-delà de 100 000, remises comprises
```

La **quantification par exemplaire** (`grille↓`) est ce qui garantit que le
nombre affiché est le nombre calculé. Sans elle, le Curseur — seul bâtiment dont
la valeur de base n'est pas entière — sortait de la grille pour 73 % des
multiplicateurs: `0,25 × 2,5 = 0,625`, que l'écran arrondissait en « +0,63 ».
Les quinze autres ont une valeur entière et ne sont pas concernés, entier × (k/4)
tombant toujours sur la grille. `grille↓` porte les deux étages de la règle :
quart en dessous de cent, entier au-delà — avec une conséquence assumée et
testée : au-delà de cent de puissance, le +0,25 d'un Curseur seul se
matérialise en **+1 tous les quatre exemplaires**, jamais en perte.

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

Un Mineur vaut **huit fois** son Cliqueur de même rang, et le Cliqueur coûte
**trois quarts** du prix du Mineur (`click_price_factor`). Le premier achat de
la partie est donc un vrai choix : produire pendant que tu ne joues pas, ou
frapper plus fort — un peu moins cher — quand tu joues.

| Rang | Cliqueur | | Mineur | | Prix de base (Mineur) |
| --- | --- | --- | --- | --- | --- |
| 1 | Curseur | +0,25 /clic | Four | +2 /s | 100 |
| 2 | Mamie | +1 | Boulangerie | +8 | 1 000 |
| 3 | Gant de frappe | +5 | Ferme | +40 | 10 000 |
| 4 | Bras robotisé | +25 | Usine | +200 | 100 000 |
| 5 | Exosquelette | +100 | Banque | +800 | 1 000 000 |
| 6 | IA de frappe | +500 | Temple | +4 000 | 10 000 000 |
| 7 | Machine à Temps | +2 500 | Laboratoire | +20 000 | 100 000 000 |
| 8 | Singularité tactile | +10 000 | Portail | +80 000 | 1 000 000 000 |

Un rang coûte dix fois le précédent et rapporte cinq fois plus : il devient
rentable après quelques exemplaires de celui d'en dessous, ce qui fait
apparaître un nouveau bâtiment toutes les trois à cinq minutes.

L'addition est exacte : puissance 1 + un Curseur = **exactement 1,25**. Le prix,
lui, croît de 22 % par exemplaire.

**Un Mineur rapporte deux gains, dans deux unités différentes.** Un Portail
donne **+80 000 /s de minage** *et*, par la part reversée, **+4 800 /clic**.
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
       402         ≈4,25 /s        ≈1 708 /s
   ─────────────────────────────────────────
     ⛏️ 1 330/s  +  👆 ≈1 708/s  =  ≈3 038/s
```

La **cadence est mesurée**, pas supposée : moyenne glissante sur trois secondes,
publiée à 5 Hz, éteinte après une seconde et demie sans clic. Elle s'affiche
**arrondie au quart** — ≈4 · ≈4,25 · ≈4,50, jamais ≈4,12 — et préfixée de
« ≈ » : le quart est la précision de toute la grille du jeu, et c'est la seule
précision honnête pour une moyenne glissante. La **production des clics en
découle** — « par clic × cadence affichée », repliée sur la règle des valeurs —
si bien que le joueur peut refaire le calcul de tête ; comme elle est estimée,
elle porte le même « ≈ », et le total avec elle tant qu'on clique. Au repos, le
total vaut le minage **exactement**, sans ≈.

Elle ne compte que les **clics crédités**. Sinon l'écran afficherait « ≈50 /s »
à côté de « 12 par clic » et le joueur multiplierait deux nombres qui ne se
multiplient pas : la banque n'en crédite que quinze. Quand la cadence brute
dépasse cette borne, le jeu le dit sous la barre au lieu de laisser croire
qu'accélérer sert encore.

Les cinq chiffres sont calculés dans **un seul endroit**, `productionStats`, et
non dans le composant : c'est ce qui permet de prouver par test qu'au repos le
total vaut le minage **exactement**, et que le minage n'est jamais compté deux
fois. La part reversée fait bien qu'un Mineur augmente aussi la puissance de
clic — mais c'est un gain versé *à chaque clic*, dans une autre unité, et il
disparaît intégralement dès que la cadence tombe à zéro. Aucun double comptage
ne ferait cela.

### Un nombre affiché est le nombre calculé

Tout le formatage passe par [`src/utils/format.js`](src/utils/format.js), et une
règle prime sur les autres : **le texte à l'écran se relit à l'identique**.

| Ce qui s'écrivait | Ce qui s'écrit | Pourquoi |
| --- | --- | --- |
| `401,75` | `401` (la valeur VAUT 401) | Dès cent, la règle interdit les décimales — le pli va vers le bas, à la banque comme à l'écran |
| `1,3` | `1,25` | Sous cent, les quarts s'affichent entiers de quarts, sans décimale supprimée |
| `1,72K` | `1 720` | Une abréviation qui fabrique une décimale là où le nombre n'en avait pas |
| `1 230K` | `1,23M` | **Une seule unité par palier** : un compteur qui monte ne redescend pas d'unité |
| `2 000K` | `2M` | Même cause : « deux mille K » ne se lit pas comme deux millions |
| `1B` (pour 999 999 999) | `999M` | Le compact ne franchit jamais un palier à la place du joueur |
| `1 248K` | `1,248M` | Un prix exact se lit maintenant dans l'unité du solde |
| `×1500000000` | `×1,5B` | Le cas entier de `fmtMult` partait droit sur `String(v)`, sans séparateur |
| `120h 00m` | `5j 00h` | Un nombre d'heures à trois chiffres se calcule, il ne se lit pas |

#### Une seule unité par palier

C'est la règle qui a coûté une refonte. L'ancienne refusait toute décimale
derrière un suffixe et **descendait d'un cran** pour l'éviter. La suite affichée
sautait alors d'une unité à l'autre, et revenait en arrière :

```
999K → 1M → 1 100K → 1 200K → 2M → 2 500K → 20 900K → 123M
```

Personne ne lit ça comme une progression. La même suite aujourd'hui — trois
chiffres significatifs, **tronqués**, dans la plus grande unité qui laisse une
mantisse au-dessus de un :

```
999K → 1M → 1,02M → 1,05M → 1,1M → 1,2M → 2M → 2,5M → 20,9M → 123M → 1B
```

Trois chiffres significatifs, parce que c'est le plus petit nombre qui laisse
**voir** un compteur monter : à deux, `1,2M` resterait figé cent mille cookies
durant. Tronqués et non arrondis, parce qu'un joueur à 999 999 cookies n'a pas
un million — `999K` est vrai, `1M` ne l'est pas encore. Et les zéros de queue
tombent : `2M`, pas `2,00M`.

Deux propriétés sont vérifiées par balayage sur toute la plage du jeu : **l'unité
affichée ne redescend jamais** quand le nombre monte, et **le texte relu n'est
jamais supérieur à la valeur**.

On n'abrège qu'à partir de **cent mille** (`COMPACT_FROM`) : en dessous, le
nombre entier tient à l'écran et se lit d'un coup. Au-delà du dernier suffixe,
on passe en notation scientifique plutôt que d'inventer un nom d'unité.

Sept formateurs, chacun pour un usage :

| | Pour quoi | Exemple |
| --- | --- | --- |
| `fmt` | tout nombre de gameplay | `99,75` · `1 720` · `1,23M` |
| `fmtExact` | valeur de fiche, jamais abrégée | `80 000` |
| `fmtInt` | le solde, en entier | `1 234` · `1,23M` |
| `fmtPrix` | un prix — **exact au cookie près** | `124 800` · `1,248M` · `27,5B` |
| `fmtMult` | multiplicateur de grille | `×1,50` · `×2` · `×1,5B` |
| `fmtApprox` | valeur **mesurée ou estimée** | `≈4,25` |
| `fmtCrmb` | montant CRMB, centimes | `1` · `1,5` · `1,05` · `<0,01` |

`fmtPrix` garde sa garantie propre — **le prix affiché est le prix payé** — mais
la porte désormais dans l'unité du solde : `1,248M` plutôt que `1 248K`.
Comparer `1 248K` à un solde de `1,2M` demandait une conversion mentale à chaque
achat. Un prix qui ne tombe pas juste s'écrit toujours en toutes lettres, aussi
long soit-il (`1 248 300`).

Le préfixe `≈` n'est pas décoratif : il distingue une valeur calculée d'une
valeur mesurée sur une fenêtre glissante. Écrire une cadence « 4,3 /s » tout
court serait faussement précis.

### L'achat groupé ne paie jamais plus que les achats un par un

`×10` n'est jamais une pénalité cachée. Chaque exemplaire est remisé, arrondi
et **posé sur la grille des prix séparément**, puis les prix sont additionnés.
Appliquer la remise à la somme puis arrondir une seule fois rendait le lot
moins cher : mesuré, 99 822 au lieu de 99 825 sur dix Boulangeries quand la
réduction du prestige (×0,95) et une remise générale (×0,75) se cumulaient.
Trois cookies, mais c'est un écart que rien n'annonce et qui grandit avec le
lot. Un seul cas fait dévier la somme : quand le lot traverse un ordre de
grandeur, elle est repliée vers le **bas** sur la grille d'affichage — au pire
un quart de cran de moins, jamais un de plus.

### Automatisation : ce qui est protégé, et ce qui ne peut pas l'être

**Cette protection est entièrement côté client, et elle ne prétend pas être
inviolable.** Le jeu n'a pas de serveur : la partie vit dans le `localStorage`
du navigateur et tout le code tourne sur la machine du joueur. Quelqu'un qui
veut vraiment tricher peut modifier la sauvegarde dans les outils de
développement, appeler les fonctions du jeu depuis la console, ou recompiler le
bundle sans [`src/utils/anticheat.js`](src/utils/anticheat.js). Rien de ce qui
suit ne l'en empêche, et rien ne le pourrait sans validation serveur. Une
vérification qui tombe est aussi contournable par un simple rechargement : elle
n'est pas persistée, précisément pour qu'un bug ne puisse enfermer personne.

Ce qui est réellement traité : l'autoclicker **ordinaire**, celui qu'on installe
en extension ou qu'on branche sur la souris. C'est la triche que rencontrent
99 % des joueurs, parce qu'elle ne demande aucune compétence.

Deux mécanismes, qui ne font pas la même chose :

**Le seau à jetons** borne ce que le jeu crédite : quinze clics par seconde en
régime établi, plus une réserve de huit pour les rafales. Il ne juge personne,
il compte. Un joueur rapide ne le touche jamais — mesuré, tout passe jusqu'à
douze clics/s avec une gigue humaine. Un autoclicker s'y heurte en permanence.

| Cadence brute | Cadence créditée | Rapport actif/passif à 30 j |
| --- | --- | --- |
| 7 clics/s (joueur très actif) | 7 | 3,27× |
| 15 clics/s | 15 | 5,92× |
| 50 clics/s | 15 | 5,92× |
| 1 000 clics/s | 15 | 5,92× |

Le profil « autoclicker 50/s » et le profil « 15 clics/s » produisent des
tableaux **rigoureusement identiques**, chiffre pour chiffre, sur les onze
horizons. C'est la preuve la plus directe que la borne tient.

**Ce que la borne fait, et ce qu'elle ne fait pas.** Elle plafonne le rapport
actif/passif à **1,8× celui d'un joueur très actif** en régime établi (6,13×
contre 3,47× au trois-cent-soixante-cinquième jour). Elle ne supprime pas
l'avantage : sur un an, la production totale d'un autoclicker borné reste
environ **dix fois** supérieure, parce que l'avance se compose à travers les
renaissances et les ascensions. Et sur la première heure, avant que l'économie
ne se stabilise, le rapport monte à 12,3× contre 3,8×. Borner la cadence
transforme un écart illimité en écart fini — ce n'est pas la même chose que de
le supprimer, et prétendre le contraire serait faux.

**Le score de suspicion** observe la *forme* du geste : régularité des
intervalles, cadence surhumaine soutenue, clics reçus onglet caché, absence
totale de pause sur dix minutes, nombre de doigts impossible, rafales à la même
fréquence exacte. Aucun signal ne suffit seul, et **chaque signal ne compte
qu'une fois toutes les dix secondes** : compté par clic, un joueur dont
l'extension d'accessibilité produit des événements non fiables atteignait le
seuil en quinze secondes sans rien avoir fait de mal. Le score retombe d'un
point par seconde, donc jouer normalement suffit à revenir à zéro.

Au-delà du seuil, le jeu demande **une vérification humaine d'un seul geste** :
trois nombres, on appuie sur celui que l'énoncé nomme. Pendant ce temps, le
minage continue, la sauvegarde est intacte, rien n'est retiré, et une mauvaise
réponse repose simplement la question. **Aucun bannissement, jamais** : sans
preuve serveur, punir sur un soupçon calculé chez le joueur, c'est punir des
innocents.

Une vérification **n'apparaît jamais parce que le joueur est inactif**. Ne pas
cliquer est une façon légitime de jouer — le minage tourne tout seul.

### CRMB : rare, en centimes, et jamais détruit par erreur

Le CRMB est une monnaie de **récompense**. On en gagne en terminant des quêtes
(dix des vingt-six en donnent, 1 à 5 pièces), en décrochant les succès qui
comptent (0 · 0 · 1 · 2 · 5 selon le palier, 53 pièces pour les cinquante-cinq
succès réunis), en renaissant (+5), et par le matériel d'extraction — jamais en
cuisant des cookies. Le faucet historique versait 0,001 CRMB tous les 20 000
cookies, soit des centaines de millions en fin de partie.

**Le CRMB vit en centimes** — c'est son exception à la règle des quarts. Tout
arrondi monétaire est au centième, l'affichage ne dépasse jamais deux
décimales et retire les zéros inutiles (« 1 », « 1,5 », « 1,05 »). Ce qui est
plus fin qu'un centime ne se perd pas : le rendement d'un tic — sept
millionièmes de CRMB pour un vieux CPU — s'accumule dans une réserve interne
et ne se verse au solde que par centimes pleins. Le taux d'extraction est posé
au centième par heure **dans le moteur** : « 0,06 CRMB/h » à l'écran, c'est
0,06 crédité, pas 0,0625. Le cours du marché est un **entier de cookies**, et
chaque échange règle ses deux jambes dans leur règle : centimes de CRMB contre
entiers de cookies, arrondis contre le joueur d'au plus un cookie — plafond à
l'achat, plancher à la vente.

**Un solde valide n'est jamais détruit par un calcul invalide.** `addCrmb`
rejette le seul delta fautif et conserve le solde. Écrire
`roundCrmb(solde + delta)` paraît équivalent, mais si `delta` vaut `NaN` la
somme vaut `NaN`, l'arrondi rend 0, et le joueur perd son portefeuille entier
parce qu'un rendement s'est mal calculé pendant un tic. C'est exactement ce qui
s'était produit au retour hors-ligne : le solde affichait « ∞ », puis zéro au
rechargement. Toutes les écritures de solde passent désormais par là.

### Le Registre : un puits qui ne se tarit pas

Les deux apparences payables en CRMB coûtent trente-cinq pièces en tout. Passé
cet achat, la monnaie n'avait plus rien à acheter — on continuait d'en gagner
sans jamais la dépenser, ce qui revient à ne plus en gagner du tout.

Un **contrat du Registre** est un achat définitif : +0,25 à la puissance de clic
**et** au minage, pour toujours, et il survit aux renaissances. C'est le
contraire du staking, qui prête le même bonus tant que le CRMB reste bloqué et
le reprend au retrait. Le choix est réel : garder sa mise liquide, ou la
convertir une fois pour toutes.

| Contrat | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Prix (CRMB) | 10 | 25 | 50 | 100 | 250 | 500 | 1 000 | 2 500 |
| Cumul | 10 | 35 | 85 | 185 | 435 | 935 | 1 935 | 4 435 |

Le bonus porte sur les **deux axes du même cran** : un puits qui ne pousserait
que le minage déplacerait l'équilibre actif/passif à chaque achat.

### L'Ascension : ce qu'il reste à faire après le quatrième jour

Le problème, mesuré avant d'écrire une ligne :

- **tout le contenu du jeu était découvert en 3 h 54.** Trois cent soixante
  jours plus tard, il n'y avait toujours rien de neuf à attendre ;
- la production passait de 1,07e9/s au trentième jour à 5,69e9/s au
  trois-cent-soixante-cinquième — un facteur 5,3 en onze mois.

Le prestige ne pouvait pas corriger ça, et pour une raison structurelle : les
chips valent la **racine cubique** de la production totale, et leur bonus est
**logarithmique** en chips. Le levier s'aplatit deux fois. Rendre les prestiges
plus généreux n'aurait fait que déplacer le mur.

Ce qu'il fallait, c'est du **contenu** — des bâtiments qui n'existaient pas.

```
clics → bâtiments → paliers → prestige (chips) → ASCENSION (étoiles)
```

Une ascension emporte la partie, les chips **et** l'arbre céleste. Elle garde
les étoiles, la Voûte, le portefeuille CRMB, le Registre, les apparences et les
succès. Elle s'ouvre à **5 000 chips** — autour du dixième jour, une fois que le
prestige a donné ce qu'il avait.

Trois voies, qui ne font pas la même chose :

| Voie | Effet | Plafond | Coût |
| --- | --- | --- | --- |
| 🌅 **Horizon** | un nouveau rang de Cliqueur **et** de Mineur | 4 | 1 · 2 · 4 · 8 ⭐ |
| ✨ **Éclat** | +0,25 sur les deux axes | aucun | 1 · 2 · 3 · 4 … ⭐ |
| 🔔 **Écho** | +25 % de chips à la renaissance | 8 | 2 · 4 · 6 · 8 … ⭐ |

Horizon est le cœur : il ouvre huit bâtiments qui n'existaient pas, de l'Essaim
de mains au Big Bake, chacun avec ses propres paliers à conquérir. Les deux
familles restent exactement parallèles jusqu'au dernier rang — un Mineur vaut
toujours huit fois son Cliqueur. Et les anciens bâtiments ne deviennent jamais
inutiles : un rang neuf coûte dix fois plus pour cinq fois plus par exemplaire,
donc les anciens gardent le meilleur rendement par cookie tant qu'on n'en a pas
beaucoup.

**Résultat mesuré**, à cinq clics par seconde, stratégie « optimiser » :

| Borne | Sommet atteint | Bâtiments | Prestiges | Ascensions | Étoiles |
| --- | --- | --- | --- | --- | --- |
| 1 h | 84 793/s | 8 | 2 | 0 | 0 |
| 1 j | 1,60e8/s | 16 | 11 | 0 | 0 |
| 7 j | 5,50e8/s | 16 | 14 | 0 | 0 |
| **30 j** | **1,79e10/s** | **23** | 77 | 4 | 21 |
| 90 j | 4,95e11/s | 24 | 100 | 5 | 33 |
| 365 j | 1,29e12/s | 24 | 127 | 6 | 51 |

Du trentième au trois-cent-soixante-cinquième jour, la production est
multipliée par **72** au lieu de 5,3. Et la dernière nouveauté du jeu — le Big
Bake — arrive au **trentième jour** au lieu de la quatrième heure.

Ce qui reste imparfait : entre le quatre-vingt-dixième et le
trois-cent-soixante-cinquième jour, la production n'est plus multipliée que par
2,6. Horizon est complet à ce stade, et seuls l'Éclat et l'Écho continuent.
C'est mieux qu'un plateau, ce n'est pas une courbe qui tient un an.

### Rattraper une mauvaise partie

Un joueur qui a tout mis au mauvais endroit ne doit pas être condamné. Trois
choses le rattrapent, et elles sont mesurées : le prestige et l'ascension
remettent le parc à zéro en gardant les bonus permanents ; l'Éclat, le Registre
et les chips poussent les **deux** axes du même cran, quelle que soit la
répartition des achats ; et l'écart entre la meilleure et la pire stratégie
d'achat reste **sous un facteur 1 000** sur six heures de jeu simulé, contre un
facteur 18 000 mesuré avant cette refonte.

### Notifications : une file, pas une trappe

L'ancienne version **écartait** ce qui arrivait pendant le silence. Un joueur
qui décrochait trois succès d'affilée n'en voyait qu'un : les deux autres
n'existaient plus. Elle est remplacée par une vraie file
([`src/utils/notices.js`](src/utils/notices.js)), écrite en fonctions pures —
c'est ce qui permet de **mesurer** ce qu'une session produit au lieu de
l'estimer.

| Règle | Valeur | Pourquoi |
| --- | --- | --- |
| Silence entre deux ordinaires | 16 s | Une notification qu'on n'a pas le temps de lire n'informe personne |
| File bornée | 6 entrées | Une file sans limite ne supprime pas l'avalanche, elle la reporte |
| Péremption | 90 s | Passé ce délai, le message parle d'une partie qu'on ne joue plus |
| Déduplication | 45 s | Le même texte ne revient pas coup sur coup |
| Regroupement | 1 s | Dix succès simultanés font **une** ligne, avec « ×10 » |
| Écart entre majeurs | 6 s | Une renaissance passe devant, mais pas en rafale |
| **Plafond des majeurs** | **3 / minute glissante** | Même un bug qui en déclencherait soixante ne peut pas saturer l'écran |

Les cookies dorés, qui s'annoncent déjà par eux-mêmes à l'écran, sont passés au
rang ordinaire : ils n'ont plus le droit de doubler la file. Mesuré sur une
session type (quêtes toutes les 45 s, succès toutes les 90 s, dorés toutes les
70 s, une renaissance toutes les 30 min) : **moins de 4 notifications par
minute** sur le premier quart d'heure comme sur une heure entière, et aucun
identifiant réaffiché deux fois.

Un achat ordinaire ne notifie rien : le chiffre monte sur sa propre carte. Un
achat refusé ne notifie rien non plus — le bouton tremble, c'est tout.

### Mobile : mesuré, pas supposé

Six gabarits, inspectés dans un vrai navigateur avec
[`scripts/mobile.mjs`](scripts/mobile.mjs) — position réelle des éléments,
taille réelle des cibles, taille réelle des polices.

| Gabarit | Haut de la boutique | Écran | Débordement | Cibles < 44 px | Textes < 11 px |
| --- | --- | --- | --- | --- | --- |
| iPhone SE 320×568 | **528 px** | 568 | non | 0 | 0 |
| iPhone 8 375×667 | 592 px | 667 | non | 0 | 0 |
| iPhone 14 390×844 | 592 px | 844 | non | 0 | 0 |
| iPhone 14 Pro Max 430×932 | 592 px | 932 | non | 0 | 0 |
| Tablette 768×1024 | 947 px | 1024 | non | 0 | 0 |
| Ordinateur 1440×980 | 322 px | 980 | non | 0 | 0 |

**Sur un iPhone SE, la boutique commençait à 709 px — entièrement sous la ligne
de flottaison.** Trois choses la faisaient descendre :

- **l'en-tête tenait sur trois lignes** en 320 px : le titre, puis quatre
  pastilles, puis le bouton de réglages tout seul. Il tient maintenant sur une
  ligne, et les deux pastilles que la barre de production répète mot pour mot
  (« Par clic », « Minage ») disparaissent sous `sm` ;
- **le total cuit et les compteurs décoratifs** occupaient deux lignes sans
  servir à la moindre décision. Ils réapparaissent dès `xs` et restent dans
  Profil → Statistiques ;
- **le cookie faisait 208 px** ; il en fait 144 sur le plus petit écran, 192
  dès 360 px de large.

Les six boutons de la boutique — Tout / Clic / Minage et ×1 / ×10 / Max — sont
**toujours sur deux rangées**. Sur une seule, « ×10 » sortait de l'écran en
320 px et « Max » était coupé dans le panneau latéral de 400 px. Un point de
rupture par taille d'écran n'aurait pas suffi : le panneau reste large de
400 px même sur un écran de 1 440.

Le premier écran montre, sans défiler : le solde, les cinq statistiques
(par clic, cadence, production des clics, minage, total), le cookie, le combo
dès le premier appui, le prochain objectif, les filtres, le sélecteur de
quantité et le début de la boutique.

### Sauvegardes : rien ne se perd

Le schéma passe en **version 7** — les compteurs à vie sont un bloc qui
n'existait dans aucune sauvegarde antérieure (la v6 avait apporté l'Ascension
et le Registre). La version est écrite dans
la partie, et `migratedFrom` retient celle d'où l'on vient : sans elle, devant
une partie cassée, il est impossible de dire quelle transformation l'a produite.

L'ancienne clé de stockage **n'est jamais effacée**. Un joueur qui reviendrait
sur une version antérieure du jeu doit retrouver sa partie ; écraser sa clé la
lui prendrait définitivement. Une sauvegarde illisible est **archivée**, pas
supprimée.

Vérifié sur des sauvegardes réelles v3, v4, v5, v6 et v7 :

| Cas | Comportement |
| --- | --- |
| Combo hérité de l'échelle ×3 | Ramené à ×1,75 — un record inatteignable décrocherait un succès que personne ne peut obtenir |
| Bâtiments renommés, améliorations supprimées | Identifiants inconnus écartés, bâtiments conservés |
| Quantité négative | Écartée seule, le reste du parc intact |
| `NaN` / `Infinity` sur cookies, chips, CRMB, Registre, étoiles | Ramenés à une valeur finie positive |
| Nombres énormes (1e308) | Restent finis |
| Types entièrement faux (`null`, `42`, `[]`) | Partie neuve, sans exception levée |
| Objets manquants | Comblés par les valeurs par défaut |
| Fermeture brutale, sauvegarde partielle | Chargée, complétée |
| Horloge reculée / avancée de dix ans | Aucune valeur négative ni infinie |
| Buff, remise ou notification en cours | Jamais rejoués : le temps a passé |
| Migration jouée deux fois | **Résultat identique** — sinon chaque ouverture ferait dériver la partie |
| Sauvegarde d'avant les compteurs à vie | **Semés** depuis la partie en cours : un joueur à 80 000 clics ne repart pas de zéro |

### Le rythme

Le chiffre exact de cookies compte moins que la cadence. La mesure a changé de
nature avec cette passe : le simulateur voit désormais les **quêtes, les dorés
et les succès**, et le joueur simulé met **dix secondes à décider** un achat —
sans ce délai, on mesure une machine, pas un joueur. Objectifs, à cinq clics
par seconde, stratégie équilibre :

| Objectif | Cible | Mesuré | |
| --- | --- | --- | --- |
| Premier achat payé | 5–15 s | **8,9 s** | ✓ |
| Achats marquants, 1re minute | 2–4 | **2** | ✓ |
| Écart médian entre achats marquants, 0–5 min | 20–45 s | **30 s** | ✓ |
| Écart médian entre MOMENTS intéressants, 0–5 min | 20–45 s | **10 s** | plus dense que la cible |
| Premier vrai palier de bâtiment | 10–20 min | **13,4 min** | ✓ |
| Premier prestige | 60–120 min | **64 min** | ✓ |
| Première ascension | 5–20 j | **5,2 j** | ✓ |
| Dernière nouveauté du jeu | 7–60 j | **13,8 j** | ✓ |

Le « 73 s entre deux achats marquants » du constat précédent mesurait un jeu
**sans ses temps forts** — ni quêtes, ni dorés, ni succès — joué par un
optimiseur sans temps de décision. Compté honnêtement, l'écart entre achats
marquants tient la cible, et le rythme VÉCU — une quête rendue, un doré
attrapé, un succès décroché comptent aussi — descend à dix secondes en début
de partie, porté par la rafale d'apprentissage de la première minute. Le jeu
n'a pas été accéléré pour obtenir ces chiffres : c'est la mesure qui a été
réparée.

Le seuil de prestige a été choisi **par mesure** : une recherche par dichotomie
sur la production totale donne 29 min à 5 millions de cookies cuits, 61 min à
100 millions, 79 min à 250 millions et 116 min à 1 milliard. À cinq millions —
la valeur précédente — la première renaissance tombait à 29 minutes, avant même
le premier palier de bâtiment. Elle rapporte désormais 63 chips au lieu de 17 :
une première fois qui ne rapporte presque rien n'apprend rien.

### Les vagues de contenu

Ce qui apparaît, et quand, pour un joueur normal :

| Vague | Ce qui arrive |
| --- | --- |
| Première session | Four offert (0 s), Curseur (7 s), Boulangerie (1 min), Mamie (2 min), Ferme et Gant (5 min) |
| Première heure | Usine et Bras robotisé (13 min), premier bonus global et premier palier (19 min), Banque et Exosquelette (28 min), Temple (53 min) |
| Premières 24 h | Premier prestige (85 min), IA de frappe (1,2 h), Laboratoire (1,9 h), Machine à Temps (2 h), Portail et Singularité (3,9 h) |
| Jours 2–7 | L'arbre céleste se remplit, les paliers de bâtiment doublent, le Registre s'ouvre |
| Jours 7–30 | **Première ascension (10 j)**, puis huit bâtiments qui n'existaient pas : Colonie et Essaim (10,4 j), Sphère de Dyson et Volonté pure (13,6 j), Nébuleuse et Impact stellaire (17 j), Big Bake et Doigt du monde (28 j) |
| Après J30 | Éclat et Écho sans fin, contrats du Registre, paliers de bâtiment sur les nouveaux rangs |
| Après J90 | Plus de contenu neuf : seuls l'Éclat, l'Écho et les paliers continuent. **C'est la limite connue de cette refonte.** |

### Calibration : 5 clics/seconde, combo moyen ×1,50

La référence d'un joueur « normalement actif » est **5 clics/seconde**, pas 7 :
sept est une cadence de souris soutenue, intenable au pouce sur mobile. Le combo
de référence est **×1,50** — celui qu'on tient en moyenne sur une session hachée,
pas son maximum de ×1,75.

```
rapport actif / passif = (minage + par clic hors combo × combo × clics/s) / minage
```

Le rapport n'est pas mesuré sur un parc de bâtiments écrit à la main : une telle
main décrit un joueur qui n'existe pas. Il est mesuré en **faisant jouer une
partie** avec les vraies formules du jeu ([`src/sim/engine.js`](src/sim/engine.js)),
puis en relevant la **médiane** du rapport sur chaque période — un relevé unique
tombe au hasard juste après l'achat d'un Portail et saute de 3,2 à 4,6 sans que
l'équilibre ait bougé.

| Cadence | 10 min | 1 h | 6 h | 1 j | 30 j | 90 j | 365 j | Cible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 clics/s | 1,53× | 1,56× | 1,79× | 2,01× | 1,94× | 1,94× | 1,93× | 1,5–2,2× |
| **5 clics/s** | **2,56×** | **2,42×** | **2,56×** | **2,62×** | **2,61×** | **2,60×** | **2,59×** | **2,5–2,8×** |
| 7 clics/s | 3,81× | 3,80× | 3,41× | 3,31× | 3,28× | 3,27× | 3,25× | 3–4× |
| 15 clics/s (borne) | 10,4× | 12,3× | 6,31× | 5,93× | 5,92× | 5,90× | 5,88× | — |

Une seule case sort de sa fourchette : 2,42× à une heure pour le joueur normal,
au lieu de 2,50× au minimum. C'est un écart de 3 %, dû au caractère discret des
achats — on achète un Portail entier ou rien.

Le rapport suit l'effort réel, **sans plafond** : doubler la cadence double
l'écart au passif, à l'infini. La dernière ligne n'est pas une cible mais une
**mesure de ce qu'un autoclicker peut obtenir** : la cadence créditée est bornée
à 15 clics/s, donc son avantage l'est aussi. Il reste devant le joueur très
rapide, sans être hors d'atteinte. Le rapport est visible dans
**Profil → Statistiques**, pas au centre de l'écran.

### Ce qui fixe ce rapport

Un Mineur vaut exactement **huit fois** le Cliqueur de son rang. Une phrase
décrit tout le lien entre les deux familles :

| Rang | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cliqueur | 0,25 | 1 | 5 | 25 | 100 | 500 | 2 500 | 10 000 |
| Mineur | 2 | 8 | 40 | 200 | 800 | 4 000 | 20 000 | 80 000 |

Le facteur valait dix, sauf au rang 0 où il valait déjà huit. Cette exception
faussait le tout début de partie, et un facteur dix plaçait le joueur actif à
2,1× le joueur inactif au lieu des 2,5 à 2,8 visés.

### Les boutons de réglage

Tous dans [`src/data/tuning.json`](src/data/tuning.json), section `balance`, et
mesurés plutôt que devinés :

| Réglage | Valeur | Ce qu'il fait |
| --- | --- | --- |
| `price_scale` | 4 | Le temps de retour d'un achat, donc l'espacement entre deux achats. À 1 le premier achat tombait en 3 s et il s'en enchaînait 137 en dix minutes |
| `price_growth` | 1,22 | La vitesse générale. 1,15 → premier prestige à 30 min · 1,22 → 81 min · 1,30 → 41 min mais premier palier à 100 min |
| `tier_first` | 10 | Le premier palier de bâtiment. À 25, il n'arrivait qu'après une heure |
| `click_share` | 0,06 | Ajustement fin du rapport actif/passif. 5 % → 2,50× · **6 % → 2,60×** · 7 % → 2,66× à 5 clics/s |
| `click_price_factor` | 0,75 | Un Cliqueur coûte trois quarts du Mineur de son rang. Ne change pas le rapport de fin de partie, seulement les premières heures : à prix égal, les Cliqueurs accusaient deux exemplaires de retard par rang |
| `reference_combo` | 1,5 | Le combo moyen tenu sur une session hachée, pas le maximum |

Le prix unitaire est un levier faible sur un empire mûr — diviser le prix des
Cliqueurs par 2,5 ne fait acheter que deux exemplaires de plus par rang. C'est
**l'échelle des valeurs**, pas les prix, qui fixe le rapport actif/passif ; ce
sont les prix qui fixent le rythme.

### Combo

Quatre valeurs, et rien d'autre : **×1 · ×1,25 · ×1,50 · ×1,75**. La formule est
littéralement `1 + 0,25 × niveau`, le niveau allant de 0 à 3. Aucune valeur
intermédiaire ne peut apparaître — ni ×1,33, ni ×1,67, ni ×1,74.

Douze clics enchaînés par niveau, trente-six pour le maximum : **7,2 secondes à
cinq clics par seconde**. La jauge montre trois segments, le niveau atteint
(« niv. 2/3 ») et le suivant (« ×1,50 → ×1,75 »). S'arrêter déclenche un sursis
de 1,4 s, puis la chaîne retombe d'un niveau toutes les 1,3 s — elle descend
cran par cran au lieu de s'effondrer d'un coup.

Le combo montait à ×3 en huit crans. Un joueur en rafale valait alors trois fois
un joueur posé avant même d'avoir acheté quoi que ce soit, et le multiplicateur
écrasait tout le reste de l'économie. Une sauvegarde qui contient un record
hérité de l'ancienne échelle est ramenée au nouveau maximum.

### Console, mémoire, rendus

Mesuré dans un vrai navigateur avec
[`scripts/console.mjs`](scripts/console.mjs), sur une session de 1 600 clics
mêlant achats et changements d'onglet :

| | Résultat |
| --- | --- |
| Erreurs console | **0** |
| Avertissements console | **0** |
| Nœuds du document | 377, stable |
| Tas mémoire (ramasse-miettes forcé) | 5,4 Mo → 7,7 Mo |

Le ramasse-miettes est **forcé avant chaque mesure**. Sans cela, le même test
affichait 5 → 22 Mo — les déchets pas encore collectés, pas une fuite. C'est la
différence entre « mesuré » et « supposé ».

### Les limites des nombres

Question posée explicitement : le jeu bute-t-il sur la représentation des
nombres avant la fin de sa durée de vie ?

**Non, et de très loin.** En un an de jeu simulé, la production totale atteint
1,2e19. Les flottants montent à **1,8e308** : il faudrait plus d'un siècle de
jeu continu pour s'en approcher. Aucune représentation exotique n'est donc
nécessaire, et en introduire une coûterait la lisibilité de tout le code
économique pour un problème qui n'arrivera pas.

Ce qui est vrai, en revanche : **au-delà de 9,01e15 les entiers ne sont plus
exacts** — ce seuil est franchi vers le soixantième jour. C'est sans
conséquence : rien dans le jeu ne dépend du dernier cookie près, et l'affichage
n'en montre que trois chiffres significatifs. Mais il faut le savoir plutôt que
le découvrir.

Vérifié jusqu'à un parc d'un million de milliards de bâtiments avec 4 000
niveaux d'Éclat : production finie, strictement croissante, multiplicateur
toujours sur la grille, et affichage lisible — en notation scientifique une
fois le dernier suffixe dépassé, plutôt qu'un nom d'unité inventé.

### Reproduire les mesures

Les outils de mesure et de fabrication d'assets ne sont pas des dépendances du
projet : ils se lancent à la main, et ce qu'ils produisent est versionné — il
n'y a donc rien à installer pour construire ou déployer le jeu. Playwright,
son navigateur et `sharp` s'installent en une commande.

```bash
npm ci                        # installation reproductible
npm test                      # 564 tests
npm run lint                  # zéro avertissement, tout le dépôt
npm run build && npm run preview

npm run balance               # rapport actif/passif par cadence et par horizon
npx vite-node scripts/rivaux.mjs    # rejoue les sept rivaux du Classement
npm run simulations           # deux familles de profils, onze horizons
npm run simulations mecanique # une seule famille (plus rapide)

npm i --no-save sharp && node scripts/images.mjs   # regénère les images servies
node scripts/polices.mjs            # regénère les polices auto-hébergées

npm i playwright && npx playwright install chromium
npm run mobile                # six gabarits: cibles, textes, débordements
npx vite-node scripts/console.mjs   # erreurs console et mémoire

# Campagnes de vingt profils automatisés (contre `npm run preview`):
node qa/harness/campagne.mjs http://127.0.0.1:4173/ qa-artifacts/campagne-X
node qa/harness/planches.mjs http://127.0.0.1:4173/ qa-artifacts/planches-X
node qa/harness/analyse.mjs qa-artifacts/campagne-1 qa-artifacts/campagne-2
```

`CHROMIUM_PATH` force un navigateur précis quand l'environnement en fournit un
(image CI, conteneur) ; sinon Playwright utilise le sien.

### Les simulations

Le rapport complet — **quatre familles × onze horizons × dix-sept métriques** —
est dans [`docs/simulations.txt`](docs/simulations.txt), reproductible par
`npm run simulations` (ou par famille : `mecanique`, `sessions`, `complet`,
`fermetures`, `rythme`).

Quatre familles, qui ne mesurent pas la même chose :

- **Mécanique continue** : une cadence tenue en permanence. Sert à isoler
  l'effet d'un paramètre. Le rapport actif/passif y est directement comparable
  aux cibles (2,5–2,8× à cinq clics/s).
- **Vraies sessions** : `activeFraction` est la part du temps réellement passée
  à cliquer, l'onglet restant ouvert. Un joueur qui joue trente minutes par
  jour a une cadence **moyennée sur vingt-quatre heures** de 0,10 clic/s : son
  rapport affiché tourne autour de 1,03×, et c'est normal — il mesure la
  journée entière, pas la session.
- **Partie complète** : les quêtes et les succès tournent sur leur **vrai
  moteur**, tranche par tranche ; les dorés et la pluie passent en espérance
  mathématique avec un taux d'attrapage par profil ; le joueur met dix
  secondes à décider chaque achat. C'est la famille qui manquait au simulateur
  précédent.
- **Onglet fermé** : des sessions réelles, et entre elles la **vraie fonction
  de retour hors-ligne** du jeu. Mesuré : le hors-ligne pèse 2 à 11 % de la
  production totale selon le rythme des sessions — plafond de deux heures et
  rendement dégressif obligent.

Ce que la simulation ne modélise toujours pas, et pourquoi : les **quêtes
chronométrées** (les tranches de temps dépassent leur chrono — un joueur
simulé qui les ignore), le **trading CRMB** (marche centrée et 2 % de frais
par sens : l'espérance de tout aller-retour est négative), la **vérification
humaine** (elle ne retire rien à un joueur honnête). Un relevé instantané peut
toujours tomber juste après une renaissance et décrire un parc vide — les
colonnes *ratio*, *bâtiments*, *prestiges*, *ascensions*, *étoiles* et
*décision* n'en souffrent pas.

Résultat le plus net, inchangé : les profils **« autoclicker 50/s » et
« 15 clics/s » produisent des tableaux rigoureusement identiques**, chiffre
pour chiffre, sur les onze horizons.

## Ce qui reste imparfait

Écrit ici plutôt que dans un coin, parce qu'un projet qui prétend n'avoir aucun
défaut n'a simplement pas été mesuré.

1. **La protection anti-autoclicker est entièrement côté client.** Elle rend
   inutile l'autoclicker ordinaire, pas la modification du `localStorage` ni
   l'appel direct des fonctions du jeu depuis la console. Une vérification
   humaine se contourne même par un simple rechargement — elle n'est pas
   persistée, exprès, pour qu'un bug ne puisse enfermer personne. Rien de tout
   cela ne se règle sans validation serveur.
   **Et même bornée, elle ne supprime pas l'avantage** : la production totale
   d'un autoclicker sur un an reste environ dix fois celle d'un joueur très
   actif, parce que l'avance se compose à travers les renaissances. La borne
   rend l'écart fini ; elle ne l'annule pas.
2. **La courbe s'aplatit encore entre le quatre-vingt-dixième et le
   trois-cent-soixante-cinquième jour** : ×2,6 seulement, une fois la voie
   Horizon complète. C'est bien mieux que le plateau d'avant, ce n'est pas une
   courbe qui tient un an entier.
3. **Le « 73 s entre deux achats marquants » est réglé par la mesure, pas par
   le jeu** : compté avec les quêtes, les dorés et les succès, et avec un
   joueur qui met dix secondes à décider, l'écart entre achats marquants tient
   la cible (30 s) et le rythme vécu descend à dix secondes en début de
   partie. Le jeu n'a pas été accéléré ; c'est l'ancien chiffre qui décrivait
   un jeu amputé de ses temps forts.
4. **Les simulations ne sont pas des tests humains.** Elles ne disent rien du
   plaisir, de la lisibilité, du confort du pouce ni de l'envie de revenir. Un
   nombre dans une fourchette n'est pas un jeu réussi. Les vingt profils de
   campagne sont des scripts : ils utilisent le jeu dans un vrai navigateur,
   mais personne n'a « aimé » quoi que ce soit.
5. **L'extraction CRMB déborde ses puits au très long terme.** Trois machines
   de chaque modèle produisent des dizaines de milliers de CRMB en un mois
   simulé, quand les huit contrats du Registre en absorbent 4 435 en tout.
   « Rare et utile » tient sur les trente premiers jours ; au-delà, la monnaie
   redevient abondante. Rééquilibrage à décider par le propriétaire du projet.
6. **Sous stratégie optimale parfaite, les récompenses de quêtes font boule de
   neige** (proportionnelles à la production, reconverties instantanément).
   Aucun profil navigateur à cadence humaine n'exhibe cet emballement — le
   temps de décision est la vraie borne — mais un joueur-machine le pourrait.
7. **La mémoire est mesurée sur des sessions de dix à treize minutes** (les
   quarante sessions de campagne relèvent le tas toutes les vingt secondes:
   4 → 33 Mo au pire, sans ramasse-miettes forcé) et sur la session de mesure
   dédiée au GC forcé. Une session de plusieurs heures n'a pas été observée.

## Le jeu

- **24 bâtiments** : 12 Cliqueurs et 12 Mineurs, aux prix géométriques (×1,22
  par exemplaire), sans mur de progression. Huit d'entre eux — les rangs 8 à 11
  des deux familles — n'existent qu'une fois l'Ascension atteinte.
- **Améliorations infinies** : générées à la demande. Chaque bâtiment débloque
  un palier ×2 à 10, 20, 40, 80, 160 exemplaires — un doublement à chaque fois.
  Il n'y a pas de dernière amélioration.
- **26 quêtes** réparties en 8 catégories (clic, banque, achat, minage,
  crypto, événement, style, quotidien). Trois quêtes actives, trois
  quotidiennes, une série de jours consécutifs, et un bouton pour passer une
  quête qui ne te plaît pas.
- **Économie CrumbCoin** : une monnaie de **récompense**, pas un compteur qui
  monte tout seul — voir plus bas.
- **Arbre céleste** : 8 améliorations permanentes achetées avec les chips de
  prestige, deux sans niveau maximum, chaque niveau valant +0,25. Elles
  survivent à toutes les renaissances suivantes.
- **Ascension** : au-dessus du prestige. Trois voies — Horizon (huit bâtiments
  de plus), Éclat (+0,25 sur les deux axes, sans fin), Écho (renaissances plus
  généreuses) — payées en étoiles.
- **Le Registre** : des contrats permanents payés en CRMB, +0,25 sur les deux
  axes chacun, qui survivent aux ascensions.
- **55 succès** en 9 catégories, avec récompense en cookies — et en CRMB à
  partir du palier Or.
- **Événements** : cookies dorés, pluie de miettes, cookie volant, ventes
  flash. Chaque gain d'événement est **posé sur la règle des valeurs avant
  d'être crédité** (`src/utils/gains.js`) : une miette à ×2,5 sur un clic de
  1,25 crédite 3, pas 3,125.
- **Guide intégré** : sept étapes pour découvrir le jeu, puis l'objectif du
  moment en permanence — voir plus bas.
- Progression hors-ligne, sauvegarde automatique, export/import, mode contraste
  élevé, animations réduites, réglage du volume.

**24 bâtiments** au total : 12 Cliqueurs et 12 Mineurs, dont huit que seule
l'Ascension ouvre. Six onglets : Boutique (filtres Tout / Clic / Minage),
Améliorations, Quêtes, CRMB, Prestige, Profil (statistiques, succès, apparences).

### Le CRMB est une récompense, pas un revenu

Cuire des cookies ne rapporte **aucun** CRMB. Le robinet historique en versait
0,001 tous les 20 000 cookies, soit des centaines de millions en fin de partie :
une monnaie qu'on gagne sans effort ne récompense plus rien.

| Source | Montant | Fréquence |
| --- | --- | --- |
| Quêtes | +1, +2 ou +5 | 10 quêtes sur 26 en donnent |
| Succès Or | +1 | 15 succès |
| Succès Platine | +2 | 9 succès |
| Succès Légendaire | +5 | 4 succès |
| Prestige | +5 | à chaque renaissance |
| Matériel de minage | 0,01 à 5 CRMB **par heure** | à partir de 10 M de cookies pour le premier |

Les 55 succès rapportent **53 CRMB en tout** : c'est un plafond de partie, pas
un revenu. Toutes les récompenses sont des entiers — le bonus de quête de
l'arbre céleste ne s'applique qu'aux cookies, sinon il rendrait « 1,25 CRMB ».

Et il y a de quoi les dépenser :

- **Le Registre** — un puits sans fond : +0,25 sur les **deux** axes,
  définitivement, à 10 · 25 · 50 · 100 · 250 · 500 CRMB…
- **Staking** — bloquer du CRMB fait franchir des paliers de production
  (+0,25 chacun) et rapporte 1 à 10 % **par jour** selon la durée du verrou.
  Contrairement au Registre, le bonus est prêté : il repart au retrait.
- **Les deux dernières apparences** ne s'achètent qu'en CRMB : 10 et 25.
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
pouce et rien ne les recouvre. Au plus **une notification ordinaire toutes les
seize secondes**, et ce qui arrive trop tôt **attend son tour** dans une file
bornée à six entrées — écarté, il n'existait plus. Les événements majeurs
gardent six secondes d'écart et sont plafonnés à trois par minute glissante ;
les cookies dorés, visibles par eux-mêmes, sont redescendus au rang ordinaire.
Mesuré sur une session type : moins de quatre notifications par minute, sur un
quart d'heure comme sur une heure.

### Cliquer vite paie, automatiser non

Le rapport actif/passif suit la cadence sans plafond, comme voulu. Mais la
cadence **créditée** est bornée à **15 clics/seconde**, par un seau à jetons qui
laisse passer une réserve de huit pour les rafales humaines.

Un joueur rapide tient 12 à 15 clics/s à deux pouces : mesuré, rien ne lui est
refusé. Un autoclicker à 50 ou 1 000 clics/s obtient **exactement** la même
chose qu'à 15 — les deux profils produisent des tableaux identiques chiffre pour
chiffre sur onze horizons. Son rapport actif/passif tombe à 1,8× celui d'un
joueur très actif, contre 12× avant ; sa production totale sur un an reste
environ dix fois supérieure, parce que l'avance se compose à travers les
renaissances. Borner la cadence rend l'écart **fini**, pas nul.

Le clic répond quand même visuellement au-delà de la borne : on refuse le gain,
pas le geste. Et le jeu **le dit** sous la barre de production, plutôt que de
laisser croire qu'accélérer sert encore.

Le détail complet — les six signaux comportementaux, la vérification humaine, et
surtout **ce que cette protection ne peut pas faire** — est plus haut.

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

| N | Curseur | Singularité | Four | Portail | Big Bake |
| --- | --- | --- | --- | --- | --- |
| 0 | +0,25 /clic | +10 000 /clic | +2 /s · +0,12 /clic | +80 000 /s · +4 800 /clic | +40 M /s · +2,4 M /clic |
| 10³ | +0,25 | +10 000 | +2 · +0,12 | +80 000 · +4 800 | +40 M · +2,4 M |
| 10⁶ | +0,25 | +10 000 | +2 · +0,12 | +80 000 · +4 800 | +40 M · +2,4 M |
| 10⁹ | +0,25 | +10 000 | +2 · +0,12 | +80 000 · +4 800 | +40 M · +2,4 M |

Le gain ne décroît jamais. Une nuance depuis la règle des entiers : au-delà de
cent de puissance, le +0,25 d'un **Curseur seul** ne bouge l'entier affiché — et
crédité — qu'une fois sur quatre ; quatre Curseurs rendent exactement +1, et
aucun achat ne rend jamais moins que zéro. Au-delà de 10¹² exemplaires **de
chaque bâtiment**, un +0,25 passe sous la précision d'un flottant 64 bits ; cet
état est de toute façon inatteignable, le prix du 10¹²-ième Curseur dépassant
l'infini représentable.

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
hors-ligne. Recalibrer le jeu ne demande donc pas de toucher au code — et un
test vérifie qu'aucune clé de `balance` n'est morte, pour qu'aucun réglage ne
fasse croire à un levier qui ne fait rien.

### Ce qui survit à quoi

Trois gestes remettent la partie à zéro, et ils ne gardent pas la même chose.
Le tableau est le **contrat**, et il est vérifié par des tests qui jouent le
geste réel du joueur, écran compris :

| | Partie | Chips & arbre | Étoiles & Voûte | CRMB, Registre, matériel | Apparences | Succès | Compteurs à vie & Classement |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Renaissance** (prestige) | ✗ | ✓ recalculés | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Ascension** | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Réinitialiser la partie** | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Tout effacer** (Maj + clic) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

Deux colonnes de ce tableau étaient fausses, et personne ne le voyait :

- **« Réinitialiser la partie »** annonçait « le prestige et l'arbre céleste
  sont conservés » et emportait pourtant l'Ascension entière — quarante
  étoiles et les trois voies, mesuré. Avec Horizon partaient aussi les huit
  bâtiments qu'il débloque. Irréversible, sans avertissement.
- **La renaissance** emportait les apparences, dont Ice et Lava payées 10 et
  25 CRMB — alors que le portefeuille CRMB qui les avait achetées, lui,
  survivait. Le joueur gardait la monnaie et perdait l'objet.

La cause était commune, et elle est instructive : le report des couches se
faisait chez l'appelant, dans un `{ ...fresh, … }` écrit à la suite de l'appel.
Rien ne signale une ligne absente d'un littéral d'objet. `createResetState`
prend désormais chaque couche en **paramètre nommé**, `null` par défaut : ce
qu'un appelant ne confie pas repart à neuf, et ça se lit sur le site d'appel.

Les tests, eux, éprouvaient `createResetState` **isolément** — une fonction
correcte appelée avec un argument manquant reste correcte. Ils jouent
maintenant les deux bouts : le contrat de la fonction, et le geste du joueur.

### Les compteurs à vie

Cinq succès comptent un cumul qui se construit sur des jours : cent mille
clics, cent cinquante quêtes, deux cents dorés, sept jours de série,
vingt-cinq cookies croqués. Ils lisaient les compteurs de **partie** — que
chaque renaissance remet à zéro, et le jeu propose sa première renaissance dès
la quatre-vingtième minute, puis la répète sans arrêt. Il fallait donc ne
jamais renaître pour les décrocher : exactement l'inverse de ce que le jeu
demande.

Il y a maintenant **deux** jeux de compteurs, et ils ne servent pas à la même
chose :

| | `stats` (partie) | `lifetimeStats` (vie) |
| --- | --- | --- |
| Remis à zéro par une renaissance | oui | **jamais** |
| Lu par | les quêtes (écarts depuis leur tirage), le cookie qui se fait croquer, l'écran de la partie | les succès cumulatifs |

Empêcher toute statistique de se remettre à zéro aurait cassé les quêtes, qui
mesurent des écarts *depuis leur instanciation* : « réaliser 40 clics » n'a de
sens que sur un compteur qui repart. Les deux coexistent, et le panneau Profil
affiche le total à vie avec le chiffre de la partie en cours juste en dessous.

Une sauvegarde d'avant ne perd rien : les compteurs à vie sont **semés** avec
ce que la partie en cours a déjà accumulé. C'est un plancher, jamais un
plafond.

Deux d'entre eux ne comptent pas des gestes mais des **cumuls** —
`cookiesAvant` et `playtimeAvant`, les cookies cuits et le temps joué par
toutes les parties précédentes. Ils portent le Classement, et ils ne sont
incrémentés nulle part : la partie en cours s'y ajoute *à la lecture*
(`cookiesAVie`, `tempsDeJeuAVie`) et s'y **replie** au moment exact où elle se
termine, dans `cumulerVie`. Les cookies arrivent d'une douzaine d'endroits —
boucle, clic, quêtes, succès, dorés, hors-ligne, primes — et un compteur de
plus à tenir à jour dans chacun d'eux serait faux au premier oubli, avec pour
seul symptôme un classement légèrement injuste. Donc invisible.

### Le poids servi

Le jeu pesait **8,7 Mo d'images pour 135 Ko de code gzippé** — cinquante fois
plus de pixels que de logique. Mesuré au navigateur : 1,5 Mo rien qu'à l'écran
d'accueil (`cookie.png`, 1024×1024, affiché à 144 px sur téléphone), puis
5,3 Mo de plus à l'ouverture de l'onglet Profil, qui téléchargeait les quatre
autres cookies en pleine résolution pour des vignettes de 64 px. Sur un clic
venu d'un réseau social en 4G, c'est le joueur qui part avant d'avoir joué.

Ce qui a changé :

| | Avant | Après |
| --- | --- | --- |
| Écran d'accueil | 1 496 Ko | **163 Ko** |
| Onglet Profil (apparences) | + 5 426 Ko | **+ 30 Ko** |
| `welcome.png`, référencé nulle part | 1 242 Ko livrés | supprimé |
| `dist/` complet | 9,0 Mo | **1,7 Mo** |

Les sources 1024×1024 vivent dans `assets-source/` et ne sont **jamais**
servies. [`scripts/images.mjs`](scripts/images.mjs) en tire les deux seules
tailles que l'interface utilise — 768 px pour le grand cookie, 128 px pour les
vignettes — plus l'icône 512 px du manifeste. Les fichiers produits sont
versionnés : il n'y a rien à installer pour construire ou déployer.

**PNG palettisé et non WebP**, et c'est un choix, pas un oubli : le grand
cookie est peint dans un `<image>` SVG masqué (les morsures), où un format non
supporté ne donne pas une image de repli mais un trou — et un cookie invisible,
c'est un jeu injouable. Le PNG-8 divise déjà le poids par dix et se lit partout.

### Les polices sont auto-hébergées

Sora et Marcellus arrivaient de `fonts.googleapis.com` par un
`<link rel="stylesheet">` posé dans le `<head>`. Deux problèmes, et le second
est le vrai : le premier écran **attendait un serveur qui n'est pas le nôtre**,
et l'adresse IP de chaque joueur partait chez Google avant qu'il ait rien vu —
pour un jeu francophone, c'est un sujet RGPD, pas seulement une milliseconde.

[`scripts/polices.mjs`](scripts/polices.mjs) récupère les woff2, ne garde que
les sous-ensembles latin et latin-étendu (64 Ko en tout) et réécrit les URL
vers `/fonts/`. `font-display: swap` conserve le comportement d'origine : le
texte s'affiche tout de suite dans la pile système, puis se substitue.

## Pourquoi je joue ? — le Guide

C'est la question qu'un jeu incrémental doit répondre dans ses trente
premières secondes, et Crumbora ne la répondait pas. Un joueur ouvrait l'écran,
voyait un cookie et **cinq nombres**, cliquait dix fois, ne comprenait pas où
ça menait, et refermait l'onglet. Tout le jeu — les paliers, les quêtes, le
CRMB, la Renaissance — vivait derrière ce mur.

Deux réponses, et elles vont ensemble.

### 1. L'écran ne montre plus que ce sur quoi on agit

|  | Avant | Après |
| --- | --- | --- |
| Chiffres à la une | Par clic · Cadence · Clics /s · Minage /s · **Total /s** | **Par clic** · **Minage /s** |
| En-tête | répétait « Par clic » et « Minage » | chips et CRMB seulement |
| Sous le solde | « X cuits au total » | — (dans Profil) |
| Sous le cookie | « Croqués : X · Clics : Y » | — (dans Profil) |

Cinq nombres dont trois bougeaient en permanence, pour répondre à une question
— « est-ce que cliquer vaut le coup ? » — que personne ne se pose avant
d'avoir compris le jeu. Il en reste **deux**, et ce sont les deux seuls sur
lesquels le joueur agit : ce que rapporte un appui, et ce qui tombe quand il ne
fait rien.

La cadence a disparu de l'écran **mais pas du moteur** : elle continue de
borner ce qui est crédité, et l'avertissement reste. Un joueur dont les clics
cessent de compter doit l'apprendre, même si on ne lui montre plus son rythme.

### 2. L'accueil dit la règle du jeu, pas le catalogue

L'écran d'accueil annonçait « 16 bâtiments · Quêtes & quotidiennes · Marché
crypto · Arbre céleste ». Quatre promesses qui ne veulent rien dire à quelqu'un
qui n'a jamais joué : ce sont des noms de contenu, pas une règle. Il annonce
maintenant ce que le joueur va **faire** :

```
①  Appuie sur le cookie      chaque appui te rapporte des cookies
②  Achète des bâtiments      ils en fabriquent tout seuls, sans toi
③  Reviens plus tard         tout a continué pendant ton absence
```

### 3. Un guide qui dit quoi faire, et pourquoi

Sous le cookie, une carte dit trois choses, toujours dans le même ordre — c'est
ce qui permet de la lire d'un coup d'œil dès la troisième fois :

```
ÉTAPE 3 SUR 7                                      ×
Prends le Four — il est offert
Le Four cuit tout seul, même quand tu ne touches à
rien. C'est là que le jeu se met à jouer pour toi.
→ Boutique → Minage                      [ J'y vais ]
```

**Quoi faire** en un geste, **pourquoi** en une phrase qui promet quelque chose
de concret, **ce que ça rapporte**, et **où** — avec un bouton qui montre.

« Montre-moi » fait trois choses, et il a fallu les trois pour que ça marche :

| | Sans ça |
| --- | --- |
| ouvre l'onglet | — |
| **pose le bon filtre de boutique** | « Prends le Four » ouvrait la Boutique en laissant le filtre sur « Clic » : **le Four n'était pas dans la liste**. Le joueur cherchait un bâtiment que l'écran ne montrait pas |
| **fait défiler jusqu'à la carte, et la désigne** — anneau qui bat, étiquette « C'est ici » | Sur téléphone le panneau vit sous le cookie : on appuyait, rien ne bougeait dans le champ de vision. Et « le Four » ne veut rien dire tant qu'on ne l'a pas vu |

Chaque étape **paie** : 25, 50, 100, 250, 500, 1 000 puis 2 500 cookies, annoncés
avant l'effort. Un guide qui ne promet rien n'est qu'une liste de corvées. La
récompense est versée dans la même transition que le verrou de l'étape : elle
ne peut donc jamais tomber deux fois.

Et une étape franchie **se fête** : bandeau, gerbe dorée, son, et le montant
gagné. Sans ce retour, franchir une étape ne se distinguait pas de ne rien
faire.

Les sept étapes ouvrent **un** mécanisme chacune, dans l'ordre où le jeu les
rend utiles : cliquer → premier Cliqueur → premier Mineur → dix bâtiments →
première amélioration → première quête → premier doré. On ne parle du CRMB
qu'à quelqu'un qui possède déjà une boutique.

Ensuite le guide ne se tait pas, il change de registre : il affiche **l'objectif
du moment**, par ordre de ce qui change le plus la partie tout de suite.

| Priorité | Ce qu'il montre | Pourquoi en premier |
| --- | --- | --- |
| 1 | « Tu peux renaître » | Le plus gros moment du jeu, et il passait inaperçu : le bouton s'allume dans un onglet qu'on n'ouvre pas de soi-même |
| 2 | Une amélioration payable **maintenant** | Toujours le meilleur achat disponible, et le plus souvent oublié |
| 3 | Le palier de bâtiment le plus proche | « 3 Fours avant le palier — au 10ᵉ, chacun rapporte deux fois plus » |
| 4 | L'avancement vers la Renaissance | Le dernier recours : **aucun écran n'est jamais sans horizon** |

### Le guide se range quand le joueur sait jouer

Le même bloc gardé après le tutoriel donne un jeu qui **tient la main
indéfiniment** : on n'apprend plus rien, on se fait dicter la suite, et le
panneau mange la place de la boutique à chaque session. Le contenu ne change
pas — c'est la place qu'il prend qui change.

| | Découverte (7 étapes) | Ensuite |
| --- | --- | --- |
| Hauteur mesurée | **250 px** | **50 px** |
| Forme | carte pleine : consigne, promesse, endroit, bouton, récompense, barre | **une ligne** tapable, avec un filet de progression de 3 px |
| Compteur d'étapes | « À faire · 3/7 » | — |
| Bouton | « Montre-moi », plein format | un chevron |

Un joueur qui sait jouer veut **un cap, pas un cours**.

### Pourquoi cliquer ?

La question n'avait aucune réponse à l'écran. Mesuré sur le moteur
(`npm run balance`), à cinq clics par seconde :

| Horizon | 10 min | 1 h | 6 h | 1 j | 30 j | 365 j |
| --- | --- | --- | --- | --- | --- | --- |
| Production **×** en cliquant | 2,6 | 2,8 | 2,7 | 2,6 | 2,8 | 2,8 |

Cliquer multiplie la production par **2,6 à 2,8**, du début de partie à la
trois-cent-soixantième journée — le jeu était donc bien équilibré, il ne le
disait simplement à personne. Une ligne l'annonce maintenant, sous les deux
chiffres, **et seulement quand la question se pose** : pendant qu'on clique, et
s'il y a un minage auquel se comparer.

Elle n'affiche **jamais « ×1 »**. La cadence est une moyenne glissante : pendant
la seconde où elle monte, le rapport passe par 1, et annoncer « cliquer te
rapporte ×1 » dirait exactement le contraire de ce que cette ligne existe pour
dire. En dessous d'un cran de grille, elle se tait.

Deux garde-fous, tous deux couverts par des tests :

- **Un vétéran ne se fait jamais réexpliquer le clic.** Trois étapes se mesurent
  sur le parc, et une Renaissance vide le parc : les étapes franchies sont donc
  verrouillées dans la sauvegarde. Une partie déjà avancée n'a rien à
  verrouiller — les étapes se mesurent sur l'état réel, un joueur qui possède
  trente bâtiments les a toutes franchies sans qu'on écrive quoi que ce soit.
- **Le joueur reste maître.** Une croix masque le guide, définitivement ; ⚙️ →
  *Réafficher le guide* le ramène. Un conseil qu'on a fermé ne revient jamais
  tout seul.
- **Aucune prime rétroactive.** Une partie avancée remplit d'entrée les sept
  conditions. Les étapes sont alors verrouillées **sans être payées** : une
  prime récompense un geste vu, pas un état constaté au chargement. Sans cette
  règle, la mise à jour offrait 9 525 cookies à tout le monde — et faussait la
  mesure du gain au clic.

Tout vit dans [`src/data/guide.js`](src/data/guide.js), en **fonctions pures** :
aucune ne touche à React, au DOM ni à l'horloge. C'est ce qui permet de vérifier
par des tests qu'un joueur neuf reçoit bien sa première consigne, et qu'un
joueur de quatre-vingts heures ne la reçoit jamais.

### Des joueurs en face — le Classement

Un multiplicateur affiché est une **information**. Une raison, c'est quelqu'un
devant soi. Le retour du joueur était sans appel : *« on ne comprend toujours
pas l'intérêt de cliquer, il n'y a pas de réel gain au bout »* — et il tenait
même si le chiffre ci-dessus était juste.

Sept rivaux, donc. Ils ne diffèrent **que par leur cadence de clic** : même
catalogue, mêmes prix, mêmes paliers, mêmes renaissances, même façon d'acheter.
Monter d'une place, c'est donc littéralement appuyer plus qu'eux — le classement
est la traduction directe de l'effort, et c'est tout ce qu'on lui demande de
dire.

| | Flocon | Nino | Salomé | Tarek | Iris | Zoé | CRUMB-9000 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Cadence | 0,25 c/s | 1 | 2 | 3,5 | 5,5 | 8 | 12 |
| Prime au dépassement | 1 CRMB | 1 | 2 | 2 | 3 | 5 | **10** |

Trois décisions portent tout le reste, et chacune a coûté une mesure.

**1. Ce ne sont pas des joueurs en ligne, et l'écran le dit.** Crumbora est
entièrement client : la partie vit dans le `localStorage` du joueur et s'y
réécrit en dix secondes depuis la console — c'est déjà écrit noir sur blanc
dans [`src/utils/anticheat.js`](src/utils/anticheat.js). Un classement alimenté
par ces sauvegardes ne classerait rien : la première personne à ouvrir les
outils de développement serait première pour toujours, et tous les autres
joueraient contre un champ de texte. Sept adversaires honnêtes valent mieux que
mille faux. Le panneau l'explique en toutes lettres plutôt que de laisser
croire.

**2. Ils avancent au TEMPS DE JEU, pas à l'horloge murale.** Quelqu'un qui joue
vingt minutes par jour affronte des rivaux qui ont joué vingt minutes eux
aussi. Sur une horloge murale, tout le monde perdrait du terrain **en dormant**
— exactement le contraire de ce qu'un classement doit provoquer.

**3. Leurs chiffres viennent du moteur, pas d'une formule inventée.**
`scripts/rivaux.mjs` fait jouer sept parties par le simulateur du jeu et relève
la production cumulée à **vingt-huit temps de jeu**, de la trentième seconde au
trentième jour. Entre deux relevés, l'interpolation est **géométrique** : sur un
segment qui va de dix à quatre-vingts millions, la droite passerait par
quarante-cinq millions à mi-parcours là où le jeu en produit vingt-huit, et le
classement sauterait à chaque palier franchi.

#### Huit minutes d'avance, et c'est un chiffre mesuré

Le simulateur ne modélise que la mécanique. Un joueur, lui, reçoit en plus dès
sa première minute les primes des sept étapes du Guide (9 525 cookies), ses
premiers succès et ses premières quêtes. Sans correction, le résultat mesuré en
navigateur était sans appel : un débutant à trois clics par seconde qui suit le
Guide passait **premier sur huit au bout de quarante-neuf secondes**, devant un
adversaire simulé à douze clics par seconde — puis se faisait doubler par les
sept, un par un. Le seul classement pire qu'aucun classement est celui qui
commence par une victoire imméritée et se poursuit en dégringolade.

La courbe réelle d'un débutant, relevée en navigateur :

| Temps de jeu | 11 s | 49 s | 2 min 33 |
| --- | :-: | :-: | :-: |
| Cookies cuits | 3 314 | 18 824 | 41 934 |

La même partie **sans les cadeaux** met environ huit minutes à en arriver là.
Les cadeaux de bienvenue valent donc à peu près huit minutes d'avance, et c'est
exactement ce qu'on rend aux rivaux. Une avance en **temps** plutôt qu'une prime
en cookies, parce que c'est la seule forme qui a la bonne allure : ×4,9 de
handicap à dix minutes, quand les cadeaux font toute la partie ; ×1,02 à
vingt-quatre heures, quand ils ne pèsent plus rien.

Résultat mesuré, sur trois parcours de débutant joués par Playwright : il
démarre huitième, dépasse Flocon entre la **98ᵉ et la 120ᵉ seconde**, Nino peu
après, et doit travailler pour la suite.

L'autre piste a été essayée, et écartée sur mesure : faire jouer les rivaux
**avec** la couche d'événements du simulateur. Elle donne à un joueur de trois
clics par seconde 2,4 millions de cookies en deux minutes, là où le vrai
débutant en a quarante-deux mille. Cinquante-sept fois trop — cette couche
décrit une espérance mathématique, pas quelqu'un qui joue.

#### Deux bugs que seul le navigateur pouvait montrer

- **Un tic de quêtes effaçait les cumuls.** `tickQuests` reconstruit
  `lifetimeStats`, et le faisait en **énumérant** les cinq compteurs qu'il
  connaissait. Les deux cumuls du Classement disparaissaient donc au premier tic
  de quête, et le seul symptôme visible était un joueur renvoyé **bon dernier
  après une renaissance**. C'est exactement le défaut décrit plus haut pour
  `createResetState` : un littéral d'objet ne signale jamais un champ absent.
- **Les célébrations ne partaient jamais.** Le hook remplissait la liste des
  rivaux à fêter *depuis le réducteur* `setState`, puis la parcourait juste
  après l'appel. React 18 ne garantit pas d'exécuter un réducteur sur-le-champ —
  il le diffère dès qu'une file de mises à jour est en cours, c'est-à-dire tout
  le temps dans un jeu qui appelle `setState` deux fois par seconde. Mesuré en
  navigateur : les primes tombaient bien (+12 CRMB) et **aucun bandeau ne
  s'affichait**. Le même +12 disait la seconde moitié du bug — sans verrou
  local, deux tics rapprochés lisaient tous deux un `battus` pas encore commité
  et payaient six rivaux d'un coup. Tout se décide maintenant **avant** le
  `setState` ; le réducteur ne fait qu'écrire. `useGuide`, bâti sur le même
  modèle, avait le même défaut et le même correctif.

#### Ce qui est verrouillé par des tests

- **L'escalier tient à tous les temps de jeu.** Chaque rival est devant le
  précédent, de la première seconde au cent-vingtième jour. Rejouer le script
  après un rééquilibrage des prix peut faire se croiser deux courbes, et le rang
  du joueur se mettrait alors à bouger **sans qu'il ait joué**.
- **Renaître ne fait pas reculer.** La renaissance vide `lifetime` : branché
  dessus, le classement renverrait le joueur bon dernier au moment précis où le
  jeu lui demande de tout recommencer.
- **Aucune prime rétroactive.** Une partie avancée devance d'entrée cinq ou six
  rivaux. Ils sont alors verrouillés **sans être payés** : une prime récompense
  un dépassement vu, pas un état constaté au chargement.
- **Une prime ne se paie qu'une fois**, alors même que le classement reste
  vivant — un rival repassé devant redevient un rival, et c'est ce qui donne
  envie de revenir.

La prime en cookies vaut **une minute de la production du moment**, clic
compris : soixante cookies à la première minute, une minute d'avance en fin de
partie. Une valeur fixe aurait été un cadeau absurde au début et une poussière
ensuite.

À l'écran, ça tient en **44 px** : un ruban d'une ligne sous le cookie — la
place, celui qui est devant, la fraction déjà comblée — qui n'apparaît qu'au
**premier rival dépassé**. Avant ça il n'aurait rien à raconter, et le Guide a
la parole. Le tableau complet vit dans l'onglet Profil, à un appui de là.

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
  ou sauvegarde corrompue n'empêchent jamais le jeu de démarrer — **et le
  joueur en est averti**. Le jeu tournait parfaitement en navigation privée
  sans jamais le dire : on jouait une heure, on rechargeait, on trouvait une
  partie vide. Une sonde écrit puis relit une clé au démarrage (la présence de
  `localStorage` ne prouve rien : il peut exister et refuser), et un bandeau
  persistant propose d'exporter un fichier. Une écriture qui échoue en cours
  de partie lève le même bandeau.

## Sauvegardes

La partie est stockée sous la clé `cookieCrazeSaveV7`. Le préfixe est
historique — le jeu s'appelait Cookie Craze avant de devenir Crumbora — et il
est **volontairement conservé** : renommer les clés déconnecterait chaque
joueur de sa partie, et la continuité des sauvegardes prime sur la cohérence
du nom. Les sauvegardes des versions 1 à 6 sont migrées automatiquement au
chargement : fusion profonde avec l'état par défaut, valeurs aberrantes
assainies, ancien staking converti en position flexible, champs morts
supprimés, record de combo ramené sur la nouvelle échelle, Ascension et
Registre ajoutés à zéro, compteurs à vie **semés** depuis la partie en cours.

Les anciennes clés **ne sont jamais effacées** : un joueur qui reviendrait sur
une version antérieure du jeu doit retrouver sa partie. Une sauvegarde illisible
est archivée sous `cookieCrazeSaveV7_corrupted_<horodatage>`, pas supprimée.

Export et import se font depuis ⚙️ → *Exporter / Importer la sauvegarde*.
Les nouveaux exports portent l'étiquette `game: "crumbora"` ; les fichiers
exportés sous l'ancienne étiquette s'importent pour toujours.

## Déploiement

- **Vercel** : importer le dépôt, le reste est déjà configuré.
- **Une variable d'environnement, optionnelle mais recommandée** :
  `VITE_SITE_URL=https://ton-domaine.fr`. Elle injecte au build
  `<link rel="canonical">`, `og:url` et les URL **absolues** des images de
  partage — un chemin relatif n'est pas résolu par tous les robots sociaux.
  Non définie, ces balises sont simplement absentes : mieux vaut pas de balise
  qu'une balise pointant vers un domaine d'exemple, ce qui était le cas
  jusqu'ici (l'`og:url` dormait en commentaire dans `index.html`).
- **Netlify / autre statique** : `npm run build`, publier `dist/`, avec une
  réécriture de toutes les routes vers `/index.html`.

[`vercel.json`](vercel.json) fixe deux règles de cache opposées. Le format JSON
n'admet pas de commentaire — et le schéma Vercel rejette toute clé inconnue, y
compris un champ `comment` — donc elles sont expliquées ici :

| Chemin | Cache | Pourquoi |
| --- | --- | --- |
| `/assets/*` | un an, `immutable` | les fichiers produits par Vite portent un hash dans leur nom : un contenu différent a forcément une URL différente |
| `/sw.js` | `max-age=0, must-revalidate` | sans revalidation, un navigateur garderait l'ancien service worker et figerait le jeu sur une version périmée |

Le service worker applique la même distinction, et pour la même raison — le nom
du fichier change-t-il quand son contenu change ?

| Chemin | Stratégie | Pourquoi |
| --- | --- | --- |
| `/assets/*` | cache d'abord, sans réseau | le hash garantit qu'un contenu différent a une autre URL : le cache ne peut pas être périmé |
| tout le reste (images, sons, manifeste) | cache d'abord **puis rafraîchissement en arrière-plan** | ces fichiers gardent leur nom d'une version à l'autre. En cache pur, un joueur déjà venu ne recevait **jamais** un cookie retouché — il gardait l'ancien pour toujours |
