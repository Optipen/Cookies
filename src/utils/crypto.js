// === CrumbCoin (CRMB) — économie complète ===
// Marché à prix variable, minage matériel, staking à paliers verrouillés.
// Tout est en fonctions pures pour rester testable hors React.
//
// Le CRMB est une monnaie de RÉCOMPENSE, pas un compteur qui monte tout seul.
// On en gagne en terminant des quêtes, en franchissant de gros paliers, en
// décrochant les succès qui comptent et en renaissant — jamais en cuisant des
// cookies. Le faucet historique (0,001 CRMB tous les 20 000 cookies) en
// distribuait des centaines de millions en fin de partie; une monnaie qu'on
// gagne sans effort ne récompense plus rien.

import { tierState } from "./grid.js";

export const CRMB = {
  name: "CrumbCoin",
  symbol: "CRMB",
  // Prix de départ, en cookies par CRMB
  basePrice: 20_000,
  // Bornes de sécurité pour éviter les dérives du random walk
  minPriceFactor: 0.35,
  maxPriceFactor: 4.0,
  // Écart entre prix d'achat et prix de vente (frais de marché)
  spread: 0.02,
  // Cadence du marché
  tickMs: 5_000,
  historyLength: 60,
};

// === Matériel de minage ===
//
// Rendements exprimés en CRMB **par heure**, en nombres ronds. Le meilleur rig
// rapporte 25 CRMB/h et coûte 500 milliards de cookies: c'est un investissement
// de fin de partie, pas un robinet. L'ancienne échelle produisait 1,8 CRMB/s,
// soit 6 480 par heure et par exemplaire.
export const MINERS = [
  { id: "cpu", name: "Vieux CPU", emoji: "💻", base: 10_000_000, growth: 1.2, perHour: 0.05, desc: "Un portable qui chauffe. Ça mine, lentement." },
  { id: "gpu", name: "Carte graphique", emoji: "🎮", base: 100_000_000, growth: 1.2, perHour: 0.25, desc: "Le classique. Bruyant mais efficace." },
  { id: "asic", name: "Rig ASIC", emoji: "🖥️", base: 1_000_000_000, growth: 1.2, perHour: 1, desc: "Matériel dédié, rendement sérieux." },
  { id: "farm", name: "Ferme de minage", emoji: "🏗️", base: 25_000_000_000, growth: 1.2, perHour: 5, desc: "Un hangar entier de rigs." },
  { id: "quantum", name: "Mineur quantique", emoji: "⚛️", base: 500_000_000_000, growth: 1.2, perHour: 25, desc: "Il mine dans plusieurs réalités à la fois." },
];

// === Paliers de staking ===
//
// Le poids décide de la vitesse à laquelle on franchit les paliers de boost;
// le rendement est exprimé **par jour**, en pourcentages ronds. Un taux annuel
// n'avait aucun sens dans un jeu où une partie dure une semaine.
export const STAKE_TIERS = [
  { id: "flex", name: "Flexible", lockMs: 0, perDay: 0.01, boostMult: 1, desc: "Retrait à tout moment." },
  { id: "short", name: "1 heure", lockMs: 3_600_000, perDay: 0.02, boostMult: 2, desc: "Verrouillé 1 h." },
  { id: "mid", name: "6 heures", lockMs: 21_600_000, perDay: 0.05, boostMult: 3, desc: "Verrouillé 6 h." },
  { id: "long", name: "24 heures", lockMs: 86_400_000, perDay: 0.1, boostMult: 5, desc: "Verrouillé 24 h. Rendement maximal." },
];

export const getTier = (tierId) => STAKE_TIERS.find((t) => t.id === tierId) || STAKE_TIERS[0];

// === État par défaut du portefeuille ===
export const defaultCryptoState = (now = Date.now()) => ({
  name: CRMB.name,
  symbol: CRMB.symbol,
  balance: 0,
  // Total reçu en récompense (quêtes, paliers, succès, prestige)
  totalEarned: 0,
  // Marché
  price: CRMB.basePrice,
  priceHistory: [CRMB.basePrice],
  lastMarketTs: now,
  // Minage
  miners: {},
  totalMined: 0,
  // Staking: liste de positions { id, amount, tierId, startedAt, unlockAt }
  positions: [],
  lastYieldTs: now,
  // Statistiques
  totalBought: 0,
  totalSold: 0,
  realizedPnl: 0,
});

// === Marché ===

// Prix de référence: monte doucement avec la progression du joueur pour que
// le CRMB garde du sens en fin de partie, sans jamais exploser.
export const anchorPrice = (lifetime = 0) => {
  const growth = Math.log10(Math.max(10, lifetime) / 10) / 6; // ~+1 palier tous les 10^6
  return CRMB.basePrice * (1 + Math.max(0, growth));
};

/**
 * Fait avancer le marché d'un pas. Marche aléatoire avec retour à la moyenne.
 * @param {object} crypto - portefeuille courant
 * @param {number} lifetime - cookies cuits au total (ancre le prix)
 * @param {function} rng - générateur [0,1), injectable pour les tests
 */
export function stepMarket(crypto, lifetime = 0, rng = Math.random) {
  const anchor = anchorPrice(lifetime);
  const price = crypto.price || anchor;

  // Retour à la moyenne + bruit gaussien approximé (somme de 3 uniformes)
  const noise = ((rng() + rng() + rng()) / 3 - 0.5) * 2; // ~[-1,1] centré
  const meanReversion = (anchor - price) / anchor * 0.08;
  const volatility = 0.035;

  let next = price * (1 + meanReversion + noise * volatility);
  next = Math.max(anchor * CRMB.minPriceFactor, Math.min(anchor * CRMB.maxPriceFactor, next));

  const history = [...(crypto.priceHistory || []), next].slice(-CRMB.historyLength);
  return { price: next, priceHistory: history };
}

export const buyPrice = (price) => price * (1 + CRMB.spread);
export const sellPrice = (price) => price * (1 - CRMB.spread);

// Variation sur la fenêtre d'historique, pour l'affichage (+3,2 %)
export function priceTrend(priceHistory = []) {
  if (priceHistory.length < 2) return 0;
  const first = priceHistory[0];
  const last = priceHistory[priceHistory.length - 1];
  if (!first) return 0;
  return (last - first) / first;
}

// === Minage ===

export function minerCost(minerId, owned) {
  const m = MINERS.find((x) => x.id === minerId);
  if (!m) return Infinity;
  return Math.ceil(m.base * Math.pow(m.growth, owned));
}

// CRMB par seconde produit par le matériel
export function miningRate(miners = {}) {
  let perHour = 0;
  for (const m of MINERS) perHour += (miners[m.id] || 0) * m.perHour;
  return perHour / 3600;
}

// === Staking ===

export const stakedTotal = (positions = []) =>
  positions.reduce((sum, p) => sum + (p.amount || 0), 0);

/**
 * Boost de production apporté par le staking, **par paliers**.
 *
 * Le CRMB bloqué remplit un palier de l'échelle 1 · 2,5 · 5 · 10 · 25 …, et
 * franchir un palier ajoute +0,25. Auparavant une racine 0,7 produisait des
 * ×1,37 ou ×2,08 — exactement le genre de nombre qu'on ne veut plus voir.
 *
 * Le poids d'un CRMB dépend de la durée de blocage: bloquer plus longtemps fait
 * franchir les paliers plus vite, sans jamais casser la grille.
 */
export const stakeWeight = (positions = []) =>
  positions.reduce((sum, p) => sum + (p.amount || 0) * getTier(p.tierId).boostMult, 0);

// Échelle non arrondie: le CRMB se compte en fractions, les seuils suivent
// donc 1 · 2,5 · 5 · 10 · 25 tels quels, sans passer 2,5 à 3.
export const stakingTier = (positions = []) => tierState(stakeWeight(positions), 0, false);

export function stakingBoost(positions = []) {
  return stakingTier(positions).mult;
}

// Rendement CRMB par seconde généré par les positions de staking
export function stakingYieldPerSecond(positions = []) {
  let perSecond = 0;
  for (const p of positions) {
    const tier = getTier(p.tierId);
    perSecond += ((p.amount || 0) * tier.perDay) / 86_400;
  }
  return perSecond;
}

export const isUnlocked = (position, now = Date.now()) => now >= (position.unlockAt || 0);

// Arrondi monétaire — évite les dérives flottantes cumulées.
// Un montant non fini est ramené à 0 plutôt que propagé: un seul NaN dans une
// balance la contamine définitivement, et le joueur perd tout sans rien voir.
export const roundCrmb = (n) => (isFinite(n) ? Math.round((n + Number.EPSILON) * 1e6) / 1e6 : 0);
