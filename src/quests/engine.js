// === Moteur de quêtes ===
// Entièrement pur: `tickQuests` prend un état et rend un nouvel état plus la
// liste des événements survenus. Aucun setState imbriqué, donc pas de boucle
// de rendu possible — c'est ce qui rendait l'ancien moteur instable.

import { QUESTS, QUEST_BY_ID, questTitle, questDesc } from "./catalog.js";
import { ITEMS } from "../data/items.js";
import { cpsFrom, clickMultiplierFrom } from "../utils/calc.js";
import { stakedTotal, stakingBoost } from "../utils/crypto.js";
import { prestigeEffects } from "../data/prestige.js";

export const ACTIVE_SLOTS = 3;
export const DAILY_SLOTS = 3;
export const DAILY_PERIOD_MS = 24 * 3600 * 1000;

// --- Contexte joueur -------------------------------------------------------

export function buildContext(state) {
  const bank = state.cookies || 0;
  const lifetime = state.lifetime || 0;
  const chips = state.prestige?.chips || 0;
  const positions = state.crypto?.positions || [];
  const stakeMulti = stakingBoost(positions);
  const cps = cpsFrom(state.items || {}, state.upgrades || {}, chips, stakeMulti);
  const cpcMult = clickMultiplierFrom(state.items || {}, state.upgrades || {});

  let level = "early";
  if (lifetime >= 1_000_000 && cps >= 500) level = "late";
  else if (lifetime >= 10_000 || cps >= 10) level = "mid";

  // Premier bâtiment achetable avec ~70 % de la banque
  let nextAffordable = null;
  let bestCost = Infinity;
  for (const it of ITEMS) {
    const owned = state.items[it.id] || 0;
    const cost = it.base * Math.pow(it.growth, owned);
    if (cost <= Math.max(1, bank * 0.7) && cost < bestCost) {
      bestCost = cost;
      nextAffordable = { id: it.id, estimatedCost: cost };
    }
  }

  return {
    level,
    bank,
    lifetime,
    cps,
    cpcMult,
    nextAffordable,
    crmbPrice: state.crypto?.price || 20_000,
    crmbBalance: state.crypto?.balance || 0,
    crmbStaked: stakedTotal(positions),
    questMult: prestigeEffects(state).questMult,
  };
}

// --- Sélection -------------------------------------------------------------

const isDaily = (q) => q.tier === "daily";

function eligibleQuests(state, ctx, { daily, taken, cooldowns, now }) {
  return QUESTS.filter((q) => {
    if (isDaily(q) !== daily) return false;
    if (taken.has(q.id)) return false;
    if ((cooldowns[q.id] || 0) > now) return false;
    try {
      return q.eligible ? !!q.eligible(ctx, state) : true;
    } catch {
      return false;
    }
  });
}

/** Tirage pondéré déterministe si `rng` est injecté (tests). */
function pickWeighted(candidates, ctx, rng) {
  if (!candidates.length) return null;
  const weights = candidates.map((q) => {
    try {
      return Math.max(0.01, q.weight ? q.weight(ctx) : 1);
    } catch {
      return 1;
    }
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Instancie une quête: fige l'objectif et l'état de départ. */
export function instantiate(quest, state, ctx, now = Date.now()) {
  let meta;
  try {
    meta = quest.target ? quest.target(state, ctx) || {} : {};
  } catch {
    // Objectif impossible à instancier: la quête n'est pas proposée
    return null;
  }
  // Progression initiale calculée tout de suite: sinon la carte affiche
  // « 0 / 0 » jusqu'au tick suivant, et l'objectif apparaît avec un temps de retard.
  let progress = 0;
  let target = 0;
  try {
    const res = quest.progress(state, meta, ctx) || {};
    progress = Number(res.progress) || 0;
    target = Number(res.target) || 0;
  } catch {
    // Une quête qui échoue à s'auto-évaluer démarre simplement à zéro
  }

  return {
    questId: quest.id,
    meta,
    startedAt: now,
    expiresAt: quest.timeLimitS ? now + quest.timeLimitS * 1000 : 0,
    progress,
    target,
  };
}

/** Remplit les emplacements vides. Retourne un nouveau tableau (ou l'ancien si rien à faire). */
export function refill(list, slots, state, ctx, cooldowns, daily, now, rng = Math.random) {
  if (list.length >= slots) return list;
  const taken = new Set(list.map((a) => a.questId));
  const next = [...list];
  let guard = 0;
  while (next.length < slots && guard++ < 20) {
    const candidates = eligibleQuests(state, ctx, { daily, taken, cooldowns, now });
    const pick = pickWeighted(candidates, ctx, rng);
    if (!pick) break;
    const inst = instantiate(pick, state, ctx, now);
    if (!inst) {
      taken.add(pick.id);
      continue;
    }
    taken.add(pick.id);
    next.push(inst);
  }
  return next.length === list.length ? list : next;
}

// --- Évaluation ------------------------------------------------------------

export function evaluate(active, state, ctx, now = Date.now()) {
  const quest = QUEST_BY_ID[active.questId];
  if (!quest) return { progress: 0, target: 1, done: false, failed: true, expired: true };

  let res = {};
  try {
    res = quest.progress(state, active.meta || {}, ctx) || {};
  } catch {
    // Progression illisible: la quête reste à zéro plutôt que de casser le tick
  }

  const timedOut = !!active.expiresAt && now >= active.expiresAt;
  const done = !!res.done && !res.failed;

  return {
    progress: Number(res.progress) || 0,
    target: Number(res.target) || 1,
    // Une quête chronométrée non terminée à l'expiration est un échec,
    // pas une réussite: l'ancien moteur récompensait les deux.
    done,
    failed: !!res.failed || (timedOut && !done),
    expired: timedOut,
  };
}

// --- Récompenses -----------------------------------------------------------

export function resolveReward(quest, state, ctx, meta) {
  try {
    const r = quest.reward ? quest.reward(state, ctx, meta) : null;
    if (!r) return null;
    // Bonus permanent de l'arbre céleste sur les gains de quête
    const mult = ctx?.questMult || 1;
    return {
      cookies: Math.max(0, Math.floor((r.cookies || 0) * mult)),
      crmb: Math.max(0, (r.crmb || 0) * mult),
      buff: r.buff || null,
      discount: r.discount || null,
      chips: Math.max(0, Math.floor(r.chips || 0)),
    };
  } catch {
    return null;
  }
}

/** Applique une récompense à un état. Pure: rend un nouvel état. */
export function applyReward(state, reward, now = Date.now()) {
  if (!reward) return state;
  const next = { ...state };

  if (reward.cookies > 0) {
    next.cookies = (state.cookies || 0) + reward.cookies;
    next.lifetime = (state.lifetime || 0) + reward.cookies;
  }

  if (reward.crmb > 0) {
    next.crypto = {
      ...state.crypto,
      balance: Math.round(((state.crypto?.balance || 0) + reward.crmb + Number.EPSILON) * 1e6) / 1e6,
    };
  }

  if (reward.buff) {
    const b = reward.buff;
    const until = now + (b.seconds || 20) * 1000;
    const buffs = { ...(state.buffs || { cpsMulti: 1, cpcMulti: 1, until: 0, label: "" }) };
    // Un buff expiré repart de 1 au lieu de se cumuler sur une valeur morte
    const stillActive = (buffs.until || 0) > now;
    const baseCps = stillActive ? buffs.cpsMulti || 1 : 1;
    const baseCpc = stillActive ? buffs.cpcMulti || 1 : 1;
    if (b.kind === "cps") {
      buffs.cpsMulti = Math.min(50, baseCps * (b.value || 1));
      buffs.cpcMulti = baseCpc;
    } else {
      buffs.cpcMulti = Math.min(50, baseCpc * (b.value || 1));
      buffs.cpsMulti = baseCps;
    }
    // Durée cumulée plafonnée à 5 min
    buffs.until = Math.min(now + 300_000, Math.max(stillActive ? buffs.until : 0, until));
    buffs.label = b.label || "BOOST";
    next.buffs = buffs;
  }

  if (reward.discount) {
    next.flags = {
      ...state.flags,
      discountAll: {
        value: reward.discount.value,
        until: now + (reward.discount.seconds || 30) * 1000,
      },
    };
  }

  if (reward.chips > 0) {
    next.prestige = { ...state.prestige, chips: (state.prestige?.chips || 0) + reward.chips };
  }

  return next;
}

// --- Tick principal --------------------------------------------------------

/**
 * Avance l'ensemble du système de quêtes d'un pas.
 * @returns {{ state, events: Array<{type,questId,title,reward}> , changed: boolean }}
 */
export function tickQuests(state, ctx, now = Date.now(), rng = Math.random) {
  const questsState = state.quests || { active: [], daily: [], cooldowns: {}, completed: {}, dailyResetAt: 0, streak: 0, lastDailyClaim: 0 };
  const events = [];
  let next = state;
  let active = questsState.active || [];
  let daily = questsState.daily || [];
  let cooldowns = { ...(questsState.cooldowns || {}) };
  let completed = { ...(questsState.completed || {}) };
  let changed = false;

  // Réinitialisation quotidienne
  let dailyResetAt = questsState.dailyResetAt || 0;
  let streak = questsState.streak || 0;
  if (now >= dailyResetAt) {
    // Série conservée si le joueur a validé une quotidienne dans la période écoulée
    if (dailyResetAt > 0) {
      const claimedInPeriod = (questsState.lastDailyClaim || 0) > dailyResetAt - DAILY_PERIOD_MS;
      streak = claimedInPeriod ? streak : 0;
    }
    dailyResetAt = now + DAILY_PERIOD_MS;
    daily = [];
    changed = true;
  }

  const processList = (list, isDailyList) => {
    const kept = [];
    for (const entry of list) {
      const quest = QUEST_BY_ID[entry.questId];
      if (!quest) {
        changed = true;
        continue;
      }
      const res = evaluate(entry, next, ctx, now);

      if (res.done) {
        const reward = resolveReward(quest, next, ctx, entry.meta);
        next = applyReward(next, reward, now);
        cooldowns[quest.id] = now + (quest.cooldownS || 120) * 1000;
        completed[quest.id] = (completed[quest.id] || 0) + 1;
        events.push({
          type: "completed",
          questId: quest.id,
          title: questTitle(quest, entry.meta),
          icon: quest.icon,
          reward,
          daily: isDailyList,
        });
        changed = true;
        continue;
      }

      if (res.failed) {
        // Échec: cooldown réduit, on ne punit pas trop
        cooldowns[quest.id] = now + Math.round((quest.cooldownS || 120) * 0.5) * 1000;
        events.push({
          type: "failed",
          questId: quest.id,
          title: questTitle(quest, entry.meta),
          icon: quest.icon,
          daily: isDailyList,
        });
        changed = true;
        continue;
      }

      // Progression: on ne recrée l'objet que si les chiffres bougent
      if (res.progress !== entry.progress || res.target !== entry.target) {
        kept.push({ ...entry, progress: res.progress, target: res.target });
        changed = true;
      } else {
        kept.push(entry);
      }
    }
    return kept;
  };

  active = processList(active, false);
  daily = processList(daily, true);

  // Série quotidienne
  let lastDailyClaim = questsState.lastDailyClaim || 0;
  if (events.some((e) => e.type === "completed" && e.daily)) {
    if (lastDailyClaim <= dailyResetAt - DAILY_PERIOD_MS) streak += 1;
    lastDailyClaim = now;
  }

  // Réapprovisionnement
  const refilledActive = refill(active, ACTIVE_SLOTS, next, ctx, cooldowns, false, now, rng);
  const refilledDaily = refill(daily, DAILY_SLOTS, next, ctx, cooldowns, true, now, rng);
  if (refilledActive !== active || refilledDaily !== daily) changed = true;

  if (!changed) return { state, events, changed: false };

  return {
    state: {
      ...next,
      quests: {
        ...questsState,
        active: refilledActive,
        daily: refilledDaily,
        cooldowns,
        completed,
        dailyResetAt,
        streak,
        lastDailyClaim,
      },
    },
    events,
    changed: true,
  };
}

/** Remplace une quête active (bouton « Passer »). */
export function rerollQuest(state, questId, ctx, now = Date.now(), rng = Math.random) {
  const questsState = state.quests || {};
  const quest = QUEST_BY_ID[questId];
  const cooldowns = { ...(questsState.cooldowns || {}) };
  if (quest) cooldowns[questId] = now + (quest.cooldownS || 120) * 1000;

  const active = (questsState.active || []).filter((a) => a.questId !== questId);
  const daily = (questsState.daily || []).filter((a) => a.questId !== questId);
  const wasDaily = (questsState.daily || []).some((a) => a.questId === questId);

  return {
    ...state,
    quests: {
      ...questsState,
      cooldowns,
      active: wasDaily ? questsState.active : refill(active, ACTIVE_SLOTS, state, ctx, cooldowns, false, now, rng),
      daily: wasDaily ? refill(daily, DAILY_SLOTS, state, ctx, cooldowns, true, now, rng) : questsState.daily,
    },
  };
}

export { questTitle, questDesc };
