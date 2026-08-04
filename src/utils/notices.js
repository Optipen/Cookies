// === File d'attente des notifications ===
//
// Une seule notification à l'écran, en haut, et rarement.
//
// Ce fichier est une machine d'état pure: on lui pousse des messages, on lui
// demande l'heure, elle répond ce qu'il faut afficher. Aucun accès au DOM ni à
// l'horloge — c'est ce qui permet de MESURER combien de notifications une vraie
// session produit, au lieu de l'estimer.
//
// Quatre règles, et chacune répare un défaut constaté:
//
//  1. **Une vraie file.** L'ancienne version écartait ce qui arrivait pendant
//     le silence: un joueur qui décrochait trois succès d'affilée n'en voyait
//     qu'un, et les deux autres n'existaient plus. Ils attendent maintenant
//     leur tour.
//  2. **Une file BORNÉE.** Une file sans limite ne supprime pas l'avalanche,
//     elle la reporte — et le joueur reçoit vingt minutes plus tard une nouvelle
//     sans rapport avec ce qu'il fait. Au-delà de la capacité, le plus ancien
//     ordinaire saute; et ce qui a trop attendu est jeté plutôt qu'affiché hors
//     sujet.
//  3. **Déduplication et regroupement.** Le même message deux fois de suite ne
//     s'affiche qu'une fois. Dix succès simultanés font une ligne, pas dix.
//  4. **Même les événements majeurs sont bornés.** Un prestige mérite de passer
//     devant, mais un bug qui en déclencherait soixante par minute ne doit pas
//     pouvoir saturer l'écran.

/** Délai minimal entre deux notifications ordinaires. */
export const QUIET_MS = 11_000;

/** Écart minimal entre deux événements majeurs. */
export const MAJOR_MIN_GAP_MS = 2_500;

/** Plafond dur d'événements majeurs par minute glissante. */
export const MAJOR_PER_MINUTE = 6;

/** Un même message ne se répète pas avant ce délai. */
export const DEDUPE_MS = 30_000;

/** Capacité de la file. Au-delà, le plus ancien ordinaire est abandonné. */
export const MAX_QUEUE = 6;

/** Au-delà de cette attente, un message n'a plus de rapport avec le jeu en cours. */
export const STALE_MS = 90_000;

/**
 * Fenêtre de regroupement.
 *
 * Un message qui appartient à une famille attend une seconde avant de sortir,
 * le temps que ses frères arrivent. Sans elle, dix succès décrochés dans la
 * même demi-seconde produisaient deux notifications: la première partait avant
 * que les neuf autres n'existent. Elle ne s'applique QU'aux messages groupés —
 * une renaissance ne doit pas attendre.
 */
export const GROUP_WINDOW_MS = 1_000;

export const LEVELS = {
  // Petite information: n'apparaît que si le calme est revenu.
  banner: { ms: 2600, priority: 1 },
  // Déblocage, gros palier: passe devant un bandeau ordinaire.
  event: { ms: 3400, priority: 2 },
  // Prestige, ascension, cookie doré: passe devant tout, animation ample.
  major: { ms: 4200, priority: 3 },
};

const niveau = (level) => (LEVELS[level] ? level : "banner");
const texteValide = (msg) => typeof msg === "string" && msg.trim().length > 0;

/**
 * Crée une file. Chaque partie a la sienne.
 *
 * @param {object} opts surcharges, pour les tests et la mesure
 */
export function createNoticeQueue({
  quietMs = QUIET_MS,
  majorGapMs = MAJOR_MIN_GAP_MS,
  majorPerMinute = MAJOR_PER_MINUTE,
  dedupeMs = DEDUPE_MS,
  maxQueue = MAX_QUEUE,
  staleMs = STALE_MS,
  groupWindowMs = GROUP_WINDOW_MS,
} = {}) {
  let file = [];
  let dernierOrdinaire = -Infinity;
  let dernierMajeur = -Infinity;
  let majeursRecents = []; // horodatages, pour la minute glissante
  let vus = new Map(); // message → dernier affichage, pour la déduplication
  let compteur = 0;

  /** L'horloge du système peut reculer (changement d'heure, veille). */
  const recale = (now) => {
    if (now < dernierOrdinaire) dernierOrdinaire = -Infinity;
    if (now < dernierMajeur) dernierMajeur = -Infinity;
    majeursRecents = majeursRecents.filter((t) => t <= now);
  };

  return {
    /**
     * Met un message en file.
     *
     * @param {string} level  banner · event · major
     * @param {string} msg    texte affiché
     * @param {object} opts   { tone, group, now, ms }
     */
    push(level, msg, opts = {}) {
      const now = Number.isFinite(opts.now) ? opts.now : Date.now();
      recale(now);
      if (!texteValide(msg)) return false;

      const lvl = niveau(level);
      const cfg = LEVELS[lvl];

      // Déduplication: le même texte ne revient pas avant `dedupeMs`.
      const dernierVu = vus.get(msg);
      if (dernierVu !== undefined && now - dernierVu < dedupeMs) return false;
      if (file.some((e) => e.msg === msg)) return false;

      // Regroupement: un message d'une famille déjà en file la remplace et
      // incrémente son compteur. Dix succès simultanés font une ligne.
      if (opts.group) {
        const existant = file.find((e) => e.group === opts.group);
        if (existant) {
          existant.msg = msg;
          existant.count += 1;
          existant.tone = opts.tone || existant.tone;
          // La priorité la plus haute du groupe l'emporte.
          if (cfg.priority > LEVELS[existant.level].priority) existant.level = lvl;
          return true;
        }
      }

      file.push({
        id: `n${(compteur++).toString(36)}`,
        level: lvl,
        msg,
        tone: opts.tone || "info",
        group: opts.group || null,
        ms: opts.ms || cfg.ms,
        at: now,
        count: 1,
      });

      // Capacité: on sacrifie le plus ancien ORDINAIRE, jamais un majeur.
      if (file.length > maxQueue) {
        const i = file.findIndex((e) => e.level !== "major");
        file.splice(i >= 0 ? i : 0, 1);
      }
      return true;
    },

    /**
     * Fait avancer l'horloge et rend la notification à afficher, ou `null`.
     * Appelée à chaque tic de l'interface.
     */
    tick(now = Date.now()) {
      recale(now);

      // Ce qui a trop attendu est jeté: l'afficher maintenant parlerait d'une
      // partie que le joueur ne joue plus.
      file = file.filter((e) => now - e.at <= staleMs);
      if (!file.length) return null;

      // Priorité d'abord, ancienneté ensuite.
      file.sort((a, b) => LEVELS[b.level].priority - LEVELS[a.level].priority || a.at - b.at);
      // Un message groupé laisse une seconde à ses frères pour le rejoindre.
      const pret = file.filter((e) => !e.group || now - e.at >= groupWindowMs);
      if (!pret.length) return null;
      const suivant = pret[0];

      if (suivant.level === "major") {
        majeursRecents = majeursRecents.filter((t) => now - t < 60_000);
        if (now - dernierMajeur < majorGapMs) return null;
        if (majeursRecents.length >= majorPerMinute) return null;
        dernierMajeur = now;
        majeursRecents.push(now);
      } else if (now - dernierOrdinaire < quietMs) {
        return null;
      }

      // Un majeur remet aussi le silence ordinaire à zéro: on ne fait pas
      // suivre une renaissance d'un bandeau dans la seconde.
      dernierOrdinaire = now;
      file.splice(file.indexOf(suivant), 1);
      vus.set(suivant.msg, now);
      // La table de déduplication ne doit pas grandir indéfiniment.
      if (vus.size > 200) {
        for (const [k, t] of vus) if (now - t > dedupeMs) vus.delete(k);
      }
      return { ...suivant };
    },

    taille: () => file.length,

    reset() {
      file = [];
      dernierOrdinaire = -Infinity;
      dernierMajeur = -Infinity;
      majeursRecents = [];
      vus = new Map();
    },
  };
}
