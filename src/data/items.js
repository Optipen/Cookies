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
 * Il sert à égaliser l'attractivité des deux familles, pas à régler le rapport
 * actif/passif: avec des prix exponentiels, un facteur constant ne décale les
 * quantités achetées que d'une poignée d'exemplaires. Le rapport se règle par
 * l'échelle des VALEURS (un Mineur vaut dix fois son Cliqueur de même rang).
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
const MINE_BASE = [25, 250, 2_500, 25_000, 250_000, 2_500_000, 25_000_000, 250_000_000];

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

const mineItem = (rank, id, name, emoji, value, desc) => ({
  id,
  mode: "mine",
  rank,
  name,
  emoji,
  value, // cookies par seconde
  base: priceOf(rank),
  growth: PRICE_GROWTH,
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
];

// --- Mineurs: production automatique ---------------------------------------
export const MINER_ITEMS = [
  mineItem(0, "oven", "Four", "🔥", 2, "Cuit des cookies en continu."),
  mineItem(1, "bakery", "Boulangerie", "🥖", 10, "Une équipe qui ne dort jamais."),
  mineItem(2, "farm_cps", "Ferme", "🌾", 50, "Champs de blé sucré à perte de vue."),
  mineItem(3, "factory_cps", "Usine", "🏭", 250, "Ligne de production industrielle."),
  mineItem(4, "bank_cps", "Banque", "🏦", 1_000, "Des intérêts en cookies composés."),
  mineItem(5, "temple", "Temple", "⛩️", 5_000, "Rituels d'efficacité sacrée."),
  mineItem(6, "lab", "Laboratoire", "🧪", 25_000, "La science du cookie appliquée."),
  mineItem(7, "portal", "Portail", "🌀", 100_000, "Importe des cookies d'une autre réalité."),
];

export const ITEMS = [...CLICKERS, ...MINER_ITEMS];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Libellés affichés — le jeu ne parle jamais de « CPC » ni de « CPS ». */
export const LABELS = {
  click: { one: "Cliqueur", many: "Cliqueurs", axis: "Puissance de clic", unit: "/clic", icon: "👆" },
  mine: { one: "Mineur", many: "Mineurs", axis: "Minage", unit: "/s", icon: "⛏️" },
};
