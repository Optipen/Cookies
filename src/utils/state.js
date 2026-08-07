import { defaultCryptoState, CRMB, addCrmb } from "./crypto.js";
import { clampBestCombo } from "./combo.js";
import { getUpgrade } from "../data/upgrades.js";
import { TRACK_BY_ID } from "../data/ascension.js";
import { ITEM_BY_ID } from "../data/items.js";

// === Feature flags ===
// Un flag à false doit désactiver la feature *entièrement* — apparition comprise.
export const FEATURES = {
  ENABLE_SOUNDS: true,
  ENABLE_PARTICLES: true,
  ENABLE_COOKIE_EAT: true,
  ENABLE_CRYPTO: true,
  ENABLE_PRESTIGE: true,
  ENABLE_SKINS: true,
  ENABLE_QUESTS: true,
  ENABLE_ACHIEVEMENTS: true,
  ENABLE_GOLDEN_COOKIES: true,
  ENABLE_EVENTS: true,
  ENABLE_RAIN: true,
  ENABLE_FLYING_COOKIE: true,
};

/**
 * Version du schéma de sauvegarde.
 *
 * Elle est passée à 7 avec les COMPTEURS À VIE (`lifetimeStats`), et à 8 avec
 * les deux cumuls que réclame le Classement — cookies produits et temps de jeu
 * à travers TOUTES les parties. La version est ÉCRITE dans la sauvegarde et
 * `migratedFrom` garde celle d'où l'on vient — sans quoi il est impossible de
 * dire, devant une partie cassée, quelle transformation l'a produite.
 */
export const STATE_VERSION = 8;

// === État neuf ===
// Fonction (et non constante) pour que chaque appel produise des objets frais:
// une constante partagée faisait fuiter des mutations entre parties.
export function createFreshState(now = Date.now()) {
  return {
    version: STATE_VERSION,
    cookies: 0,
    lifetime: 0,
    cpcBase: 1,
    items: {},
    upgrades: {},

    skin: "default",
    skinsOwned: { default: true, starter: false, early: false, caramel: false, noir: false, ice: false, fire: false },

    lastTs: now,
    createdAt: now,

    // Statistiques de la PARTIE EN COURS. Elles repartent à zéro à chaque
    // renaissance, et c'est voulu: les quêtes mesurent des écarts depuis leur
    // instanciation, le cookie croqué compte les clics de la partie, et
    // « 40 000 clics » n'a de sens que rapporté à une partie.
    stats: {
      clicks: 0,
      lastPurchaseTs: now,
      goldenClicks: 0,
      totalSpent: 0,
      bestCps: 0,
      playtimeMs: 0,
      prestigeCount: 0,
      handmade: 0,
      bestCombo: 1,
    },

    // === Compteurs à VIE ===
    //
    // Ils ne sont JAMAIS remis à zéro — ni par un prestige, ni par une
    // ascension, ni par une réinitialisation de partie. Seul « Tout effacer »
    // les emporte.
    //
    // Ils existent parce que cinq succès sur cinquante-cinq comptent un cumul
    // — cent mille clics, cent cinquante quêtes, deux cents dorés, sept jours
    // de série, vingt-cinq cookies croqués — alors que le jeu pousse à renaître
    // toutes les quatre-vingts minutes. Branchés sur `stats`, ces succès
    // demandaient de ne jamais renaître: exactement l'inverse de ce que le jeu
    // demande. Les compteurs de partie restent à côté, intacts, pour tout ce
    // qui décrit la partie en cours.
    lifetimeStats: {
      clicks: 0,
      goldenClicks: 0,
      cookiesEaten: 0,
      questsCompleted: 0,
      bestStreak: 0,

      // Les deux cumuls du Classement. Ils comptent ce que les parties
      // PRÉCÉDENTES ont produit et duré: la partie en cours s'y ajoute à la
      // lecture (`cookiesAVie`, `tempsDeJeuAVie`), et s'y verse au moment
      // exact où elle se termine — renaissance, ascension, réinitialisation.
      //
      // Pourquoi ce découpage plutôt qu'un compteur incrémenté partout: les
      // cookies arrivent d'une douzaine d'endroits (boucle, clic, quêtes,
      // succès, dorés, hors-ligne, primes du guide). Un compteur de plus à
      // tenir à jour dans chacun d'eux serait faux au premier oubli, et le
      // seul symptôme serait un classement légèrement injuste — donc invisible.
      cookiesAvant: 0,
      playtimeAvant: 0,
    },

    flags: {
      offlineCollected: false,
      flash: null,
      discountAll: null,
      cryptoFlashUntil: 0,
      goldenLastTs: 0,
      goldenStacks: 0,
      freeFirstAutoGiven: false,
      freeFirstAutoItemId: null,
    },

    buffs: { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" },

    prestige: { chips: 0, spent: 0, upgrades: {} },
    // L'Ascension se place au-dessus du prestige: elle survit à tout, sauf à
    // une remise à zéro complète demandée par le joueur.
    ascension: { stars: 0, spent: 0, tracks: {}, count: 0 },

    ui: {
      sounds: true,
      introSeen: false,
      highContrast: false,
      reducedMotion: false,
      volume: 0.6,
    },

    migratedFrom: STATE_VERSION,
    notice: null,
    unlocked: {},
    fx: { banner: null, shakeUntil: 0, tag: null },

    crypto: defaultCryptoState(now),

    quests: {
      active: [],
      daily: [],
      cooldowns: {},
      completed: {},
      dailyResetAt: 0,
      streak: 0,
      lastDailyClaim: 0,
    },

    cookieEatEnabled: true,
    cookieEatenCount: 0,
    cookieBites: [],

    // === Le Guide ===
    // `faites` retient les étapes franchies. Un latch est nécessaire parce que
    // deux étapes se mesurent sur le parc (« achète un Curseur », « monte à dix
    // bâtiments »), et qu'une renaissance remet le parc à zéro: sans lui, le
    // jeu réexpliquerait le clic à un joueur de quatre-vingts heures.
    // `masque` est le choix du joueur, et il est définitif tant qu'il ne le
    // reprend pas: un conseil qu'on a fermé ne revient pas tout seul.
    guide: { faites: {}, masque: false },

    // === Le Classement ===
    // `battus` retient le premier dépassement de chaque rival. Le classement
    // affiché, lui, reste VIVANT: un rival repassé devant redevient un rival.
    // Sans ce verrou, la prime d'un dépassement se paierait à chaque
    // oscillation autour de la même position.
    classement: { battus: {} },
  };
}

// === Clés de stockage ===
export const SAVE_KEY = "cookieCrazeSaveV8";
// Lues dans l'ordre, de la plus récente à la plus ancienne. Elles ne sont
// jamais effacées: une sauvegarde qu'on a su lire une fois doit rester lisible
// si le joueur revient sur une version antérieure.
export const LEGACY_KEYS = [
  "cookieCrazeSaveV7",
  "cookieCrazeSaveV6",
  "cookieCrazeSaveV5",
  "cookieCrazeSaveV4",
  "cookieCrazeSaveV3",
  "cookieCrazeSaveV2",
  "cookieCrazeSaveV1",
];
export const PENDING_RESET_KEY = "cookieCrazePendingReset";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Fusion profonde: la valeur sauvegardée gagne, la valeur par défaut comble les trous. */
function deepMerge(base, override) {
  if (!isObj(override)) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    const b = out[key];
    const o = override[key];
    out[key] = isObj(b) && isObj(o) ? deepMerge(b, o) : o;
  }
  return out;
}

const num = (v, fallback = 0) => (typeof v === "number" && isFinite(v) ? v : fallback);

// === Chargement ===
export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
  } catch {
    // localStorage indisponible (navigation privée, quota, iframe sandboxée)
    return createFreshState();
  }

  if (!raw) return createFreshState();

  try {
    return migrate(JSON.parse(raw));
  } catch {
    // Sauvegarde illisible: on l'archive avant de repartir à neuf
    try {
      localStorage.setItem(`${SAVE_KEY}_corrupted_${Date.now()}`, raw);
    } catch {
      // Stockage plein ou interdit: on repart à neuf sans archive
    }
    return createFreshState();
  }
}

// === Migration ===
export function migrate(savedState, now = Date.now()) {
  const fresh = createFreshState(now);
  if (!isObj(savedState)) return fresh;

  try {
    let merged = deepMerge(fresh, savedState);

    // --- Champs toujours reconstruits ---
    // D'où vient cette partie: indispensable pour diagnostiquer une sauvegarde
    // cassée sans avoir à deviner quelle transformation l'a produite.
    merged.migratedFrom = Number.isFinite(savedState.version) ? savedState.version : 0;
    merged.version = STATE_VERSION;
    merged.notice = null;
    merged.fx = { banner: null, shakeUntil: 0, tag: null };
    // Les quantités sont assainies une par une: une sauvegarde bricolée avec
    // `{ oven: -20 }` donnait un minage de -40 /s, et la part reversée tirait
    // la puissance de clic en négatif avec elle.
    merged.items = {};
    if (isObj(savedState.items)) {
      for (const id of Object.keys(savedState.items)) {
        const n = Math.floor(num(savedState.items[id]));
        if (n > 0 && ITEM_BY_ID[id]) merged.items[id] = n;
      }
    }
    // Les améliorations sont générées: on écarte les identifiants qui ne
    // correspondent plus à rien (anciens `cursor_10`, `share:2`, `cpc:1`…),
    // sinon ils gonfleraient les compteurs sans produire d'effet.
    merged.upgrades = {};
    if (isObj(savedState.upgrades)) {
      for (const id of Object.keys(savedState.upgrades)) {
        if (savedState.upgrades[id] && getUpgrade(id)) merged.upgrades[id] = true;
      }
    }
    merged.unlocked = isObj(savedState.unlocked) ? { ...savedState.unlocked } : {};
    merged.cookieBites = Array.isArray(savedState.cookieBites) ? savedState.cookieBites : [];

    // --- Valeurs numériques défensives ---
    merged.cookies = Math.max(0, num(merged.cookies));
    merged.lifetime = Math.max(merged.cookies, num(merged.lifetime));
    merged.cpcBase = Math.max(1, num(merged.cpcBase, 1));
    merged.cookieEatenCount = Math.max(0, num(merged.cookieEatenCount));
    merged.lastTs = num(merged.lastTs, now);
    merged.createdAt = num(merged.createdAt, now);

    // Le combo allait jusqu'à ×3; il s'arrête à ×1,75. Un record hérité de
    // l'ancienne échelle afficherait une valeur devenue inatteignable.
    merged.stats.bestCombo = clampBestCombo(savedState.stats?.bestCombo);

    // --- Compteurs à vie: arrivent en v7 ---
    //
    // Une sauvegarde d'avant n'en a aucun. Les mettre à zéro effacerait le
    // travail déjà fait: un joueur à quatre-vingt mille clics repartirait de
    // rien pour un succès qu'il touchait presque. On les SÈME donc avec ce que
    // la partie en cours a accumulé — c'est un plancher, jamais un plafond, et
    // on ne redescend jamais un compteur déjà écrit.
    const vieSauvee = isObj(savedState.lifetimeStats) ? savedState.lifetimeStats : {};
    const quetesFaites = isObj(savedState.quests?.completed)
      ? Object.values(savedState.quests.completed).reduce((a, b) => a + (num(b) > 0 ? Math.floor(num(b)) : 0), 0)
      : 0;
    const auMoins = (sauve, partie) => Math.max(0, Math.floor(num(sauve)), Math.floor(num(partie)));
    merged.lifetimeStats = {
      clicks: auMoins(vieSauvee.clicks, savedState.stats?.clicks),
      goldenClicks: auMoins(vieSauvee.goldenClicks, savedState.stats?.goldenClicks),
      cookiesEaten: auMoins(vieSauvee.cookiesEaten, savedState.cookieEatenCount),
      questsCompleted: auMoins(vieSauvee.questsCompleted, quetesFaites),
      bestStreak: auMoins(vieSauvee.bestStreak, savedState.quests?.streak),
      // Les cumuls du Classement arrivent en v8. Une sauvegarde d'avant n'a
      // aucune trace de ses parties passées: on part donc de zéro, et la
      // partie EN COURS s'y ajoutera à la lecture. Un vétéran est ainsi
      // classé sur la partie qu'il a sous les yeux plutôt que sur un cumul
      // qu'on aurait inventé — un plancher honnête, jamais un plafond.
      cookiesAvant: Math.max(0, num(vieSauvee.cookiesAvant)),
      playtimeAvant: Math.max(0, num(vieSauvee.playtimeAvant)),
    };

    // --- Prestige: l'arbre céleste arrive en v5 ---
    merged.prestige = {
      chips: Math.max(0, num(savedState.prestige?.chips)),
      spent: Math.max(0, num(savedState.prestige?.spent)),
      upgrades: isObj(savedState.prestige?.upgrades) ? { ...savedState.prestige.upgrades } : {},
    };
    // Un `spent` supérieur aux chips gagnés viendrait d'une sauvegarde trafiquée
    if (merged.prestige.spent > merged.prestige.chips) merged.prestige.spent = merged.prestige.chips;

    // --- Ascension: arrive après la v5, absente de toutes les sauvegardes
    //     existantes. Les valeurs par défaut la rendent simplement inactive.
    const oldAsc = isObj(savedState.ascension) ? savedState.ascension : {};
    const tracks = {};
    if (isObj(oldAsc.tracks)) {
      for (const id of Object.keys(oldAsc.tracks)) {
        // Un niveau négatif ou fractionnaire donnerait un rang de bâtiment
        // fantôme et un multiplicateur global hors grille.
        const n = Math.floor(num(oldAsc.tracks[id]));
        if (n > 0 && TRACK_BY_ID[id]) tracks[id] = Math.min(n, TRACK_BY_ID[id].maxLevel);
      }
    }
    merged.ascension = {
      stars: Math.max(0, Math.floor(num(oldAsc.stars))),
      spent: Math.max(0, Math.floor(num(oldAsc.spent))),
      tracks,
      count: Math.max(0, Math.floor(num(oldAsc.count))),
    };
    if (merged.ascension.spent > merged.ascension.stars) merged.ascension.spent = merged.ascension.stars;

    // --- Crypto: v4 n'avait que balance/staked/mintedUnits ---
    const oldCrypto = isObj(savedState.crypto) ? savedState.crypto : {};
    merged.crypto = {
      ...defaultCryptoState(now),
      ...oldCrypto,
      name: CRMB.name,
      symbol: CRMB.symbol,
      balance: addCrmb(num(oldCrypto.balance), 0),
      // Contrats du Registre: un entier positif, quoi qu'il y ait eu dans la
      // sauvegarde. Un compteur bricolé donnerait un multiplicateur global
      // négatif, donc une production négative sur les deux axes à la fois.
      ledger: Math.max(0, Math.floor(num(oldCrypto.ledger))),
      // `mintedUnits`, `perCookies` et `perAmount` pilotaient le faucet, qui
      // n'existe plus: les garder ferait croire à une source de CRMB disparue.
      mintedUnits: undefined,
      perCookies: undefined,
      perAmount: undefined,
      totalEarned: addCrmb(num(oldCrypto.totalEarned), 0),
      // Le cours est un entier de cookies, et les fractions en attente de
      // versement repartent saines: une valeur négative ou infinie gonflerait
      // le premier versement suivant.
      price: Math.round(num(oldCrypto.price, CRMB.basePrice)),
      pending: Math.max(0, num(oldCrypto.pending)),
      priceHistory: Array.isArray(oldCrypto.priceHistory) && oldCrypto.priceHistory.length
        ? oldCrypto.priceHistory.filter((p) => isFinite(p)).slice(-CRMB.historyLength)
        : [num(oldCrypto.price, CRMB.basePrice)],
      miners: isObj(oldCrypto.miners) ? { ...oldCrypto.miners } : {},
      positions: Array.isArray(oldCrypto.positions) ? oldCrypto.positions.filter(isObj) : [],
      lastMarketTs: num(oldCrypto.lastMarketTs, now),
      lastYieldTs: num(oldCrypto.lastYieldTs, now),
    };
    // Le staking « à plat » de la v4 devient une position flexible
    const legacyStaked = num(oldCrypto.staked);
    if (legacyStaked > 0 && !merged.crypto.positions.length) {
      merged.crypto.positions = [
        { id: "legacy", amount: legacyStaked, tierId: "flex", startedAt: now, unlockAt: 0 },
      ];
    }
    delete merged.crypto.staked;

    // --- Quêtes: remplacent missions/micro-missions de la v4 ---
    const oldQuests = isObj(savedState.quests) ? savedState.quests : {};
    merged.quests = {
      active: Array.isArray(oldQuests.active) ? oldQuests.active.filter(isObj) : [],
      daily: Array.isArray(oldQuests.daily) ? oldQuests.daily.filter(isObj) : [],
      cooldowns: isObj(oldQuests.cooldowns) ? { ...oldQuests.cooldowns } : {},
      completed: isObj(oldQuests.completed) ? { ...oldQuests.completed } : {},
      dailyResetAt: num(oldQuests.dailyResetAt),
      streak: Math.max(0, num(oldQuests.streak)),
      lastDailyClaim: num(oldQuests.lastDailyClaim),
    };
    // Champs morts des anciennes versions
    delete merged.mission;
    delete merged.activeMission;
    delete merged.activeMicroMission;
    delete merged.missionsState;
    delete merged.microMissions;
    delete merged.combo;
    delete merged.settings;

    // --- Guide: arrive après la v7 ---
    //
    // Aucune sauvegarde antérieure ne le contient. Ce n'est pas un problème:
    // les étapes se mesurent sur l'état réel — un joueur qui possède déjà
    // trente bâtiments les a toutes franchies sans qu'on ait rien à écrire.
    // On assainit seulement ce qui pourrait venir d'une sauvegarde bricolée.
    const oldGuide = isObj(savedState.guide) ? savedState.guide : {};
    merged.guide = {
      faites: isObj(oldGuide.faites) ? { ...oldGuide.faites } : {},
      masque: !!oldGuide.masque,
    };

    // --- Classement: arrive en v8 ---
    // Rien à semer: les rivaux se comparent à l'état réel. Un joueur qui en
    // dépasse déjà cinq les verra derrière lui au premier affichage — sans
    // encaisser cinq primes pour un dépassement qu'on n'a pas vu (le verrou
    // du montage, côté `useClassement`, s'en charge).
    const oldClassement = isObj(savedState.classement) ? savedState.classement : {};
    merged.classement = { battus: isObj(oldClassement.battus) ? { ...oldClassement.battus } : {} };

    // --- Flags volatils: on ne rejoue pas un état d'événement périmé ---
    merged.flags = {
      ...fresh.flags,
      ...(isObj(savedState.flags) ? savedState.flags : {}),
      flash: null,
      discountAll: null,
      cryptoFlashUntil: 0,
      offlineCollected: false,
    };
    merged.buffs = { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" };

    return merged;
  } catch {
    return fresh;
  }
}

// === Sauvegarde ===
export function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Quota dépassé ou stockage interdit: le jeu continue en mémoire
    return false;
  }
}

/**
 * Le stockage accepte-t-il vraiment une écriture ?
 *
 * `localStorage` peut EXISTER et refuser d'écrire — navigation privée sur
 * certains navigateurs, iframe sandboxée, quota déjà plein, réglage de
 * confidentialité. On ne se fie donc pas à sa présence: on écrit une sonde,
 * on la relit, on l'efface.
 *
 * Cette vérification existe parce que le jeu tournait parfaitement dans ces
 * conditions sans jamais le dire: le joueur jouait une heure, rechargeait, et
 * trouvait une partie vide sans avoir vu le moindre avertissement.
 */
export function storageDisponible() {
  const sonde = `${SAVE_KEY}__sonde`;
  try {
    localStorage.setItem(sonde, "1");
    const lu = localStorage.getItem(sonde);
    localStorage.removeItem(sonde);
    return lu === "1";
  } catch {
    return false;
  }
}

// === Feature flags ===
export const isFeatureEnabled = (name) => FEATURES[name] ?? false;

// === Reset ===
/**
 * Nouvelle partie, et le CONTRAT de ce qui lui survit.
 *
 * Une seule règle: **rien ne survit qu'on ne lui ait explicitement confié**.
 * Chaque couche est un paramètre nommé, `null` par défaut, et l'appelant dit
 * ce qu'il garde. C'est verbeux exprès: la version précédente laissait le
 * report des couches à un `{ ...fresh, … }` écrit après coup chez l'appelant,
 * et deux couches y ont été oubliées sans que rien ne le signale —
 * l'Ascension entière disparaissait à la réinitialisation de partie, et les
 * apparences (dont deux payées 35 CRMB) à chaque renaissance.
 *
 * Ce qu'un appelant ne passe pas repart donc à neuf, visiblement, à la
 * lecture du site d'appel.
 *
 * Chaque appel repart d'un état frais: aucune mutation partagée possible.
 */
export function createResetState({
  preservePrestige = true,
  prestige = null,
  ascension = null,
  // Portefeuille CRMB, Registre et matériel d'extraction: la couche monétaire.
  crypto = null,
  // Apparences possédées et apparence équipée. Deux d'entre elles s'achètent
  // en CRMB — une monnaie qui survit aux renaissances: l'objet acheté avec
  // doit y survivre aussi.
  skin = null,
  skinsOwned = null,
  // Succès déjà décrochés.
  unlocked = null,
  // Compteurs à vie: ils ne se remettent à zéro que sur « Tout effacer ».
  lifetimeStats = null,
  // Étapes du Guide déjà franchies. Elles décrivent ce que le JOUEUR sait
  // faire, pas ce que sa partie possède: réexpliquer le clic après une
  // renaissance serait absurde.
  guide = null,
  // Rivaux déjà dépassés. Comme le Guide: c'est une trace du parcours du
  // JOUEUR, pas de ce que sa partie possède.
  classement = null,
  sounds = true,
  // Un joueur qui relance une partie a déjà vu l'écran d'accueil: le lui
  // réimposer n'apporte rien. Seule une toute première partie l'affiche.
  introSeen = true,
  now = Date.now(),
} = {}) {
  const s = createFreshState(now);
  if (preservePrestige && prestige) {
    s.prestige = {
      chips: Math.max(0, num(prestige.chips)),
      spent: Math.max(0, num(prestige.spent)),
      upgrades: isObj(prestige.upgrades) ? { ...prestige.upgrades } : {},
    };
  }
  // L'Ascension survit au prestige: c'est la couche du dessus.
  if (ascension) {
    s.ascension = {
      stars: Math.max(0, Math.floor(num(ascension.stars))),
      spent: Math.max(0, Math.floor(num(ascension.spent))),
      tracks: isObj(ascension.tracks) ? { ...ascension.tracks } : {},
      count: Math.max(0, Math.floor(num(ascension.count))),
    };
  }
  if (isObj(crypto)) {
    // Les horodatages du marché et du rendement repartent de maintenant: repris
    // tels quels, une partie reprise après plusieurs heures verserait d'un coup
    // tout le rendement de l'absence, en plus du rapport hors-ligne.
    s.crypto = { ...crypto, lastMarketTs: now, lastYieldTs: now };
  }
  if (isObj(skinsOwned)) {
    // On repart du jeu neuf pour que l'apparence par défaut soit toujours là,
    // même si une sauvegarde bricolée prétend le contraire.
    s.skinsOwned = { ...s.skinsOwned, ...skinsOwned, default: true };
  }
  if (typeof skin === "string" && s.skinsOwned[skin]) s.skin = skin;
  if (isObj(unlocked)) s.unlocked = { ...unlocked };
  if (isObj(lifetimeStats)) {
    const n = (v) => Math.max(0, Math.floor(num(v)));
    s.lifetimeStats = {
      clicks: n(lifetimeStats.clicks),
      goldenClicks: n(lifetimeStats.goldenClicks),
      cookiesEaten: n(lifetimeStats.cookiesEaten),
      questsCompleted: n(lifetimeStats.questsCompleted),
      bestStreak: n(lifetimeStats.bestStreak),
      cookiesAvant: Math.max(0, num(lifetimeStats.cookiesAvant)),
      playtimeAvant: Math.max(0, num(lifetimeStats.playtimeAvant)),
    };
  }
  if (isObj(guide)) {
    s.guide = {
      faites: isObj(guide.faites) ? { ...guide.faites } : {},
      masque: !!guide.masque,
    };
  }
  if (isObj(classement)) {
    s.classement = { battus: isObj(classement.battus) ? { ...classement.battus } : {} };
  }
  s.ui.sounds = !!sounds;
  s.ui.introSeen = !!introSeen;
  return s;
}

/**
 * Cookies produits depuis la toute première partie, renaissances comprises.
 *
 * `lifetime` est remis à zéro par chaque renaissance: c'est la production de
 * la partie EN COURS, et elle a sa raison d'être — le prestige se calcule
 * dessus. Le Classement, lui, mesure un parcours entier: il additionne donc ce
 * que les parties précédentes ont produit et ce que celle-ci produit.
 */
export const cookiesAVie = (state) =>
  Math.max(0, num(state?.lifetimeStats?.cookiesAvant)) + Math.max(0, num(state?.lifetime));

/**
 * Temps de jeu depuis la toute première partie.
 *
 * C'est l'unité de mesure du Classement, et c'est un choix: les rivaux
 * avancent au TEMPS DE JEU du joueur, pas à l'horloge murale. Quelqu'un qui
 * joue vingt minutes par jour se compare donc à des adversaires qui ont joué
 * vingt minutes eux aussi. Sur une horloge murale, tout le monde perdrait en
 * dormant — exactement le contraire de ce qu'un classement doit provoquer.
 */
export const tempsDeJeuAVie = (state) =>
  Math.max(0, num(state?.lifetimeStats?.playtimeAvant)) + Math.max(0, num(state?.stats?.playtimeMs));

/**
 * Les compteurs à vie, la partie qui s'achève REPLIÉE dedans.
 *
 * C'est ici, et nulle part ailleurs, qu'une partie se verse dans les cumuls:
 * les trois gestes qui terminent une partie passent tous par
 * `couchesConservees`, donc aucun ne peut oublier de le faire.
 */
export const cumulerVie = (state) => ({
  ...(isObj(state?.lifetimeStats) ? state.lifetimeStats : {}),
  cookiesAvant: cookiesAVie(state),
  playtimeAvant: tempsDeJeuAVie(state),
});

/**
 * Tout ce qu'une renaissance ou une réinitialisation de partie conserve, sauf
 * les chips et les étoiles — que chaque appelant traite à sa façon.
 *
 * Un seul endroit décrit ces couches: les trois gestes du jeu (renaissance,
 * ascension, réinitialisation) ne peuvent plus diverger sans qu'on le voie.
 */
export const couchesConservees = (state) => ({
  crypto: state?.crypto || null,
  skin: state?.skin || null,
  skinsOwned: state?.skinsOwned || null,
  unlocked: state?.unlocked || null,
  lifetimeStats: cumulerVie(state),
  guide: state?.guide || null,
  classement: state?.classement || null,
});

// === Validation ===
export function validateState(state) {
  if (!isObj(state)) return false;
  for (const field of ["cookies", "items", "stats", "ui"]) {
    if (!(field in state)) return false;
  }
  if (typeof state.cookies !== "number" || !isFinite(state.cookies)) return false;
  if (!isObj(state.items)) return false;
  return true;
}

// === Import / export ===
export function exportSave(state) {
  return JSON.stringify({ game: "crumbora", version: STATE_VERSION, exportedAt: Date.now(), state });
}

/** Accepte le format v5, un état nu, ou l'ancien base64 de la v3.
 *  Les fichiers exportés avant le renommage portent l'ancienne étiquette
 *  (deuxième littéral ci-dessous): ils restent importables pour toujours —
 *  on n'orpheline pas une sauvegarde pour une histoire de marque. */
export function importSave(text) {
  const attempt = (raw) => {
    const parsed = JSON.parse(raw);
    const exporte = parsed && (parsed.game === "crumbora" || parsed.game === "cookie-craze");
    const candidate = exporte ? parsed.state : parsed;
    if (!validateState(candidate)) throw new Error("état invalide");
    return migrate(candidate);
  };
  try {
    return attempt(String(text));
  } catch {
    try {
      return attempt(decodeURIComponent(escape(atob(String(text)))));
    } catch {
      return null;
    }
  }
}
