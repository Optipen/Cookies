// Formatage centralisé — locale figée pour un rendu identique partout
// (sans locale explicite, toLocaleString varie selon le navigateur du joueur).
export const LOCALE = "fr-FR";

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud", "Dd"];

const scale = (n) => {
  let i = 0;
  let value = n;
  while (Math.abs(value) >= 1000 && i < SUFFIXES.length - 1) {
    value /= 1000;
    i++;
  }
  return { value, suffix: SUFFIXES[i], tier: i };
};

// Nombre compact: 1,5K · 12,34M · 999
export const fmt = (n) => {
  if (!isFinite(n)) return "∞";
  if (!n) return "0";
  const { value, suffix, tier } = scale(n);
  let digits = 2;
  if (tier === 0) {
    // Sous 1, arrondir à une décimale écrasait les petits montants:
    // un objectif de 0,05 CRMB s'affichait « 0,1 ».
    if (Number.isInteger(value)) digits = 0;
    else if (Math.abs(value) < 1) digits = 3;
    else digits = 1;
  }
  return value.toLocaleString(LOCALE, { maximumFractionDigits: digits }) + suffix;
};

// Entier compact pour le compteur central: 1,00K · 10,50M
export const fmtInt = (n) => {
  if (!isFinite(n)) return "∞";
  const { value, suffix, tier } = scale(Math.max(0, n));
  if (tier === 0) return Math.floor(value).toLocaleString(LOCALE);
  return value.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
};

/**
 * Multiplicateur de la grille: 1 · 1,25 · 1,50 · 1,75 · 2 · 2,25 …
 *
 * Un entier s'écrit nu — « ×2 », pas « ×2,00 ». Une fraction garde ses deux
 * décimales pour que ×1,50 et ×1,75 s'alignent à l'œil. Les valeurs étant
 * choisies sur la grille, ce formatage n'arrondit jamais rien de visible.
 */
export const fmtMult = (n) => {
  if (!isFinite(n)) return "∞";
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Pourcentage lisible: +12 % · -5,5 %
export const fmtPct = (ratio, digits = 0) => {
  if (!isFinite(ratio)) return "∞";
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : "";
  return sign + pct.toLocaleString(LOCALE, { maximumFractionDigits: digits }) + " %";
};

// Durée lisible: 12s · 4m 30s · 2h 05m
export const fmtDuration = (ms) => {
  if (!isFinite(ms) || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
};

// Chrono mm:ss pour les missions minutées
export const fmtClock = (ms) => {
  if (!isFinite(ms) || ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// Montant CRMB — précision fine, la monnaie vaut cher
export const fmtCrmb = (n, digits = 3) => {
  if (!isFinite(n)) return "∞";
  return n.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
