import { ITEMS } from "../data/items.js";
import { cpsFrom, clickMultiplierFrom } from "../utils/calc.js";
import tuning from "../data/tuning.json";

// Construit un profil joueur compact utilisé par le moteur de missions
export function buildPlayerContext(state) {
  const bank = state.cookies || 0;
  const lifetime = state.lifetime || 0;
  const chips = state.prestige?.chips || 0;
  const stakeMulti = 1 + (state.crypto?.staked || 0) * 0.5;
  const cps = cpsFrom(state.items || {}, state.upgrades || {}, chips, stakeMulti);
  const cpcMult = clickMultiplierFrom(state.items || {}, state.upgrades || {});

  // Détermine le niveau courant (early/mid/late) via tuning.json si dispo
  const mode = (tuning && tuning.mode) || 'standard';
  const lv = deriveLevel(bank, cps, lifetime, tuning && tuning[mode]);

  // Prochain bâtiment "affordable" selon alpha * banque
  const alpha = 0.7; // par défaut; pourra venir du tuning
  const nextAffordable = findNextAffordable(state, bank, alpha);
  const affordScore = nextAffordable ? Math.min(1, bank / Math.max(1, nextAffordable.estimatedCost)) : 0;

  // Cibles dynamiques (simples, ajustées ensuite par templates)
  const beta = 0.6; // bank fraction target
  const gamma = 1.0; // cps×temps
  const targetBank = Math.max(50, Math.round(bank * (lv === 'early' ? 0.4 : (lv === 'mid' ? 0.6 : 0.8))));

  return {
    level: lv,
    bank,
    lifetime,
    cps,
    cpcMult,
    nextAffordable,
    affordScore,
    coeffs: { alpha, beta, gamma },
    targetBank,
  };
}

function deriveLevel(bank, cps, lifetime, modeCfg) {
  try {
    // Heuristique simple si pas de brackets paramétrés
    if (!modeCfg || !modeCfg.levels) {
      if (lifetime < 10_000 || cps < 10) return 'early';
      if (lifetime < 1_000_000 || cps < 500) return 'mid';
      return 'late';
    }
    // Si des brackets existent, on peut les utiliser (optionnel)
    const lv = modeCfg.levels;
    if (cps < (lv.cps?.mid || 50) && bank < (lv.bank?.mid || 10_000)) return 'early';
    if (cps < (lv.cps?.late || 1000) && bank < (lv.bank?.late || 1_000_000)) return 'mid';
    return 'late';
  } catch {
    return 'early';
  }
}

function estimateCost(state, itemId, qty = 1) {
  const it = ITEMS.find(x => x.id === itemId);
  if (!it) return Infinity;
  const owned = state.items[itemId] || 0;
  const g = it.growth;
  const base = it.base;
  // somme géométrique pour qty unités
  const series = (Math.pow(g, qty) - 1) / (g - 1);
  let total = base * Math.pow(g, owned) * series;
  // Applique approximativement le steepening de milestones
  // (on néglige ici les changements de seuils pour rester constant-time)
  return Math.ceil(total);
}

function findNextAffordable(state, bank, alpha) {
  // Cherche le premier item cps/mult dont le coût d'1 unité <= alpha * bank
  const candidates = ITEMS.map(it => ({
    id: it.id,
    mode: it.mode,
    estimatedCost: estimateCost(state, it.id, 1),
  }))
  .filter(x => x.estimatedCost <= Math.max(1, bank * alpha))
  .sort((a, b) => a.estimatedCost - b.estimatedCost);

  return candidates[0] || null;
}



