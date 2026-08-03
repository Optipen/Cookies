// === CrumbCoin (CRMB) — économie complète ===
// Marché à prix variable, minage matériel, staking à paliers verrouillés.
// Tout est en fonctions pures pour rester testable hors React.

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
// Produit du CRMB passivement. Coût en cookies, croissance exponentielle.
export const MINERS = [
  { id: "cpu", name: "Vieux CPU", emoji: "💻", base: 250_000, growth: 1.18, rate: 0.00040, desc: "Un portable qui chauffe. Ça mine, lentement." },
  { id: "gpu", name: "Carte graphique", emoji: "🎮", base: 4_000_000, growth: 1.19, rate: 0.0035, desc: "Le classique. Bruyant mais efficace." },
  { id: "asic", name: "Rig ASIC", emoji: "🖥️", base: 60_000_000, growth: 1.20, rate: 0.028, desc: "Matériel dédié, rendement sérieux." },
  { id: "farm", name: "Ferme de minage", emoji: "🏗️", base: 900_000_000, growth: 1.21, rate: 0.22, desc: "Un hangar entier de rigs." },
  { id: "quantum", name: "Mineur quantique", emoji: "⚛️", base: 15_000_000_000, growth: 1.22, rate: 1.8, desc: "Il mine dans plusieurs réalités à la fois." },
];

// === Paliers de staking ===
// Plus le verrou est long, plus le rendement et le boost de production sont élevés.
export const STAKE_TIERS = [
  { id: "flex", name: "Flexible", lockMs: 0, apr: 0.05, boostMult: 1.0, desc: "Retrait à tout moment." },
  { id: "short", name: "1 heure", lockMs: 3_600_000, apr: 0.18, boostMult: 1.25, desc: "Verrouillé 1 h." },
  { id: "mid", name: "6 heures", lockMs: 21_600_000, apr: 0.45, boostMult: 1.6, desc: "Verrouillé 6 h." },
  { id: "long", name: "24 heures", lockMs: 86_400_000, apr: 1.2, boostMult: 2.2, desc: "Verrouillé 24 h. Rendement maximal." },
];

export const getTier = (tierId) => STAKE_TIERS.find((t) => t.id === tierId) || STAKE_TIERS[0];

// === État par défaut du portefeuille ===
export const defaultCryptoState = (now = Date.now()) => ({
  name: CRMB.name,
  symbol: CRMB.symbol,
  balance: 0,
  // Faucet historique: du CRMB offert à mesure que l'on cuit des cookies
  mintedUnits: 0,
  perCookies: 20_000,
  perAmount: 0.001,
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
  let rate = 0;
  for (const m of MINERS) rate += (miners[m.id] || 0) * m.rate;
  return rate;
}

// === Staking ===

export const stakedTotal = (positions = []) =>
  positions.reduce((sum, p) => sum + (p.amount || 0), 0);

/**
 * Boost de production global apporté par le staking.
 * Racine 0,7 pour des rendements décroissants: 1 CRMB flex ≈ +35 %.
 */
export function stakingBoost(positions = []) {
  let weighted = 0;
  for (const p of positions) {
    const tier = getTier(p.tierId);
    weighted += (p.amount || 0) * tier.boostMult;
  }
  if (weighted <= 0) return 1;
  return 1 + Math.pow(weighted, 0.7) * 0.35;
}

// Rendement CRMB par seconde généré par les positions de staking
export function stakingYieldPerSecond(positions = []) {
  let perSecond = 0;
  for (const p of positions) {
    const tier = getTier(p.tierId);
    perSecond += ((p.amount || 0) * tier.apr) / (365 * 24 * 3600);
  }
  return perSecond;
}

export const isUnlocked = (position, now = Date.now()) => now >= (position.unlockAt || 0);

// Arrondi monétaire — évite les dérives flottantes cumulées
export const roundCrmb = (n) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
