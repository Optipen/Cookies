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
 * Forme compacte SANS décimale: « 1 910K » plutôt que « 1,91M ».
 *
 * Un suffixe ne porte jamais de virgule. Quand la mantisse à trois chiffres
 * significatifs en aurait une, on descend d'un suffixe pour retrouver un
 * entier: 5 750 000 s'écrit « 5 750K », 20 941 234 s'écrit « 20 900K ».
 * Et un nombre exactement représentable s'affiche EXACTEMENT — les prix sont
 * posés sur 0,25 × 10^k, « 11,8M » pour 11 750 000 serait un mensonge; on
 * écrit « 11 750K ». La mantisse entière la plus haute gagne: « 25M », pas
 * « 25 000K ».
 */
function compact(n) {
  const signe = n < 0 ? -1 : 1;
  const abs = Math.abs(n);

  // Au-delà du dernier suffixe, un nom inventé serait un mensonge: on passe à
  // la notation scientifique, que tout le monde sait lire pour ce qu'elle est.
  if (abs >= Math.pow(1000, SUFFIXES.length)) {
    return (signe * abs).toExponential(2).replace(".", ",");
  }

  // 1. La représentation exacte, si elle existe: la plus grande unité dont la
  //    mantisse est un entier d'au plus cinq chiffres.
  for (let k = SUFFIXES.length - 1; k >= 1; k--) {
    const mant = abs / Math.pow(1000, k);
    if (mant >= 1 && mant <= 99_999 && Math.abs(mant - Math.round(mant)) < 1e-9) {
      return loc(signe * Math.round(mant), 0) + SUFFIXES[k];
    }
  }

  // 2. Sinon, trois chiffres significatifs — et si la mantisse arrondie garde
  //    une décimale, elle descend d'un suffixe pour redevenir entière.
  const ordre = Math.floor(Math.log10(abs));
  const arrondi = Math.round(abs / Math.pow(10, ordre - 2)) * Math.pow(10, ordre - 2);
  let cran = Math.min(SUFFIXES.length - 1, Math.floor((Math.log10(arrondi) + 1e-9) / 3));
  let mant = arrondi / Math.pow(1000, cran);
  if (Math.abs(mant - Math.round(mant)) > 1e-9 && cran >= 1) {
    cran -= 1;
    mant = arrondi / Math.pow(1000, cran);
  }
  return loc(signe * Math.round(mant), 0) + SUFFIXES[cran];
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
 * PRIX affiché = prix payé, sans exception.
 *
 * Un prix de lot est une somme exacte d'unités: il peut valoir 124 800, que le
 * compact à trois chiffres écrirait « 125K » — un mensonge de 200 cookies.
 * Règle: en dessous du million, le nombre plein; au-delà, la forme compacte
 * SEULEMENT si elle est exacte (mantisse entière, jusqu'à six chiffres —
 * « 1 248K », « 124 800K »), sinon le nombre plein, aussi long soit-il.
 */
export function fmtPrix(n) {
  const v = nombre(n);
  if (v === null) return "0";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
  const abs = Math.abs(v);
  if (abs < 1_000_000) return loc(Math.round(v), 0);
  for (let k = SUFFIXES.length - 1; k >= 1; k--) {
    const mant = abs / Math.pow(1000, k);
    if (mant >= 1 && mant <= 999_999 && Math.abs(mant - Math.round(mant)) < 1e-9) {
      return loc(Math.sign(v) * Math.round(mant), 0) + SUFFIXES[k];
    }
  }
  return loc(Math.round(v), 0);
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
 * Montant CRMB. DEUX décimales au plus — le CRMB vit en centimes — et aucune
 * quand elles ne servent pas: « 1 », pas « 1,00 »; « 1,5 », pas « 1,50 »;
 * « 1,05 » quand le centime compte. Un taux non nul sous le demi-centime
 * s'annonce « <0,01 » plutôt que de s'afficher « 0 ».
 */
export function fmtCrmb(n, digits = 2) {
  const v = nombre(n);
  if (v === null || !Number.isFinite(v)) return "∞";
  if (v > 0 && v < 0.005) return "<0,01";
  return loc(v, Math.min(2, digits));
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
