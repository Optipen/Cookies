// Script de test pour valider le timer des missions chronométrées

export function testTimerSystem() {
  console.log('🔧 Tests du système de timer disponibles:');
  console.log('1. simulateTimedMission() - Force une mission chronométrée');
  console.log('2. testTimerMemoryLeak() - Test de fuite mémoire');
  console.log('3. getCurrentTimerInfo() - Affiche l\'état du timer actuel');
}

// Simule une mission chronométrée pour les tests
export function simulateTimedMission() {
  console.log('⏱️  Simulation d\'une mission chronométrée...');
  
  try {
    // Récupère l'état actuel
    const currentStateStr = localStorage.getItem('cookieCrazeSaveV4');
    if (!currentStateStr) {
      console.log('❌ Aucune sauvegarde trouvée');
      return;
    }
    
    const currentState = JSON.parse(currentStateStr);
    
    // Force une micro-mission chronométrée ("50_clicks_30s")
    const timedMissionState = {
      ...currentState,
      activeMicroMission: {
        id: "50_clicks_30s",
        startedAt: Date.now(),
        meta: {
          clicksAtStart: currentState.stats?.clicks || 0,
          until: Date.now() + 30000 // 30 secondes
        },
        progress: 0,
        target: 50
      }
    };
    
    // Sauvegarde et recharge
    localStorage.setItem('cookieCrazeSaveV4', JSON.stringify(timedMissionState));
    console.log('✅ Mission chronométrée simulée: "Sprint éclair" (50 clics en 30s)');
    console.log('   Rechargement de la page...');
    window.location.reload();
    
  } catch (error) {
    console.error('❌ Erreur lors de la simulation:', error);
  }
}

// Test de fuite mémoire - crée et détruit plusieurs timers
export function testTimerMemoryLeak() {
  console.log('🧪 Test de fuite mémoire du timer...');
  
  let intervalCount = 0;
  const originalSetInterval = window.setInterval;
  const originalClearInterval = window.clearInterval;
  
  // Hook pour compter les intervalles
  window.setInterval = function(...args) {
    intervalCount++;
    console.log(`📈 Interval créé (total: ${intervalCount})`);
    return originalSetInterval.apply(this, args);
  };
  
  window.clearInterval = function(...args) {
    intervalCount--;
    console.log(`📉 Interval nettoyé (total: ${intervalCount})`);
    return originalClearInterval.apply(this, args);
  };
  
  // Test: crée plusieurs missions avec timers
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      simulateTimedMission();
    }, i * 1000);
  }
  
  // Vérifie après 10 secondes
  setTimeout(() => {
    console.log(`🔍 Résultat final: ${intervalCount} intervalles actifs`);
    if (intervalCount <= 1) {
      console.log('✅ Pas de fuite mémoire détectée');
    } else {
      console.log('❌ Possible fuite mémoire détectée');
    }
    
    // Restore les fonctions originales
    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
  }, 10000);
}

// Affiche les infos du timer actuel
export function getCurrentTimerInfo() {
  console.log('ℹ️  Informations du timer actuel:');
  
  try {
    const currentStateStr = localStorage.getItem('cookieCrazeSaveV4');
    if (!currentStateStr) {
      console.log('   Aucune sauvegarde trouvée');
      return;
    }
    
    const currentState = JSON.parse(currentStateStr);
    const microMission = currentState.activeMicroMission;
    
    if (!microMission) {
      console.log('   Aucune micro-mission active');
      return;
    }
    
    console.log(`   Mission active: ${microMission.id}`);
    console.log(`   Commencée à: ${new Date(microMission.startedAt).toLocaleTimeString()}`);
    
    if (microMission.meta?.until) {
      const remaining = microMission.meta.until - Date.now();
      const seconds = Math.ceil(remaining / 1000);
      console.log(`   Fin prévue: ${new Date(microMission.meta.until).toLocaleTimeString()}`);
      console.log(`   Temps restant: ${seconds}s`);
      console.log(`   Timer actif: ${remaining > 0 ? 'OUI' : 'NON'}`);
    } else {
      console.log('   Pas de timer (mission non chronométrée)');
    }
    
    console.log(`   Progrès: ${microMission.progress || 0}/${microMission.target || '?'}`);
    
  } catch (error) {
    console.error('   Erreur lors de la lecture:', error);
  }
}

// Ajoute les fonctions au window en mode DEV
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.timerTests = {
    help: testTimerSystem,
    simulate: simulateTimedMission,
    memoryTest: testTimerMemoryLeak,
    info: getCurrentTimerInfo
  };
  
  console.log('⏱️  Timer Tests chargés ! Tapez timerTests.help() pour voir les commandes');
}
