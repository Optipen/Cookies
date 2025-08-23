// Tests pour les tooltips informatifs de shop

import { generateItemTooltip } from './shopHelpers.js';

export function testTooltipSystem() {
  console.log('🔍 Tests du système de tooltips informatifs');
  console.log('1. testEarlyGameTooltips() - Test tooltips early game');
  console.log('2. testMidGameTooltips() - Test tooltips mid game');
  console.log('3. testAllItemTooltips() - Test tous les items');
}

// Simule un costOf simple pour les tests
function mockCostOf(itemId, count) {
  const items = {
    cursor: { base: 18, growth: 1.15 },
    grandma: { base: 140, growth: 1.155 },
    oven: { base: 60, growth: 1.13 },
    bakery: { base: 500, growth: 1.135 }
  };
  
  const item = items[itemId];
  if (!item) return 100;
  
  return Math.ceil(item.base * Math.pow(item.growth, count));
}

export function testEarlyGameTooltips() {
  console.log('\n🌱 TEST TOOLTIPS EARLY GAME');
  
  const earlyState = {
    cookies: 150,
    lifetime: 800,
    items: { cursor: 2, grandma: 1 },
    upgrades: {},
    prestige: { chips: 0 },
    crypto: { staked: 0 },
    cpcBase: 1
  };
  
  console.log('Test Curseur:');
  const cursorTooltip = generateItemTooltip('cursor', earlyState, mockCostOf);
  if (cursorTooltip) {
    console.log('  Titre:', cursorTooltip.title);
    console.log('  Lignes:');
    cursorTooltip.lines.forEach(line => {
      console.log(`    ${line.label}: ${line.value}`);
    });
  }
  
  console.log('\nTest Four:');
  const ovenTooltip = generateItemTooltip('oven', earlyState, mockCostOf);
  if (ovenTooltip) {
    console.log('  Titre:', ovenTooltip.title);
    console.log('  Lignes:');
    ovenTooltip.lines.forEach(line => {
      console.log(`    ${line.label}: ${line.value}`);
    });
  }
}

export function testMidGameTooltips() {
  console.log('\n🏗️ TEST TOOLTIPS MID GAME');
  
  const midState = {
    cookies: 25000,
    lifetime: 180000,
    items: { cursor: 15, grandma: 10, oven: 8, bakery: 5 },
    upgrades: { click_mult_1: true },
    prestige: { chips: 1 },
    crypto: { staked: 0.01 },
    cpcBase: 1
  };
  
  console.log('Test Curseur (mid-game):');
  const cursorTooltip = generateItemTooltip('cursor', midState, mockCostOf);
  if (cursorTooltip) {
    console.log('  Titre:', cursorTooltip.title);
    console.log('  Lignes:');
    cursorTooltip.lines.forEach(line => {
      console.log(`    ${line.label}: ${line.value}`);
    });
  }
  
  console.log('\nTest Boulangerie (mid-game):');
  const bakeryTooltip = generateItemTooltip('bakery', midState, mockCostOf);
  if (bakeryTooltip) {
    console.log('  Titre:', bakeryTooltip.title);
    console.log('  Lignes:');
    bakeryTooltip.lines.forEach(line => {
      console.log(`    ${line.label}: ${line.value}`);
    });
  }
}

export function testAllItemTooltips() {
  console.log('\n📋 TEST TOUS LES ITEMS');
  
  const testState = {
    cookies: 10000,
    lifetime: 50000,
    items: { cursor: 5, grandma: 3, oven: 2, bakery: 1 },
    upgrades: {},
    prestige: { chips: 0 },
    crypto: { staked: 0 },
    cpcBase: 1
  };
  
  const itemsToTest = ['cursor', 'grandma', 'oven', 'bakery'];
  
  itemsToTest.forEach(itemId => {
    console.log(`\n${itemId.toUpperCase()}:`);
    const tooltip = generateItemTooltip(itemId, testState, mockCostOf);
    if (tooltip) {
      console.log(`  Titre: ${tooltip.title}`);
      tooltip.lines.forEach(line => {
        console.log(`  ${line.label}: ${line.value}`);
      });
    } else {
      console.log('  ❌ Tooltip non généré');
    }
  });
}

export function demonstrateTooltipFeatures() {
  console.log('\n✨ FONCTIONNALITÉS DES TOOLTIPS');
  
  console.log('📝 Informations affichées:');
  console.log('  • Coût actuel de l\'item');
  console.log('  • Coût du niveau suivant');
  console.log('  • Gain exact (+CPS ou +CPC)');
  console.log('  • Pourcentage d\'amélioration');
  console.log('  • Synergies disponibles');
  
  console.log('\n♿ Accessibilité:');
  console.log('  • Focusable au clavier (Tab)');
  console.log('  • aria-describedby pour lecteurs d\'écran');
  console.log('  • Fermeture à l\'Escape');
  console.log('  • Délai configurable (200ms)');
  
  console.log('\n🎨 Interface:');
  console.log('  • Positionnement intelligent (top/right/bottom/left)');
  console.log('  • Flèche de pointage');
  console.log('  • Backdrop blur pour lisibilité');
  console.log('  • Couleurs cohérentes avec le thème');
}

// Ajoute les fonctions au window en mode DEV
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.tooltipTests = {
    help: testTooltipSystem,
    early: testEarlyGameTooltips,
    mid: testMidGameTooltips,
    all: testAllItemTooltips,
    features: demonstrateTooltipFeatures
  };
  
  console.log('🔍 Tooltip Tests chargés ! Tapez tooltipTests.help() pour voir les commandes');
}
