// Tests pour le système de récompenses adaptatif

import { rewardAdapter } from './rewardAdapter.js';

export function testRewardStages() {
  console.log('🎯 Tests du système de récompenses adaptatif');
  console.log('1. testEarlyStage() - Test early game');
  console.log('2. testMidStage() - Test mid game'); 
  console.log('3. testLateStage() - Test late game');
  console.log('4. runAllTests() - Lance tous les tests');
}

// Early game: <30min, <10k lifetime, <10 CPS
export function testEarlyStage() {
  console.log('\n🌱 TEST EARLY GAME');
  
  const earlyState = {
    cookies: 150,
    lifetime: 800,
    createdAt: Date.now() - (15 * 60 * 1000), // 15 minutes ago
    items: { cursor: 3, grandma: 1 },
    upgrades: {},
    prestige: { chips: 0 },
    crypto: { staked: 0 }
  };
  
  const mission = { id: "test_early", title: "Test Early" };
  const reward = rewardAdapter(earlyState, mission);
  
  console.log('📊 État:', {
    cookies: earlyState.cookies,
    lifetime: earlyState.lifetime,
    age: '15min',
    items: Object.values(earlyState.items).reduce((s, v) => s + v, 0)
  });
  
  console.log('🎁 Récompense:', {
    stage: reward.stage,
    cookies: reward.cookies,
    buff: reward.buff ? `${reward.buff.label} (${reward.buff.seconds}s)` : 'none',
    description: reward.description
  });
  
  return reward;
}

// Mid game: 30min-3h, 10k-1M lifetime, 10-500 CPS
export function testMidStage() {
  console.log('\n🏗️ TEST MID GAME');
  
  const midState = {
    cookies: 25000,
    lifetime: 180000,
    createdAt: Date.now() - (90 * 60 * 1000), // 90 minutes ago
    items: { 
      cursor: 15, 
      grandma: 10, 
      farm: 5, 
      oven: 8,
      factory: 2 
    },
    upgrades: { click_mult_1: true, cps_mult_1: true },
    prestige: { chips: 0 },
    crypto: { staked: 0 }
  };
  
  const mission = { id: "test_mid", title: "Test Mid" };
  const reward = rewardAdapter(midState, mission);
  
  console.log('📊 État:', {
    cookies: midState.cookies,
    lifetime: midState.lifetime,
    age: '90min',
    items: Object.values(midState.items).reduce((s, v) => s + v, 0)
  });
  
  console.log('🎁 Récompense:', {
    stage: reward.stage,
    cookies: reward.cookies,
    buff: reward.buff ? `${reward.buff.label} (${reward.buff.seconds}s)` : 'none',
    discount: reward.discount ? `${reward.discount.label} (${reward.discount.seconds}s)` : 'none',
    description: reward.description
  });
  
  return reward;
}

// Late game: 3h+, 1M+ lifetime, 500+ CPS
export function testLateStage() {
  console.log('\n🏭 TEST LATE GAME');
  
  const lateState = {
    cookies: 2500000,
    lifetime: 15000000,
    createdAt: Date.now() - (5 * 60 * 60 * 1000), // 5 hours ago
    items: { 
      cursor: 50, 
      grandma: 40, 
      farm: 30, 
      oven: 25,
      factory: 20,
      bank: 15,
      temple: 10,
      lab: 5
    },
    upgrades: { 
      click_mult_1: true, 
      click_mult_2: true,
      cps_mult_1: true,
      cps_mult_2: true,
      all_mult_1: true
    },
    prestige: { chips: 5 },
    crypto: { staked: 0.1 }
  };
  
  const mission = { id: "test_late", title: "Test Late" };
  const reward = rewardAdapter(lateState, mission);
  
  console.log('📊 État:', {
    cookies: lateState.cookies,
    lifetime: lateState.lifetime,
    age: '5h',
    items: Object.values(lateState.items).reduce((s, v) => s + v, 0),
    prestige: lateState.prestige.chips
  });
  
  console.log('🎁 Récompense:', {
    stage: reward.stage,
    cookies: reward.cookies,
    buff: reward.buff ? `${reward.buff.label} (${reward.buff.seconds}s)` : 'none',
    discount: reward.discount ? `${reward.discount.label} (${reward.discount.seconds}s)` : 'none',
    description: reward.description
  });
  
  return reward;
}

export function runAllTests() {
  console.log('🧪 TESTS COMPLETS DU SYSTÈME DE RÉCOMPENSES\n');
  
  const results = {
    early: testEarlyStage(),
    mid: testMidStage(), 
    late: testLateStage()
  };
  
  console.log('\n📋 RÉSUMÉ DES TESTS:');
  console.table([
    {
      Stage: 'Early',
      Cookies: results.early.cookies,
      'Buff/Discount': results.early.buff ? results.early.buff.label : (results.early.discount ? results.early.discount.label : 'none'),
      Duration: results.early.buff ? results.early.buff.seconds + 's' : (results.early.discount ? results.early.discount.seconds + 's' : '-')
    },
    {
      Stage: 'Mid', 
      Cookies: results.mid.cookies,
      'Buff/Discount': results.mid.buff ? results.mid.buff.label : (results.mid.discount ? results.mid.discount.label : 'none'),
      Duration: results.mid.buff ? results.mid.buff.seconds + 's' : (results.mid.discount ? results.mid.discount.seconds + 's' : '-')
    },
    {
      Stage: 'Late',
      Cookies: results.late.cookies, 
      'Buff/Discount': results.late.buff ? results.late.buff.label : (results.late.discount ? results.late.discount.label : 'none'),
      Duration: results.late.buff ? results.late.buff.seconds + 's' : (results.late.discount ? results.late.discount.seconds + 's' : '-')
    }
  ]);
  
  console.log('\n✅ Tous les tests terminés !');
  return results;
}

// Simule des récompenses pour différents stades
export function simulateRewardProgression() {
  console.log('📈 SIMULATION DE PROGRESSION DES RÉCOMPENSES');
  
  const stages = [
    { name: 'Start', cookies: 50, lifetime: 100, minutes: 5 },
    { name: 'Early+', cookies: 500, lifetime: 2000, minutes: 20 },
    { name: 'Mid-', cookies: 5000, lifetime: 50000, minutes: 60 },
    { name: 'Mid', cookies: 50000, lifetime: 300000, minutes: 120 },
    { name: 'Mid+', cookies: 200000, lifetime: 800000, minutes: 180 },
    { name: 'Late-', cookies: 1000000, lifetime: 5000000, minutes: 300 },
    { name: 'Late', cookies: 5000000, lifetime: 25000000, minutes: 480 },
    { name: 'Late+', cookies: 20000000, lifetime: 100000000, minutes: 720 }
  ];
  
  const results = stages.map(stage => {
    const state = {
      cookies: stage.cookies,
      lifetime: stage.lifetime,
      createdAt: Date.now() - (stage.minutes * 60 * 1000),
      items: generateItemsForStage(stage),
      upgrades: {},
      prestige: { chips: Math.floor(stage.minutes / 120) },
      crypto: { staked: 0 }
    };
    
    const reward = rewardAdapter(state, { id: 'test', title: 'Test' });
    
    return {
      Stage: stage.name,
      Minutes: stage.minutes,
      Cookies: stage.cookies,
      'Reward Cookies': reward.cookies,
      'Reward %': ((reward.cookies / stage.cookies) * 100).toFixed(1) + '%',
      'Detected Stage': reward.stage,
      Buff: reward.buff ? reward.buff.label : (reward.discount ? reward.discount.label : 'none')
    };
  });
  
  console.table(results);
}

function generateItemsForStage(stage) {
  const base = Math.floor(stage.minutes / 10);
  return {
    cursor: Math.max(1, base),
    grandma: Math.max(0, base - 2),
    farm: Math.max(0, base - 5),
    oven: Math.max(0, base - 8)
  };
}

// Ajoute les fonctions au window en mode DEV
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.rewardTests = {
    help: testRewardStages,
    early: testEarlyStage,
    mid: testMidStage,
    late: testLateStage,
    all: runAllTests,
    progression: simulateRewardProgression
  };
  
  console.log('🎁 Reward Tests chargés ! Tapez rewardTests.help() pour voir les commandes');
}
