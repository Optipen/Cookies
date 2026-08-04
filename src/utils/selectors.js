// === Valeurs dérivées ===
//
// Un seul endroit calcule la puissance de clic, le minage et les prix. Les
// noms internes gardent parfois « cpc » / « cps »; l'interface, elle, ne parle
// que de « puissance de clic » et de « minage ».

import { ITEMS, ITEM_BY_ID, BALANCE } from "../data/items.js";
import { getUpgrade, SHARE_BASE } from "../data/upgrades.js";
import { miningFrom, clickPowerFrom, computePerItemMult, globalBonus } from "./calc.js";
import { prestigeEffects } from "../data/prestige.js";
import { stakingTier, miningRate, stakingYieldPerSecond, ledgerSteps } from "./crypto.js";
import { chipTier } from "./calc.js";
import { comboMultiplier } from "./combo.js";
import { creditedRate } from "./rate.js";
import { lisible } from "./grid.js";
import tuning from "../data/tuning.json";

export const modeCfg = () => {
  const mode = tuning?.mode || "standard";
  return tuning?.[mode] || {};
};

const earlyCfg = () => modeCfg().early || {};

/**
 * Fenêtre de début de partie: premier Mineur offert, Mineurs à prix réduit.
 *
 * Le test portait sur `!!state.createdAt`, donc une partie créée à l'instant 0
 * — le cas de toute simulation, et de toute sauvegarde dont l'horodatage a été
 * remis à zéro — n'entrait JAMAIS dans la fenêtre. Ce qu'il faut vérifier,
 * c'est que la date existe et qu'elle est finie, pas qu'elle est non nulle.
 */
export const isEarlyWindow = (state, now = Date.now()) => {
  const windowS = earlyCfg().window_s || 0;
  const debut = state?.createdAt;
  if (windowS <= 0 || !Number.isFinite(debut)) return false;
  return now - debut < windowS * 1000;
};

/** Multiplicateurs propres ciblant explicitement la puissance de clic. */
export function clickUpgradeMult(upgrades = {}) {
  let m = 1;
  for (const id in upgrades) {
    if (!upgrades[id]) continue;
    const up = getUpgrade(id);
    if (up && up.target === "click" && up.type === "mult") m *= up.value;
  }
  return m;
}

// === Combo ===
// La formule vit dans `utils/combo.js`, seule source. Ré-exportée ici parce
// que l'interface et les tests la lisaient déjà à cette adresse.
export { COMBO, comboStep, comboMultiplier, comboProgress } from "./combo.js";

// === Reversement du minage vers le clic ===
//
// Filet de sécurité, à valeur fixe: même un joueur qui n'achèterait aucun
// Cliqueur garde un clic proportionnel à son empire. Ce n'est pas un axe de
// progression — le faire monter par améliorations faisait grimper le rapport
// actif/passif jusqu'à 8×.
export const shareOf = () => SHARE_BASE;

/**
 * Toutes les valeurs dérivées d'un état, en un seul passage.
 *
 * Formule complète:
 *   crans       = paliers(chips) + paliers(staking) + niveaux(arbre)
 *   global      = 1 + 0,25 × crans          ← un multiple de 0,25, toujours
 *   minage      = Σ(mineurs   × valeur × palier) × global
 *   clicPropre  = (1 + Σ(cliqueurs × valeur × palier) × global)
 *   parClic     = (clicPropre + minage × part) × combo × buff
 *
 * Les sources de bonus **additionnent leurs crans** au lieu de multiplier leurs
 * multiplicateurs: ×2,25 × ×1,25 valait ×2,8125 et un Curseur annonçait alors
 * « +2,81 /clic ». En sommant les crans on obtient ×2,75, et il annonce
 * « +2,75 ». C'est la même idée que la grille, appliquée à la composition.
 *
 * Les deux sommes sont linéaires et sans plafond: le millionième Cliqueur
 * ajoute exactement autant que le premier. L'équilibre entre les deux axes est
 * tenu par les prix, pas par un amortissement.
 */
export function deriveStats(state, now = Date.now(), comboStreak = 0) {
  const prestige = prestigeEffects(state);
  const positions = state.crypto?.positions || [];
  const stakeTier = stakingTier(positions);
  const stakeMult = stakeTier.mult;
  const chipTierState = chipTier(state.prestige?.chips || 0);

  const buffActive = (state.buffs?.until || 0) > now;
  const buffMine = buffActive ? state.buffs.cpsMulti || 1 : 1;
  const buffClick = buffActive ? state.buffs.cpcMulti || 1 : 1;

  // Un seul multiplicateur global par axe, obtenu en additionnant les crans de
  // toutes les sources. C'est cette addition qui garde les gains lisibles.
  const chips = state.prestige?.chips || 0;
  const items = state.items || {};
  const upgrades = state.upgrades || {};

  // Les contrats du Registre apportent des crans permanents aux deux axes: ils
  // s'additionnent à ceux de l'arbre céleste, comme toutes les autres sources.
  const registre = ledgerSteps(state.crypto?.ledger);
  const mineSteps = prestige.mineSteps + registre;
  const clickSteps = prestige.clickSteps + registre;

  const baseMining = miningFrom(items, upgrades, chips, stakeTier.steps, mineSteps);
  const mining = baseMining * buffMine;

  const buildingsPower = clickPowerFrom(items, upgrades, chips, stakeTier.steps, clickSteps);
  const ownPower = (state.cpcBase || 1) + buildingsPower;
  const flatClick = ownPower * clickUpgradeMult(upgrades);

  const share = shareOf();
  const sharedClick = baseMining * share;

  const combo = comboMultiplier(comboStreak);
  const perClickNoCombo = (flatClick + sharedClick) * buffClick;
  const perClick = perClickNoCombo * combo;

  return {
    // Noms « métier »
    mining,
    baseMining,
    perClick,
    perClickNoCombo,
    flatClick,
    sharedClick,
    ownPower,
    buildingsPower,
    share,
    combo,

    // Alias historiques, encore lus par quelques modules
    cps: mining,
    baseCps: baseMining,
    cpc: perClick,
    cpcBase: perClickNoCombo,

    stakeMult,
    // Paliers en cours, pour les barres de progression: le multiplicateur ne
    // bouge pas entre deux crans, mais on voit le suivant approcher.
    chipTier: chipTierState,
    stakeTier,
    // Multiplicateur global effectif de chaque axe, tel qu'on peut l'annoncer.
    mineMult: globalBonus(chips, stakeTier.steps, mineSteps),
    clickMult: globalBonus(chips, stakeTier.steps, clickSteps),
    ledger: registre,
    prestige,
    buffActive,
    buffCps: buffMine,
    buffCpc: buffClick,
    perItemMult: computePerItemMult(items, upgrades),
    // Matériel d'extraction CRMB — sans rapport avec le minage de cookies
    crmbRate: miningRate(state.crypto?.miners) * prestige.cryptoMult,
    stakingYield: stakingYieldPerSecond(positions) * prestige.cryptoMult,
  };
}

// Référence de calibration: le joueur actif « normal ». Cinq clics par seconde
// est ce qu'on tient réellement au pouce sur mobile — sept était une cadence de
// souris soutenue, irréaliste comme moyenne.
//
// Le combo de référence est celui qu'on tient EN MOYENNE, pas son maximum. Une
// rafale d'une minute passe 2,4 s à ×1, 2,4 s à ×1,25, 2,4 s à ×1,50 puis le
// reste à ×1,75, soit une moyenne de ×1,69; une session hachée de rafales de
// vingt secondes tombe à ×1,57. ×1,50 est la valeur de la grille qui décrit
// honnêtement ce mélange, sans flatter le joueur actif.
export const REF_CLICKS_PER_SECOND = BALANCE.reference_clicks_per_second ?? 5;
export const REF_COMBO = BALANCE.reference_combo ?? 1.5;

/**
 * Revenu par seconde d'un joueur actif, pour comparer au mode passif.
 *
 * Même définition que `activeRatio`: combo MOYEN, pas combo maximum. Les deux
 * fonctions décrivaient auparavant deux joueurs différents — l'une supposait un
 * combo plein en permanence, l'autre la moyenne réellement tenue.
 */
export function activeIncome(state, clicksPerSecond = REF_CLICKS_PER_SECOND, now = Date.now(), combo = REF_COMBO) {
  const stats = deriveStats(state, now);
  return stats.mining + stats.perClickNoCombo * combo * clicksPerSecond;
}

/**
 * Rapport entre jeu actif et jeu passif. Sert au diagnostic d'équilibrage.
 *
 * Dérivé de `activeIncome`, jamais recalculé: les deux fonctions décrivaient
 * autrefois deux joueurs différents — l'une supposait un combo plein en
 * permanence, l'autre la moyenne réellement tenue.
 */
export function activeRatio(state, clicksPerSecond = REF_CLICKS_PER_SECOND, now = Date.now(), combo = REF_COMBO) {
  const mining = deriveStats(state, now).mining;
  if (mining <= 0) return Infinity;
  return activeIncome(state, clicksPerSecond, now, combo) / mining;
}

/**
 * Les cinq chiffres de l'écran, calculés en un seul endroit.
 *
 *      Par clic × Cadence  =  Clics
 *                            + Minage
 *                            ─────────
 *                            = Total
 *
 * Trois règles, et elles se tiennent:
 *
 * · **La cadence affichée ne compte que les clics CRÉDITÉS.** Afficher la
 *   cadence brute ferait multiplier deux nombres qui ne se multiplient pas:
 *   « 50 /s » × « 12 par clic » ne donnerait pas la production annoncée. Le
 *   joueur lit donc au plus quinze — et on lui dit pourquoi (`bornee`) plutôt
 *   que de le laisser croire qu'accélérer sert encore.
 * · **La production annoncée découle de cette même cadence.** Annoncer
 *   « 50 clics/s de production » quand la banque n'en crédite que quinze serait
 *   une promesse que le solde ne tient pas.
 * · **Au repos, le total vaut le minage EXACTEMENT.** Pas « à peu près »: si la
 *   colonne du milieu s'éteint, la somme doit s'éteindre avec elle.
 *
 * Le minage n'est jamais compté deux fois. La part reversée fait qu'un Mineur
 * augmente aussi la puissance de clic, mais c'est un gain versé À CHAQUE CLIC,
 * dans une autre unité — il disparaît intégralement dès que la cadence tombe à
 * zéro, ce qu'aucun double comptage ne ferait.
 */
export function productionStats(stats, cadence = 0) {
  const brute = Number(cadence);
  const mesuree = Number.isFinite(brute) && brute > 0 ? brute : 0;
  const creditee = creditedRate(mesuree);
  const prodClics = creditee > 0 ? stats.perClickNoCombo * stats.combo * creditee : 0;
  return {
    parClic: stats.perClick,
    cadence: mesuree,
    creditee,
    prodClics,
    minage: stats.mining,
    total: stats.mining + prodClics,
    actif: creditee > 0,
    // La cadence est bornée: le joueur doit pouvoir comprendre pourquoi
    // accélérer encore ne change plus rien.
    bornee: mesuree > creditee,
  };
}

// === Prix ===

const MAX_BULK = 1000;

/**
 * Prix du n-ième exemplaire, arrondi à deux chiffres significatifs.
 *
 * `base × 1,22^n` donne 149, 182, 222, 271, 330… Ces nombres sont exacts mais
 * illisibles; à deux chiffres significatifs ils deviennent 150, 180, 220, 270,
 * 330 tout en restant strictement croissants — le prix ne doit jamais stagner
 * d'un exemplaire au suivant, sinon on en achète deux au même tarif.
 */
export const unitPrice = (item, index) => lisible(item.base * Math.pow(item.growth, index));

/**
 * Prix de `count` exemplaires à partir de `owned`.
 *
 * La somme est calculée exemplaire par exemplaire, sur les prix ARRONDIS: un
 * achat groupé coûte donc exactement ce que coûteraient les achats un par un.
 * La formule fermée d'une suite géométrique ne le garantissait plus une fois
 * les prix arrondis.
 *
 * Il n'y a pas de renchérissement par paliers: il compliquait la formule,
 * créait des murs de progression, et son application au lot entier rendait
 * l'achat groupé 15,8 fois moins cher que les achats unitaires.
 */
export function bulkCost(item, owned, count) {
  const n = Math.min(MAX_BULK, Math.max(0, Math.floor(count)));
  if (n === 0) return 0;
  let total = 0;
  for (let k = 0; k < n; k++) {
    total += unitPrice(item, owned + k);
    if (!isFinite(total)) return Infinity;
  }
  return total;
}

/**
 * Produit de toutes les remises applicables à un exemplaire de `item`.
 * Séparé du calcul du prix pour qu'il n'existe qu'une définition des remises.
 */
function remises(state, item, now) {
  let m = prestigeEffects(state).costMult;

  if (item.mode === "mine" && isEarlyWindow(state, now)) m *= 1 - (earlyCfg().miner_discount || 0);

  const discount = state.flags?.discountAll;
  if (discount && now < discount.until) m *= 1 - (discount.value || 0);

  const flash = state.flags?.flash;
  if (flash && flash.itemId === item.id && now < flash.until) m *= 1 - flash.discount;

  return m;
}

/** Le premier exemplaire du lot est-il offert ? */
function premierOffert(state, item, now) {
  // Tout premier Curseur, avant même d'avoir vu l'écran d'accueil.
  if (!state.ui?.introSeen && item.id === "cursor" && !(state.items?.cursor > 0)) return true;

  if (item.mode !== "mine" || !isEarlyWindow(state, now)) return false;
  if (!earlyCfg().free_first_miner || !state.ui?.introSeen) return false;
  if (state.flags?.freeFirstAutoGiven) return false;
  const candidat = state.flags?.freeFirstAutoItemId || ITEMS.find((x) => x.mode === "mine")?.id;
  if (item.id !== candidat) return false;
  const mineursPossedes = ITEMS.filter((x) => x.mode === "mine").reduce((a, x) => a + (state.items?.[x.id] || 0), 0);
  return mineursPossedes === 0;
}

/**
 * Prix final d'un achat, remises comprises. Entier ≥ 1, sauf gratuité explicite.
 *
 * Chaque exemplaire est remisé et arrondi SÉPARÉMENT, puis les prix sont
 * additionnés. Appliquer la remise à la somme puis arrondir une seule fois
 * rendait le lot moins cher que les achats un par un — mesuré: 99 822 au lieu
 * de 99 825 sur dix Boulangeries avec deux remises cumulées. Trois cookies,
 * mais c'est une remise cachée que rien n'annonce, et elle grandit avec le lot.
 *
 * Le premier exemplaire offert vaut pour la première unité du lot, quelle que
 * soit sa taille: sinon « ×10 » sur le Mineur offert le facturait plein tarif.
 */
export function costOf(state, itemId, count = 1, now = Date.now()) {
  const item = ITEM_BY_ID[itemId];
  if (!item) return Infinity;

  const n = Math.min(MAX_BULK, Math.max(0, Math.floor(count)));
  if (n === 0) return 0;

  const owned = state.items?.[itemId] || 0;
  const mult = remises(state, item, now);
  const offert = premierOffert(state, item, now);

  let total = 0;
  for (let k = 0; k < n; k++) {
    if (k === 0 && offert) continue;
    const brut = unitPrice(item, owned + k);
    if (!isFinite(brut)) return Infinity;
    total += Math.max(1, Math.ceil(brut * mult));
    if (!isFinite(total)) return Infinity;
  }
  return total;
}

/** Quantité d'achat selon les modificateurs clavier. */
export const buyQuantity = (event) => (event?.shiftKey ? 10 : event?.ctrlKey || event?.metaKey ? 100 : 1);

/** Nombre maximal d'exemplaires achetables avec la banque actuelle. */
export function maxAffordable(state, itemId, cap = MAX_BULK, now = Date.now()) {
  let lo = 0;
  let hi = cap;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (costOf(state, itemId, mid, now) <= state.cookies) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Temps estimé avant de pouvoir s'offrir `price`, en millisecondes. */
export function timeToAfford(state, price, stats, clicksPerSecond = 0) {
  const missing = price - (state.cookies || 0);
  if (missing <= 0) return 0;
  const income = stats.mining + stats.perClickNoCombo * clicksPerSecond;
  if (income <= 0) return Infinity;
  return (missing / income) * 1000;
}
