import { ITEMS } from "../data/items.js";
import { cpsFrom, clickMultiplierFrom, computePerItemMult } from "./calc.js";
import { fmt, fmtInt } from "./format.js";

/**
 * Calcule toutes les données nécessaires pour le tooltip d'un item
 * @param {string} itemId - ID de l'item
 * @param {Object} state - État du jeu
 * @param {Function} costOf - Fonction de calcul de coût
 * @returns {Object} Données pour le tooltip
 */
export function calculateItemTooltipData(itemId, state, costOf) {
  const item = ITEMS.find(it => it.id === itemId);
  if (!item) return null;

  const owned = state.items[itemId] || 0;
  const stakeMulti = 1 + (state.crypto?.staked || 0) * 0.5;
  
  // Coûts
  const costCurrent = costOf(itemId, 1);
  const costNext = owned > 0 ? costOf(itemId, 1) : null; // Le coût du prochain après celui-ci
  
  // Pour calculer le coût suivant, on simule l'achat d'un item
  let costAfterBuy = null;
  if (owned >= 0) {
    try {
      // Simule le coût si on avait un de plus
      const tempItems = { ...state.items, [itemId]: owned + 1 };
      const tempState = { ...state, items: tempItems };
      
      // Calcule le coût avec le nouveau nombre possédé
      const it = ITEMS.find((x) => x.id === itemId);
      const growth = it.growth;
      const base = it.base;
      costAfterBuy = Math.ceil(base * Math.pow(growth, owned + 1));
    } catch (e) {
      costAfterBuy = null;
    }
  }

  // Gains actuels et après achat
  const gainData = calculateItemGains(itemId, state, stakeMulti);
  
  // Synergies
  const synergyText = item.synergy || null;
  
  return {
    item,
    owned,
    costs: {
      current: costCurrent,
      next: costAfterBuy
    },
    gains: gainData,
    synergy: synergyText
  };
}

/**
 * Calcule les gains d'un item (CPS ou CPC)
 */
function calculateItemGains(itemId, state, stakeMulti) {
  const item = ITEMS.find(it => it.id === itemId);
  if (!item) return null;

  const owned = state.items[itemId] || 0;
  
  if (item.mode === 'cps') {
    // Calcul CPS avant et après
    const currentCPS = cpsFrom(state.items, state.upgrades, state.prestige?.chips || 0, stakeMulti);
    
    // Simule +1 item
    const newItems = { ...state.items, [itemId]: owned + 1 };
    const newCPS = cpsFrom(newItems, state.upgrades, state.prestige?.chips || 0, stakeMulti);
    
    const gainPerItem = newCPS - currentCPS;
    const gainTotal = gainPerItem; // Pour 1 item
    
    return {
      type: 'CPS',
      perItem: gainPerItem,
      total: gainTotal,
      current: currentCPS
    };
  } else if (item.mode === 'mult') {
    // Calcul CPC avant et après
    const currentMult = clickMultiplierFrom(state.items, state.upgrades);
    
    // Simule +1 item
    const newItems = { ...state.items, [itemId]: owned + 1 };
    const newMult = clickMultiplierFrom(newItems, state.upgrades);
    
    const gainMult = newMult - currentMult;
    
    // Convertit en gain CPC réel
    const baseCPC = state.cpcBase || 1;
    const cpcGain = baseCPC * gainMult;
    
    return {
      type: 'CPC',
      perItem: gainMult,
      total: cpcGain,
      current: currentMult,
      baseCPC: baseCPC
    };
  }
  
  return null;
}

/**
 * Génère les lignes du tooltip pour un item
 */
export function generateTooltipLines(tooltipData) {
  if (!tooltipData) return [];

  const { costs, gains, synergy } = tooltipData;
  const lines = [];

  // Coût actuel et suivant
  lines.push({
    label: "Coût actuel",
    value: fmtInt(costs.current),
    className: "text-yellow-300"
  });

  if (costs.next !== null) {
    lines.push({
      label: "Coût suivant",
      value: fmtInt(costs.next),
      className: "text-yellow-200"
    });
  }

  // Gains
  if (gains) {
    if (gains.type === 'CPS') {
      lines.push({
        label: "Gain",
        value: `+${fmt(gains.perItem)} CPS`,
        className: "text-green-300"
      });
      
      if (gains.current > 0) {
        const percentage = ((gains.perItem / gains.current) * 100).toFixed(1);
        lines.push({
          label: "Amélioration",
          value: `+${percentage}%`,
          className: "text-green-200"
        });
      }
    } else if (gains.type === 'CPC') {
      lines.push({
        label: "Gain clic",
        value: `+${fmt(gains.total)} CPC`,
        className: "text-blue-300"
      });
      
      if (gains.current > 0) {
        const percentage = ((gains.perItem / gains.current) * 100).toFixed(1);
        lines.push({
          label: "Amélioration",
          value: `+${percentage}%`,
          className: "text-blue-200"
        });
      }
    }
  }

  return lines;
}

/**
 * Génère le titre du tooltip
 */
export function generateTooltipTitle(tooltipData) {
  if (!tooltipData) return "";
  
  const { item, owned } = tooltipData;
  return `${item.emoji} ${item.name} (${owned})`;
}

/**
 * Génère le texte de synergie si disponible
 */
export function generateSynergyText(tooltipData) {
  if (!tooltipData || !tooltipData.synergy) return null;
  
  return {
    label: "Synergie",
    value: tooltipData.synergy,
    className: "text-purple-300 text-xs italic"
  };
}

/**
 * Fonction complète pour générer un tooltip d'item
 */
export function generateItemTooltip(itemId, state, costOf) {
  const data = calculateItemTooltipData(itemId, state, costOf);
  if (!data) return null;

  const lines = generateTooltipLines(data);
  const synergy = generateSynergyText(data);
  
  if (synergy) {
    lines.push(synergy);
  }

  return {
    title: generateTooltipTitle(data),
    lines: lines,
    data: data
  };
}
