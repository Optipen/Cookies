import { MICRO_TEMPLATES, MAIN_TEMPLATES } from "./templates.js";

// Moteur de sélection simple pour micro‑missions
// Entrées: state, ctx, options { excludeId, cooldowns, history, forbiddenTags }
// Sortie: { templateId, meta, tags }

export function selectMicroMission(state, ctx, options = {}) {
  const excludeId = options.excludeId;
  const forbiddenTags = options.forbiddenTags || [];
  const cooldowns = options.cooldowns || {};
  const now = Date.now();

  const eligible = MICRO_TEMPLATES.filter(t => {
    if (t.id === excludeId) return false;
    const conflict = (t.tags || []).some(tag => forbiddenTags.includes(tag));
    if (conflict) return false;
    if (cooldowns[t.id] && cooldowns[t.id] > now) return false;
    try { return !!t.eligible(state, ctx); } catch { return false; }
  });

  const scored = eligible.map(t => {
    let base = 0;
    try { base = Number(t.score(state, ctx)) || 0; } catch { base = 0; }
    // Bonus de variété: évite répétitions récentes (si history fourni)
    const recent = (options.history || []).slice(-5).some(h => h.id === t.id);
    const variety = recent ? -0.2 : 0.1;
    // Léger malus si le cooldown vient d'expirer (anti-spam)
    const cdLeft = Math.max(0, (cooldowns[t.id] || 0) - Date.now());
    const cooldownPenalty = cdLeft > 0 ? -1 : 0;
    return { t, score: base + variety + cooldownPenalty };
  }).sort((a, b) => b.score - a.score);

  const pick = scored[0]?.t;
  if (!pick) return null;

  // Instancie la cible/meta
  const metaBase = pick.target(state, ctx);
  const meta = { ...metaBase };
  if (typeof pick.start === 'function') {
    const init = pick.start(state, metaBase) || {};
    Object.assign(meta, init);
  }

  const { title, desc } = labelize(pick.id, meta);

  return { templateId: pick.id, meta, tags: pick.tags || [], title, desc };
}

export function evaluateProgress(state, active) {
  if (!active) return { progress: 0, target: 0, done: false };
  const tpl = MICRO_TEMPLATES.find(x => x.id === active.templateId);
  if (!tpl) return { progress: 0, target: 0, done: true };
  try {
    const res = tpl.progress(state, active.meta || {});
    return res || { progress: 0, target: 0, done: false };
  } catch {
    return { progress: 0, target: 0, done: false };
  }
}

export function applyTemplateReward(state, ctx, active, applyRewards) {
  const tpl = MICRO_TEMPLATES.find(x => x.id === active.templateId);
  if (!tpl) return;
  try {
    const r = tpl.reward(state, ctx);
    // Utilise rewardAdapter/applyRewards supérieur si disponible
    if (applyRewards) applyRewards(state, normalizeReward(r, ctx), () => {}, () => {});
  } catch {}
}

function normalizeReward(r, ctx) {
  // Met en forme minimale si le moteur adaptatif n'est pas utilisé
  if (!r) return { cookies: 0, stage: ctx?.level || 'early', description: 'Récompense' };
  if (r.type === 'buff') {
    return { cookies: 0, buff: r, stage: ctx?.level || 'early', description: r.label || 'Buff' };
  }
  if (r.type === 'discount') {
    return { cookies: 0, discount: r, stage: ctx?.level || 'early', description: r.label || 'Réduction' };
  }
  return { cookies: 0, stage: ctx?.level || 'early', description: 'Récompense' };
}

// --- Missions principales ---
export function selectMainMission(state, ctx, options = {}) {
  const excludeId = options.excludeId;
  const forbiddenTags = options.forbiddenTags || [];
  const now = Date.now();
  const cooldowns = options.cooldowns || {};

  const eligible = MAIN_TEMPLATES.filter(t => {
    if (t.id === excludeId) return false;
    const conflict = (t.tags || []).some(tag => forbiddenTags.includes(tag));
    if (conflict) return false;
    if (cooldowns[t.id] && cooldowns[t.id] > now) return false;
    try { return !!t.eligible(state, ctx); } catch { return false; }
  });

  const scored = eligible.map(t => {
    let base = 0; try { base = Number(t.score(state, ctx)) || 0; } catch { base = 0; }
    return { t, score: base };
  }).sort((a,b)=>b.score-a.score);

  const pick = scored[0]?.t; if (!pick) return null;
  const meta = pick.target(state, ctx) || {};
  const titleDesc = typeof pick.label === 'function' ? pick.label(meta) : { title: 'Mission', desc: '' };
  return { templateId: pick.id, meta, tags: pick.tags || [], title: titleDesc.title, desc: titleDesc.desc };
}

export function evaluateMainProgress(state, ctx, active) {
  const tpl = MAIN_TEMPLATES.find(x => x.id === active.templateId);
  if (!tpl) return { progress: 0, target: 0, done: true };
  try {
    // La progress principale peut avoir besoin de ctx (ex: CPS)
    const res = tpl.progress(state, active.meta || {}, ctx);
    return res || { progress: 0, target: 0, done: false };
  } catch { return { progress: 0, target: 0, done: false }; }
}

export function rewardFromMain(state, ctx, active) {
  const tpl = MAIN_TEMPLATES.find(x => x.id === active.templateId);
  if (!tpl) return null;
  try { return tpl.reward(state, ctx); } catch { return null; }
}

function labelize(id, meta) {
  try {
    if (id === 'buy_affordable_building') {
      return { title: `Acheter ${meta.qty} × ${meta.itemId}`, desc: `Achète ${meta.qty} du prochain bâtiment abordable` };
    }
    if (id === 'gain_bank_fraction') {
      return { title: `Gagner ${meta.amount} cookies`, desc: `Collecte ${meta.amount} cookies (compte depuis le début de la mission)` };
    }
    if (id === 'clicks_burst') {
      return { title: `Réaliser ${meta.clicks} clics`, desc: `Atteins ${meta.clicks} clics dans le temps imparti` };
    }
  } catch {}
  return { title: 'Micro‑mission', desc: '' };
}


