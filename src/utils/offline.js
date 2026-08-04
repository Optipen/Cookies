// === Retour hors-ligne ===
//
// Ce que le joueur trouve en revenant. Fonction pure, hors de React: c'est ce
// qui permet de la tester avec une horloge fixée, y compris dans les cas où
// l'horloge système a reculé ou sauté de dix ans.
//
// Le rendement est volontairement DÉGRESSIF. Généreux la première dizaine de
// minutes — revenir après une pause café doit valoir quelque chose — puis
// faible, et plafonné à deux heures. Sans plafond, laisser le jeu fermé une
// semaine rapporterait plus que d'y jouer.

import { deriveStats } from "./selectors.js";
import { prestigeEffects } from "../data/prestige.js";
import tuning from "../data/tuning.json";

const cfg = () => tuning?.[tuning?.mode || "standard"]?.offline || {};

/** En dessous, l'absence ne compte pas: on n'annonce rien pour dix secondes. */
export const OFFLINE_MIN_MS = 60_000;

/**
 * Gains d'un retour après `awayMs` d'absence.
 *
 * @returns {{durationMs, cappedS, ratio, cookies, crmb, vaut}} `vaut` dit s'il
 * y a quelque chose à annoncer. Les montants sont toujours finis et positifs.
 */
export function offlineGains(state, awayMs, now = Date.now()) {
  const c = cfg();
  const maxSeconds = c.max_seconds ?? 7200;
  const r0 = c.ratio_0_10min ?? 0.08;
  const r1 = c.ratio_2h ?? 0.02;

  // Une absence négative n'existe pas: l'horloge a reculé, pas le temps.
  const duree = Number.isFinite(awayMs) && awayMs > 0 ? awayMs : 0;
  const cappedS = Math.min(duree / 1000, maxSeconds);

  if (duree < OFFLINE_MIN_MS) {
    return { durationMs: duree, cappedS: 0, ratio: 0, cookies: 0, crmb: 0, vaut: false };
  }

  const ratio = cappedS <= 600 ? r0 : r0 - (r0 - r1) * ((cappedS - 600) / Math.max(1, maxSeconds - 600));

  const d = deriveStats(state, now);
  const offlineMult = prestigeEffects(state).offlineMult;

  // `crmbRate`, pas `miningRate`: ce dernier n'existe pas dans `deriveStats`.
  // La faute rendait le produit NaN, et comme `NaN <= 0` est faux la garde ne
  // protégeait pas — le solde CRMB devenait NaN à chaque retour, s'affichait
  // « ∞ », puis retombait à zéro au rechargement. Perte silencieuse de toute
  // la monnaie du joueur.
  const brut = {
    cookies: d.baseCps * cappedS * ratio * offlineMult,
    crmb: (d.crmbRate || 0) * cappedS * 0.5,
  };

  // Aucun montant non fini ne sort d'ici. Un état corrompu doit rendre zéro,
  // jamais un NaN qui contaminerait la banque.
  const cookies = Number.isFinite(brut.cookies) && brut.cookies > 0 ? brut.cookies : 0;
  const crmb = Number.isFinite(brut.crmb) && brut.crmb > 0 ? brut.crmb : 0;

  return {
    durationMs: duree,
    cappedS,
    ratio,
    cookies,
    crmb,
    vaut: cookies >= 1 || crmb > 0,
  };
}
