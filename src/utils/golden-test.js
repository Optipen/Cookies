// Test utilitaire pour les cookies dorés et missions

export function createGoldenTests() {
  console.log('⭐ GOLDEN COOKIE TESTS - Comptage missions');
  console.log('Commandes disponibles:');
  console.log('1. goldenTests.showStats() - Affiche stats goldenClicks');
  console.log('2. goldenTests.forceGolden() - Force apparition cookie doré');
  console.log('3. goldenTests.testMission() - Active mission "3 cookies dorés"');
  console.log('4. goldenTests.simulateClicks() - Simule 3 clics automatiques');
  console.log('5. goldenTests.checkProgress() - Vérifie progression mission');
  console.log('6. goldenTests.resetCounter() - Remet goldenClicks à 0');
}

export function showGoldenStats() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    console.log('\n⭐ STATS COOKIES DORÉS:');
    console.log(`  Golden Clicks: ${state.stats?.goldenClicks || 0}`);
    console.log(`  Cookies totaux: ${state.cookies?.toLocaleString() || 0}`);
    console.log(`  Clics normaux: ${state.stats?.clicks || 0}`);
    
    const mission = state.mission;
    if (mission && mission.id === '3_golden') {
      console.log('\n🎯 MISSION ACTIVE: "Gagner 3 cookies dorés"');
      console.log(`  Progression: ${mission.progress || 0}/3`);
      console.log(`  Complétée: ${mission.completed ? 'Oui' : 'Non'}`);
    } else {
      console.log('\n⚪ Mission "3 cookies dorés" non active');
      console.log(`  Mission actuelle: ${mission?.id || 'Aucune'}`);
    }
  } catch (e) {
    console.log('❌ Erreur lecture état:', e.message);
  }
}

export function forceGoldenCookie() {
  console.log('⭐ Force apparition d\'un cookie doré...');
  
  // Essaie de déclencher setShowGolden via l'événement global
  try {
    // Simule l'événement qui déclenche un golden cookie
    window.dispatchEvent(new CustomEvent('forceGolden'));
    console.log('✅ Événement forceGolden envoyé');
    console.log('💡 Si aucun cookie doré n\'apparaît, utilise goldenTests.simulateClicks()');
  } catch (e) {
    console.log('❌ Erreur force golden:', e.message);
  }
}

export function setGoldenMission() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    
    // Force la mission "3 cookies dorés"
    state.mission = {
      id: "3_golden",
      startedAt: Date.now(),
      completed: false,
      progress: Math.min(state.stats?.goldenClicks || 0, 3),
      target: 3
    };
    
    localStorage.setItem('cookieCrazeSaveV4', JSON.stringify(state));
    console.log('🎯 Mission "3 cookies dorés" activée');
    console.log(`📊 Progression actuelle: ${state.mission.progress}/3`);
    
    window.location.reload();
  } catch (e) {
    console.log('❌ Erreur activation mission:', e.message);
  }
}

export function simulateGoldenClicks(count = 3) {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    
    // Simule les clics en incrémentant directement le compteur
    const currentGolden = state.stats?.goldenClicks || 0;
    state.stats = {
      ...state.stats,
      goldenClicks: currentGolden + count
    };
    
    localStorage.setItem('cookieCrazeSaveV4', JSON.stringify(state));
    
    console.log(`⭐ ${count} clics de cookies dorés simulés`);
    console.log(`📊 Total goldenClicks: ${currentGolden} → ${currentGolden + count}`);
    
    window.location.reload();
  } catch (e) {
    console.log('❌ Erreur simulation clics:', e.message);
  }
}

export function checkMissionProgress() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    
    console.log('\n🔍 VÉRIFICATION PROGRESSION:');
    console.log(`Stats goldenClicks: ${state.stats?.goldenClicks || 0}`);
    
    const mission = state.mission;
    if (mission) {
      console.log(`Mission active: ${mission.id}`);
      console.log(`Progression: ${mission.progress || 0}/${mission.target || '?'}`);
      console.log(`Complétée: ${mission.completed ? 'Oui' : 'Non'}`);
      
      // Test manuel de la logique de mission
      if (mission.id === '3_golden') {
        const goldenClicks = state.stats?.goldenClicks || 0;
        const shouldBeCompleted = goldenClicks >= 3;
        
        console.log('\n🧪 TEST LOGIQUE:');
        console.log(`  Clicks dorés: ${goldenClicks}`);
        console.log(`  Devrait être complétée: ${shouldBeCompleted ? 'Oui' : 'Non'}`);
        console.log(`  Est complétée: ${mission.completed ? 'Oui' : 'Non'}`);
        
        if (shouldBeCompleted && !mission.completed) {
          console.log('⚠️ PROBLÈME: Mission devrait être complétée !');
        } else if (!shouldBeCompleted && mission.completed) {
          console.log('⚠️ PROBLÈME: Mission ne devrait pas être complétée !');
        } else {
          console.log('✅ Logique mission correcte');
        }
      }
    } else {
      console.log('❌ Aucune mission active');
    }
  } catch (e) {
    console.log('❌ Erreur vérification:', e.message);
  }
}

export function resetGoldenCounter() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    state.stats = {
      ...state.stats,
      goldenClicks: 0
    };
    
    localStorage.setItem('cookieCrazeSaveV4', JSON.stringify(state));
    console.log('🔄 Compteur goldenClicks remis à 0');
    
    window.location.reload();
  } catch (e) {
    console.log('❌ Erreur reset compteur:', e.message);
  }
}

export function testFullWorkflow() {
  console.log('\n🎯 TEST COMPLET WORKFLOW GOLDEN:');
  
  console.log('1. Reset compteur...');
  setTimeout(() => {
    resetGoldenCounter();
  }, 500);
  
  setTimeout(() => {
    console.log('2. Active mission "3 cookies dorés"...');
    setGoldenMission();
  }, 2000);
  
  setTimeout(() => {
    console.log('3. Simule 1 clic...');
    simulateGoldenClicks(1);
  }, 4000);
  
  setTimeout(() => {
    console.log('4. Vérification progression...');
    checkMissionProgress();
  }, 6000);
  
  setTimeout(() => {
    console.log('5. Simule 2 clics supplémentaires...');
    simulateGoldenClicks(2);
  }, 8000);
  
  setTimeout(() => {
    console.log('6. Vérification finale...');
    checkMissionProgress();
  }, 10000);
}

export function inspectGoldenLogic() {
  console.log('\n🔬 INSPECTION LOGIQUE GOLDEN:');
  
  // Cherche la fonction onGoldenClick dans le code
  console.log('Vérification du code:');
  console.log('1. La fonction onGoldenClick doit incrémenter stats.goldenClicks');
  console.log('2. Le useEffect mission doit écouter state.stats.goldenClicks');
  console.log('3. La mission "3_golden" doit check (s.stats.goldenClicks || 0) >= 3');
  
  console.log('\n🎯 Pour tester manuellement:');
  console.log('1. Lancez goldenTests.resetCounter()');
  console.log('2. Lancez goldenTests.setGoldenMission()');
  console.log('3. Cliquez 3 cookies dorés sur le jeu');
  console.log('4. Lancez goldenTests.checkProgress()');
  console.log('5. La mission devrait être complétée automatiquement');
}

// Ajoute les fonctions au window en mode DEV
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.goldenTests = {
    help: createGoldenTests,
    showStats: showGoldenStats,
    forceGolden: forceGoldenCookie,
    testMission: setGoldenMission,
    simulateClicks: simulateGoldenClicks,
    checkProgress: checkMissionProgress,
    resetCounter: resetGoldenCounter,
    testFull: testFullWorkflow,
    inspect: inspectGoldenLogic
  };
  
  console.log('⭐ Golden Tests chargés ! Tapez goldenTests.help() pour voir les commandes');
}
