// === Bâtiments ===
//
// Deux familles parallèles, qui fonctionnent en même temps:
//  · les Cliqueurs augmentent la puissance de clic (cookies gagnés à chaque clic);
//  · les Mineurs augmentent le minage (cookies générés chaque seconde).
//
// Les valeurs sont volontairement « propres » (+0,25 · +1 · +5 · +25 …) et
// strictement additives: acheter un Curseur quand la puissance vaut 1 la porte
// à exactement 1,25. Aucune n'est plafonnée.
//
// Les identifiants sont conservés depuis les versions précédentes pour que les
// sauvegardes existantes gardent leurs bâtiments; seuls les noms affichés et
// les valeurs ont changé.

import tuning from "./tuning.json";

export const BALANCE = tuning?.[tuning?.mode || "standard"]?.balance || {};

/**
 * Écart de prix entre un Cliqueur et le Mineur de même rang.
 *
 * Il ne règle PAS le rapport actif/passif de fin de partie: avec des prix
 * géométriques, un facteur constant ne décale les quantités achetées que d'un
 * nombre fixe d'exemplaires, et ce décalage devient négligeable quand le parc
 * grandit. Le rapport de fin de partie se règle par l'échelle des VALEURS.
 *
 * Ce qu'il règle vraiment, c'est le DÉBUT: à parc égal de quelques dizaines
 * d'exemplaires, un décalage de deux ou trois achats change tout. À 0,7, les
 * deux familles s'achètent au même rythme dès le premier quart d'heure au lieu
 * que les Cliqueurs accusent deux exemplaires de retard par rang.
 *
 * Réglé dans `tuning.json` pour que la calibration se fasse sans toucher au code.
 */
export const CLICK_PRICE_FACTOR = BALANCE.click_price_factor ?? 1.5;

/** Croissance du prix à chaque exemplaire acheté. */
export const PRICE_GROWTH = BALANCE.price_growth ?? 1.15;

// Prix de base, par rang: une puissance de dix à chaque fois.
//
// Un rang coûte dix fois le précédent et rapporte cinq fois plus par
// exemplaire; il devient donc rentable après quelques exemplaires du rang
// d'en dessous. Espacés de vingt, les rangs mettaient un quart d'heure à se
// débloquer et la boutique restait figée trop longtemps.
// Les quatre derniers rangs ne s'ouvrent qu'avec l'Ascension: ils existent dans
// le catalogue mais restent verrouillés tant que la voie Horizon ne les a pas
// atteints. Les déclarer ici plutôt que de les fabriquer à la volée garde les
// identifiants stables dans les sauvegardes.
const MINE_BASE = [
  25, 250, 2_500, 25_000, 250_000, 2_500_000, 25_000_000, 250_000_000,
  2_500_000_000, 25_000_000_000, 250_000_000_000, 2_500_000_000_000,
];

/**
 * Échelle générale des prix.
 *
 * C'est elle qui fixe le **temps de retour** d'un achat: à 1, un Curseur se
 * rembourse en dix-huit secondes, et le joueur rachète sans arrêt sans jamais
 * rien désirer. Monter cette échelle espace les achats sans toucher ni aux
 * valeurs propres ni aux prix relatifs entre familles.
 */
export const PRICE_SCALE = BALANCE.price_scale ?? 1;
const priceOf = (rank) => Math.round(MINE_BASE[rank] * PRICE_SCALE);

/**
 * Niveau d'Horizon requis. `0` pour les huit rangs de base, 1 à 4 pour ceux que
 * l'Ascension ouvre. Un rang verrouillé n'apparaît pas en boutique et ne peut
 * pas être acheté, mais il garde son identifiant: une sauvegarde qui en
 * contiendrait garderait ses bâtiments.
 */
const horizonOf = (rank) => Math.max(0, rank - 7);

const mineItem = (rank, id, name, emoji, value, desc) => ({
  id,
  mode: "mine",
  rank,
  name,
  emoji,
  value, // cookies par seconde
  base: priceOf(rank),
  growth: PRICE_GROWTH,
  horizon: horizonOf(rank),
  desc,
});

const clickItem = (rank, id, name, emoji, value, desc) => ({
  id,
  mode: "click",
  rank,
  name,
  emoji,
  value, // cookies ajoutés à chaque clic
  base: Math.round(priceOf(rank) * CLICK_PRICE_FACTOR),
  growth: PRICE_GROWTH,
  horizon: horizonOf(rank),
  desc,
});

// --- Cliqueurs: puissance de clic ------------------------------------------
export const CLICKERS = [
  clickItem(0, "cursor", "Curseur", "🖱️", 0.25, "Un curseur de plus sur le cookie."),
  clickItem(1, "grandma", "Mamie", "👵", 1, "Elle tape fort, et avec amour."),
  clickItem(2, "farm", "Gant de frappe", "🧤", 5, "Un gant lesté, pour taper plus fort."),
  clickItem(3, "factory", "Bras robotisé", "🦾", 25, "Précision industrielle à chaque frappe."),
  clickItem(4, "bank", "Exosquelette", "🦿", 100, "Multiplie la force de ta main."),
  clickItem(5, "ai", "IA de frappe", "🤖", 500, "Elle anticipe tes clics."),
  clickItem(6, "tm", "Machine à Temps", "⌛", 2_500, "Chaque clic se répète dans le passé."),
  clickItem(7, "singularity", "Singularité tactile", "🌌", 10_000, "Un seul clic, une infinité d'impacts."),
  // --- Rangs d'Ascension: verrouillés jusqu'à la voie Horizon ---
  clickItem(8, "swarm", "Essaim de mains", "🫱", 50_000, "Mille mains frappent en même temps que la tienne."),
  clickItem(9, "will", "Volonté pure", "🧠", 250_000, "Plus besoin de doigts. Il suffit de vouloir."),
  clickItem(10, "impact", "Impact stellaire", "☄️", 1_000_000, "Chaque appui laisse un cratère."),
  clickItem(11, "worldfinger", "Doigt du monde", "🌍", 5_000_000, "Le monde entier appuie avec toi."),
];

// --- Mineurs: production automatique ---------------------------------------
//
// Un Mineur vaut exactement HUIT fois le Cliqueur de son rang. Une seule phrase
// décrit tout le rapport entre les deux familles, et c'est elle qui fixe le
// rapport entre jeu actif et jeu passif — pas les prix, qui ne décalent que les
// premières heures.
//
// Le facteur valait dix, sauf au rang 0 où il valait déjà huit. Cette exception
// suffisait à fausser le tout début de partie, et un facteur dix plaçait le
// joueur actif à 2,1× le joueur inactif au lieu des 2,5 à 2,8 visés.
export const MINE_PER_CLICK_VALUE = 8;
export const MINER_ITEMS = [
  mineItem(0, "oven", "Four", "🔥", 2, "Cuit des cookies en continu."),
  mineItem(1, "bakery", "Boulangerie", "🥖", 8, "Une équipe qui ne dort jamais."),
  mineItem(2, "farm_cps", "Ferme", "🌾", 40, "Champs de blé sucré à perte de vue."),
  mineItem(3, "factory_cps", "Usine", "🏭", 200, "Ligne de production industrielle."),
  mineItem(4, "bank_cps", "Banque", "🏦", 800, "Des intérêts en cookies composés."),
  mineItem(5, "temple", "Temple", "⛩️", 4_000, "Rituels d'efficacité sacrée."),
  mineItem(6, "lab", "Laboratoire", "🧪", 20_000, "La science du cookie appliquée."),
  mineItem(7, "portal", "Portail", "🌀", 80_000, "Importe des cookies d'une autre réalité."),
  // --- Rangs d'Ascension: verrouillés jusqu'à la voie Horizon ---
  mineItem(8, "colony", "Colonie orbitale", "🛰️", 400_000, "Une ville en orbite, et sa boulangerie."),
  mineItem(9, "dyson", "Sphère de Dyson", "🛸", 2_000_000, "Toute l'énergie d'une étoile, pour cuire."),
  mineItem(10, "nebula", "Nébuleuse sucrée", "🌠", 8_000_000, "Un nuage de sucre grand comme un système."),
  mineItem(11, "bigbake", "Big Bake", "💥", 40_000_000, "L'univers recommence, en version pâtissière."),
];

export const ITEMS = [...CLICKERS, ...MINER_ITEMS];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Les seize bâtiments présents dès la première partie, sans Ascension. */
export const BASE_ITEMS = ITEMS.filter((i) => !i.horizon);

/**
 * Un bâtiment est-il ouvert à l'achat ?
 *
 * Les rangs d'Ascension existent dans le catalogue dès le départ — pour que les
 * identifiants restent stables — mais ne s'achètent qu'une fois la voie Horizon
 * montée jusqu'à eux.
 */
export const itemUnlocked = (item, state) =>
  !item?.horizon || Math.floor(state?.ascension?.tracks?.horizon || 0) >= item.horizon;

export const unlockedItems = (state) => ITEMS.filter((i) => itemUnlocked(i, state));

/** Libellés affichés — le jeu ne parle jamais de « CPC » ni de « CPS ». */
export const LABELS = {
  click: { one: "Cliqueur", many: "Cliqueurs", axis: "Puissance de clic", unit: "/clic", icon: "👆" },
  mine: { one: "Mineur", many: "Mineurs", axis: "Minage", unit: "/s", icon: "⛏️" },
};
