// === Formatage ===
//
// Un seul endroit décide de la façon dont un nombre s'écrit. La locale est
// figée: sans elle, `toLocaleString` suit la langue du navigateur et le même
// solde s'affiche « 1,234.56 » chez l'un et « 1 234,56 » chez l'autre.
//
// Règle qui prime sur toutes les autres: **un nombre affiché est le nombre
// calculé**. 401,75 s'écrivait « 401,8 » — une décimale supprimée sur une
// valeur qui en avait deux, si bien que 401,75 et 401,8 devenaient le même
// texte. Une abréviation qui fabrique une décimale là où le nombre n'en avait
// pas (« 1,72K » pour 1 720) tombe sous la même règle.

export const LOCALE = "fr-FR";

/**
 * Seuil à partir duquel on abrège.
 *
 * Cent mille: en dessous, le nombre entier tient à l'écran et se lit d'un coup
 * (« 12 345 »). Au-dessus, personne ne lit les chiffres du milieu et la forme
 * compacte devient la plus honnête des deux.
 */
export const COMPACT_FROM = 100_000;

/** En dessous, on ne prétend pas afficher la valeur: on dit qu'elle est petite. */
const EPSILON_AFFICHABLE = 0.01;

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud", "Dd"];

const nombre = (n) => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isNaN(v) ? null : v;
};

const loc = (v, max, min = 0) =>
  v.toLocaleString(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max });

/**
 * Forme compacte à trois chiffres significatifs: 1,23M · 12,3M · 123M.
 *
 * L'arrondi peut faire franchir le millier — 999 999 999 arrondi à trois
 * chiffres vaut 1 000 M. On remonte alors d'un cran plutôt que d'écrire
 * « 1 000M », qui est à la fois plus long et moins lisible que « 1B ».
 */
function compact(n) {
  const signe = n < 0 ? -1 : 1;
  let abs = Math.abs(n);
  let cran = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(abs) / 3));
  let valeur = abs / Math.pow(1000, cran);

  // Une mantisse posée sur la grille des quarts s'affiche EXACTEMENT, quelle
  // que soit sa taille: « 11,75M » plutôt que « 11,8M ». Les prix sont tous
  // construits ainsi; les autres nombres gardent les trois chiffres
  // significatifs habituels.
  const decimales = (v) => {
    const quarts = v * 4;
    if (Math.abs(quarts - Math.round(quarts)) < 1e-6) {
      const q = Math.round(quarts);
      return q % 4 === 0 ? 0 : q % 2 === 0 ? 1 : 2;
    }
    return v >= 100 ? 0 : v >= 10 ? 1 : 2;
  };
  let arrondi = Number(valeur.toFixed(decimales(valeur)));
  if (arrondi >= 1000 && cran < SUFFIXES.length - 1) {
    cran += 1;
    valeur = abs / Math.pow(1000, cran);
    arrondi = Number(valeur.toFixed(decimales(valeur)));
  }

  // Au-delà du dernier suffixe, un nom inventé serait un mensonge: on passe à
  // la notation scientifique, que tout le monde sait lire pour ce qu'elle est.
  if (cran >= SUFFIXES.length - 1 && abs >= Math.pow(1000, SUFFIXES.length)) {
    return (signe * abs).toExponential(2).replace(".", ",");
  }

  return loc(signe * arrondi, decimales(arrondi)) + SUFFIXES[cran];
}

/**
 * Le formateur général.
 *
 * Exact tant que le nombre tient en toutes lettres, compact au-delà. Jamais
 * d'abréviation sous cent mille: « 1 720 » plutôt que « 1,72K ».
 */
export function fmt(n) {
  const v = nombre(n);
  if (v === null) return "0";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
  if (v === 0) return "0";

  const abs = Math.abs(v);
  if (abs < EPSILON_AFFICHABLE) return v > 0 ? "<0,01" : ">-0,01";
  // Sous mille: la valeur exacte, décimales comprises, sans zéro superflu.
  if (abs < 1000) return loc(v, 2);

  const entier = Math.round(v);
  if (Math.abs(entier) < COMPACT_FROM) return loc(entier, 0);
  return compact(v);
}

/**
 * Valeur exacte, jamais abrégée.
 *
 * Pour les fiches de boutique: la valeur propre d'un bâtiment est le nombre
 * rond de sa fiche, la compacter lui ferait perdre sa raison d'être. Elle ne
 * dépasse jamais 80 000, elle tient donc toujours sur la ligne.
 */
export function fmtExact(n) {
  const v = nombre(n);
  if (v === null) return "0";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
  return loc(v, 2);
}

/**
 * Solde, en entier.
 *
 * Le solde bouge dix fois par seconde: deux décimales qui clignotent ne
 * s'attrapent pas à l'œil, et un solde ne s'affiche jamais négatif.
 */
export function fmtInt(n) {
  const v = nombre(n);
  if (v === null) return "0";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "0";
  const positif = Math.max(0, v);
  if (positif < COMPACT_FROM) return loc(Math.floor(positif), 0);
  return compact(positif);
}

/**
 * Multiplicateur de la grille: 1 · 1,25 · 1,50 · 1,75 · 2 · 2,25 …
 *
 * Un entier s'écrit nu — « ×2 », pas « ×2,00 ». Une fraction garde ses deux
 * décimales pour que ×1,50 et ×1,75 s'alignent à l'œil. Les valeurs étant
 * choisies sur la grille, ce formatage n'arrondit jamais rien de visible.
 */
export function fmtMult(n) {
  const v = nombre(n);
  if (v === null) return "1";
  if (!Number.isFinite(v)) return "∞";
  return Number.isInteger(v) ? String(v) : loc(v, 2, 2);
}

/**
 * Valeur MESURÉE, préfixée du signe « environ ».
 *
 * Une cadence est une moyenne glissante sur trois secondes. L'écrire
 * « 4,25 /s » tout court serait faussement précis: le nombre est vrai, mais la
 * précision qu'il suggère ne l'est pas.
 */
export const fmtApprox = (n) => `≈${fmt(n)}`;

/** Pourcentage lisible: +12 % · -5,5 % */
export function fmtPct(ratio, digits = 0) {
  const v = nombre(ratio);
  if (v === null || !Number.isFinite(v)) return "∞";
  const pct = v * 100;
  return (pct > 0 ? "+" : "") + loc(pct, digits) + " %";
}

/** Durée lisible: 12s · 4m 30s · 2h 05m */
export function fmtDuration(ms) {
  const v = nombre(ms);
  if (v === null || !Number.isFinite(v) || v <= 0) return "0s";
  const total = Math.floor(v / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Chrono mm:ss pour les compte-à-rebours */
export function fmtClock(ms) {
  const v = nombre(ms);
  if (v === null || !Number.isFinite(v) || v <= 0) return "00:00";
  const total = Math.ceil(v / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Montant CRMB. Deux décimales au plus, aucune quand le montant est entier.
 *
 * Les trois décimales fixes dataient du faucet, qui versait 0,001 à la fois.
 * Le CRMB se gagne désormais par unités entières: « 17,000 » se lisait comme
 * dix-sept mille alors qu'il s'agit de dix-sept pièces.
 */
export function fmtCrmb(n, digits = 2) {
  const v = nombre(n);
  if (v === null || !Number.isFinite(v)) return "∞";
  return loc(v, digits);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
