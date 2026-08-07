// === Formatage ===
//
// Un seul endroit décide de la façon dont un nombre s'écrit. La locale est
// figée: sans elle, `toLocaleString` suit la langue du navigateur et le même
// solde s'affiche « 1,234.56 » chez l'un et « 1 234,56 » chez l'autre.
//
// Règle qui prime sur toutes les autres: **un nombre affiché n'annonce jamais
// plus que le nombre calculé**. 401,75 s'écrivait « 401,8 » — une décimale
// supprimée sur une valeur qui en avait deux, si bien que 401,75 et 401,8
// devenaient le même texte. Sous le seuil d'abréviation, la valeur est donc
// écrite en toutes lettres; au-dessus, elle est TRONQUÉE, jamais arrondie vers
// le haut: on n'a pas « 1M » tant qu'on n'a pas le millionième cookie.
//
// Deuxième règle, et elle a coûté une refonte: **un compteur qui monte doit se
// voir monter, dans une seule unité à la fois.** L'abréviation refusait toute
// décimale derrière un suffixe et descendait d'un cran pour l'éviter. La suite
// affichée sautait alors d'une unité à l'autre et revenait en arrière:
//
//     999K → 1M → 1 100K → 1 200K → 2M → 2 500K → 20 900K → 123M
//
// Personne ne lit ça comme une progression — « 2 000K » pour deux millions,
// disait le joueur, « visuellement ce n'est pas joli ». La même suite
// aujourd'hui, à trois chiffres significatifs et une seule unité par palier:
//
//     999K → 1M → 1,1M → 1,2M → 2M → 2,5M → 20,9M → 123M → 1B

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
 * Rang du suffixe: le plus grand dont la mantisse reste au-dessus de un.
 *
 * Le logarithme flotte — `Math.log10(1e21)/3` ne vaut pas exactement 7 — et un
 * rang faux d'un cran change l'unité affichée. On le recale donc par
 * comparaison directe, qui, elle, ne ment jamais.
 */
function rangSuffixe(abs) {
  let k = Math.floor(Math.log10(abs) / 3);
  if (!Number.isFinite(k)) k = 0;
  while (k > 0 && abs < Math.pow(1000, k)) k -= 1;
  while (k < SUFFIXES.length - 1 && abs >= Math.pow(1000, k + 1)) k += 1;
  return Math.max(0, Math.min(SUFFIXES.length - 1, k));
}

/** Le produit `m × p` débarrassé du bruit du binaire (1,23 × 100 = 122,999…). */
const sansBruit = (v) => Number(v.toPrecision(12));

/**
 * Forme compacte: **une seule unité par palier, trois chiffres significatifs,
 * tronqués.**
 *
 *     1 000 000 → 1M        1 234 567 → 1,23M      20 941 234 → 20,9M
 *     1 200 000 → 1,2M      5 750 000 → 5,75M     123 456 789 → 123M
 *
 * Trois chiffres significatifs, parce que c'est le plus petit nombre qui laisse
 * VOIR un compteur monter: à deux, « 1,2M » resterait figé cent mille cookies
 * durant. Tronqués et non arrondis, parce qu'un joueur à 999 999 cookies n'a
 * pas un million — « 999K » est vrai, « 1M » ne l'est pas encore. Et les zéros
 * de queue tombent: « 2M », pas « 2,00M ».
 */
function compact(n) {
  const signe = n < 0 ? -1 : 1;
  const abs = Math.abs(n);

  // Au-delà du dernier suffixe, un nom inventé serait un mensonge: on passe à
  // la notation scientifique, que tout le monde sait lire pour ce qu'elle est.
  if (abs >= Math.pow(1000, SUFFIXES.length)) {
    return (signe * abs).toExponential(2).replace(".", ",");
  }

  const k = rangSuffixe(abs);
  const mant = abs / Math.pow(1000, k);
  // Trois chiffres significatifs: 124 · 20,9 · 1,23
  const dec = mant >= 100 ? 0 : mant >= 10 ? 1 : 2;
  const p = Math.pow(10, dec);
  const tronque = Math.floor(sansBruit(mant * p)) / p;
  return loc(signe * tronque, dec) + SUFFIXES[k];
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
 * SEULEMENT si elle est exacte, sinon le nombre plein, aussi long soit-il.
 *
 * « Exacte » veut maintenant dire *à trois décimales près dans l'unité du
 * solde* — « 1,248M » — et non plus *entière dans l'unité d'en dessous* —
 * « 1 248K ». Le prix payé est le même; ce qui change, c'est qu'il se lit dans
 * la MÊME unité que le solde juste au-dessus. Comparer « 1 248K » à un solde
 * de « 1,2M » demandait une conversion mentale à chaque achat.
 */
export function fmtPrix(n) {
  const v = nombre(n);
  if (v === null) return "0";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
  const abs = Math.abs(v);
  if (abs < 1_000_000) return loc(Math.round(v), 0);
  // Au-delà des suffixes nommés, le nombre plein n'aide personne.
  if (abs >= Math.pow(1000, SUFFIXES.length)) return compact(v);

  const k = rangSuffixe(abs);
  const mant = sansBruit(abs / Math.pow(1000, k));
  const millimes = sansBruit(mant * 1000);
  if (Math.abs(millimes - Math.round(millimes)) < 1e-6) {
    return loc((Math.sign(v) * Math.round(millimes)) / 1000, 3) + SUFFIXES[k];
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
 *
 * Passé cent mille, il abrège comme tout le reste: un multiplicateur global de
 * fin de partie s'écrivait « ×1500000000 » — sans le moindre séparateur, parce
 * que le cas entier partait droit sur `String(v)`.
 */
export function fmtMult(n) {
  const v = nombre(n);
  if (v === null) return "1";
  if (!Number.isFinite(v)) return "∞";
  if (Math.abs(v) >= COMPACT_FROM) return compact(v);
  return Number.isInteger(v) ? loc(v, 0) : loc(v, 2, 2);
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

/**
 * Durée lisible: 12s · 4m 30s · 2h 05m · 5j 03h
 *
 * Deux unités au plus, la plus grande d'abord — comme les nombres, qui ne
 * s'écrivent que dans une seule unité. Le jour manquait, et une partie de deux
 * semaines s'annonçait « 336h 00m »: un nombre d'heures à quatre chiffres ne
 * se lit pas, il se calcule.
 */
export function fmtDuration(ms) {
  const v = nombre(ms);
  if (v === null || !Number.isFinite(v) || v <= 0) return "0s";
  const total = Math.floor(v / 1000);
  const j = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (j > 0) return `${loc(j, 0)}j ${String(h).padStart(2, "0")}h`;
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
  // Le centime n'a plus de sens à cette échelle, et « 99 000 000 » déborde de
  // la pastille de l'en-tête: au-delà du seuil général, le CRMB abrège comme
  // les cookies.
  if (Math.abs(v) >= COMPACT_FROM) return compact(v);
  return loc(v, Math.min(2, digits));
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
