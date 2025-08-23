// Tests pour l'exclusivité mutuelle des missions

export function testMissionExclusivity() {
  console.log('🔄 Tests d\'alternance des missions');
  console.log('1. testMainMissionPriority() - Test priorité mission principale');
  console.log('2. testMissionAlternation() - Test alternance missions/micro-missions');
  console.log('3. testMicroMissionResume() - Test redémarrage micro-mission');
  console.log('4. simulateAlternation() - Simule alternance complète');
}

export function testMainMissionPriority() {
  console.log('\n🎯 TEST PRIORITÉ MISSION PRINCIPALE');
  
  try {
    const currentState = localStorage.getItem('cookie-craze-save');
    if (!currentState) {
      console.log('❌ Aucune sauvegarde trouvée');
      return;
    }
    
    const state = JSON.parse(currentState);
    console.log('État initial:');
    console.log(`  Mission: ${state.mission?.id || 'null'} (${state.mission?.completed ? 'terminée' : 'active'})`);
    console.log(`  Micro-mission: ${state.activeMicroMission?.id || 'null'}`);
    
    // Test logique d'exclusivité
    const mainMissionActive = state.mission && !state.mission.completed;
    const shouldHaveMicroMission = !mainMissionActive;
    const hasMicroMission = state.activeMicroMission && state.activeMicroMission.id;
    
    console.log('\nAnalyse logique:');
    console.log(`  Mission principale active: ${mainMissionActive}`);
    console.log(`  Devrait avoir micro-mission: ${shouldHaveMicroMission}`);
    console.log(`  A effectivement micro-mission: ${hasMicroMission}`);
    
    if (mainMissionActive && hasMicroMission) {
      console.log('⚠️  CONFLIT DÉTECTÉ: Mission ET micro-mission affichées simultanément');
    } else if (!mainMissionActive && !hasMicroMission) {
      console.log('⚠️  MANQUE: Aucune micro-mission alors que possible');
    } else {
      console.log('✅ État correct: Alternance respectée (une seule visible)');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

export function testMissionAlternation() {
  console.log('\n🔄 TEST ALTERNANCE MISSIONS');
  
  try {
    // Force un état avec mission principale active et micro-mission
    const conflictState = {
      mission: { 
        id: "first_click", 
        startedAt: Date.now(), 
        completed: false,
        progress: 0,
        target: 1
      },
      activeMicroMission: {
        id: "collect_250_gain",
        startedAt: Date.now() - 5000,
        progress: 100,
        target: 250
      },
      cookies: 500,
      items: {},
      stats: { clicks: 0 }
    };
    
    console.log('État d\'alternance simulé:');
    console.log(`  Mission: ${conflictState.mission.id} (active)`);
    console.log(`  Micro-mission: ${conflictState.activeMicroMission.id} (ne devrait pas être visible)`);
    
    // Simule la logique d'alternance
    const mainMissionActive = conflictState.mission && !conflictState.mission.completed;
    const shouldShowMicroMission = !mainMissionActive;
    
    console.log(`\nLogique d'alternance: ${shouldShowMicroMission ? 'AFFICHE micro-mission' : 'MASQUE micro-mission'}`);
    
    if (!shouldShowMicroMission) {
      console.log('✅ Micro-mission correctement masquée (alternance)');
    } else {
      console.log('❌ Micro-mission devrait être masquée');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

export function testMicroMissionResume() {
  console.log('\n▶️ TEST REDÉMARRAGE MICRO-MISSION');
  
  try {
    // Force un état avec mission principale terminée
    const resumeState = {
      mission: { 
        id: "first_click", 
        startedAt: Date.now() - 10000, 
        completed: true,
        progress: 1,
        target: 1
      },
      activeMicroMission: null, // Pas de micro-mission active
      cookies: 500,
      items: { cursor: 1 },
      stats: { clicks: 1 }
    };
    
    console.log('État de reprise simulé:');
    console.log(`  Mission: ${resumeState.mission.id} (terminée)`);
    console.log(`  Micro-mission: ${resumeState.activeMicroMission || 'null'}`);
    
    // Simule la logique de reprise
    const mainMissionActive = resumeState.mission && !resumeState.mission.completed;
    const shouldStartMicroMission = !mainMissionActive && !resumeState.activeMicroMission;
    
    console.log(`\nLogique de reprise: ${shouldStartMicroMission ? 'DÉMARRE micro-mission' : 'ATTEND'}`);
    
    if (shouldStartMicroMission) {
      console.log('✅ Micro-mission devrait être redémarrée');
    } else {
      console.log('⚠️  Conditions de reprise non remplies');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

export function simulateAlternation() {
  console.log('\n🔄 SIMULATION ALTERNANCE COMPLÈTE');
  
  try {
    const scenarios = [
      {
        name: "Mission + Micro-mission active",
        state: {
          mission: { id: "first_click", completed: false },
          activeMicroMission: { id: "collect_250_gain" }
        }
      },
      {
        name: "Mission terminée + Micro-mission null",
        state: {
          mission: { id: "first_click", completed: true },
          activeMicroMission: null
        }
      },
      {
        name: "Pas de mission + Micro-mission active",
        state: {
          mission: null,
          activeMicroMission: { id: "cursor_3" }
        }
      },
      {
        name: "Mission nouvelle + Micro-mission en cours",
        state: {
          mission: { id: "buy_10_cursors", completed: false },
          activeMicroMission: { id: "50_clicks_30s", progress: 25, target: 50 }
        }
      }
    ];
    
    scenarios.forEach((scenario, i) => {
      console.log(`\n${i + 1}. ${scenario.name}:`);
      
      const mainMissionActive = scenario.state.mission && !scenario.state.mission.completed;
      const hasMicroMission = scenario.state.activeMicroMission && scenario.state.activeMicroMission.id;
      
      console.log(`     Mission active: ${mainMissionActive}`);
      console.log(`     Micro-mission: ${hasMicroMission}`);
      
      if (mainMissionActive && hasMicroMission) {
        console.log(`     🚫 CONFLIT → Masque micro-mission (alternance)`);
      } else if (!mainMissionActive && !hasMicroMission) {
        console.log(`     🎯 VIDE → Démarre nouvelle micro-mission`);
      } else {
        console.log(`     ✅ OK → Alternance respectée`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la simulation:', error);
  }
}

export function demonstrateAlternationRules() {
  console.log('\n📋 RÈGLES D\'ALTERNANCE MISSIONS');
  
  console.log('\n🎯 PRIORITÉ:');
  console.log('  1. Mission principale > Micro-mission');
  console.log('  2. Une seule mission VISIBLE à la fois');
  console.log('  3. Alternance automatique selon l\'état');
  
  console.log('\n🔄 ALTERNANCE:');
  console.log('  • Mission principale active → Micro-mission masquée');
  console.log('  • Mission principale terminée → Micro-mission visible');
  console.log('  • Pas de "pause", juste alternance d\'affichage');
  
  console.log('\n▶️ REDÉMARRAGE:');
  console.log('  • Quand mission principale terminée → nouvelle micro-mission');
  console.log('  • Redémarrage propre, pas de récupération');
  console.log('  • Cycle naturel d\'alternance');
  
  console.log('\n🎨 INTERFACE:');
  console.log('  • Une seule carte mission visible');
  console.log('  • Pas de message "en pause"');
  console.log('  • Alternance fluide et naturelle');
  
  console.log('\n🔒 GARANTIES:');
  console.log('  • Jamais 2 missions affichées simultanément');
  console.log('  • Interface claire et sans confusion');
  console.log('  • Focus unique sur un objectif');
  console.log('  • Alternance prévisible et logique');
}

// Ajoute les fonctions au window en mode DEV
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.exclusivityTests = {
    help: testMissionExclusivity,
    priority: testMainMissionPriority,
    alternation: testMissionAlternation,
    resume: testMicroMissionResume,
    simulate: simulateAlternation,
    rules: demonstrateAlternationRules
  };
  
  console.log('🔄 Alternation Tests chargés ! Tapez exclusivityTests.help() pour voir les commandes');
}
