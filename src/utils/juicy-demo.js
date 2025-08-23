// Demo mode pour tester les effets "juteuses" - sons et animations

export function createJuicyDemo() {
  console.log('🎮 DEMO MODE - Effets Juteux Activé');
  console.log('Commandes disponibles:');
  console.log('1. juicyDemo.click() - Test clic cookie avec son + animation');
  console.log('2. juicyDemo.purchase() - Test achat avec flash + son');
  console.log('3. juicyDemo.golden() - Test golden cookie avec burst');
  console.log('4. juicyDemo.mission() - Test mission complete avec confettis');
  console.log('5. juicyDemo.all() - Test tous les effets en séquence');
}

export function testClickEffects() {
  console.log('🖱️ Test clic cookie...');
  
  // Simule un clic sur le cookie principal
  const cookieElement = document.querySelector('#game-area');
  if (cookieElement) {
    cookieElement.click();
    console.log('✅ Clic simulé - vérifiez le son + animation scale/rotate');
  } else {
    console.log('❌ Cookie principal non trouvé');
  }
}

export function testPurchaseEffects() {
  console.log('💰 Test achat avec flash...');
  
  // Simule un achat de curseur
  const cursorButtons = document.querySelectorAll('button');
  const cursorButton = Array.from(cursorButtons).find(btn => 
    btn.textContent.includes('Curseur') || btn.textContent.includes('🖱️')
  );
  
  if (cursorButton) {
    cursorButton.click();
    console.log('✅ Achat simulé - vérifiez le flash vert + son');
  } else {
    console.log('❌ Bouton curseur non trouvé');
  }
}

export function testGoldenEffects() {
  console.log('⭐ Test golden cookie...');
  
  // Force l'apparition d'un golden cookie
  try {
    const currentState = localStorage.getItem('cookie-craze-save');
    if (currentState) {
      const state = JSON.parse(currentState);
      
      // Trigger golden cookie appearance si possible
      const goldenButton = document.querySelector('button[style*="yellow"]');
      if (goldenButton) {
        goldenButton.click();
        console.log('✅ Golden cookie cliqué - vérifiez burst particules + son');
      } else {
        console.log('🔄 Aucun golden cookie visible actuellement');
        console.log('   Attendez qu\'un apparaisse ou forcez avec: setShowGolden(true)');
      }
    }
  } catch (e) {
    console.log('❌ Erreur test golden:', e.message);
  }
}

export function testMissionEffects() {
  console.log('🎯 Test mission complete...');
  
  try {
    const currentState = localStorage.getItem('cookie-craze-save');
    if (currentState) {
      const state = JSON.parse(currentState);
      
      // Force completion de la mission actuelle
      if (state.mission) {
        state.mission.completed = true;
        state.mission.progress = state.mission.target || 1;
        localStorage.setItem('cookie-craze-save', JSON.stringify(state));
        
        // Recharge pour déclencher l'effet
        setTimeout(() => {
          window.location.reload();
        }, 500);
        
        console.log('🔄 Mission forcée terminée - rechargement pour voir confettis + son...');
      } else {
        console.log('❌ Aucune mission active trouvée');
      }
    }
  } catch (e) {
    console.log('❌ Erreur test mission:', e.message);
  }
}

export function testAllEffects() {
  console.log('🎪 TEST COMPLET - Tous les effets en séquence');
  
  console.log('1/4 - Clic cookie...');
  testClickEffects();
  
  setTimeout(() => {
    console.log('2/4 - Achat...');
    testPurchaseEffects();
  }, 1000);
  
  setTimeout(() => {
    console.log('3/4 - Golden cookie...');
    testGoldenEffects();
  }, 2000);
  
  setTimeout(() => {
    console.log('4/4 - Mission...');
    testMissionEffects();
  }, 3000);
}

export function demonstrateSoundFeatures() {
  console.log('\n🔊 FONCTIONNALITÉS AUDIO');
  
  console.log('📁 Fichiers sons utilisés:');
  console.log('  • /crunch.mp3 - Clic cookie (léger)');
  console.log('  • /crunch-1.mp3 - Achat réussi (satisfaisant)');
  console.log('  • /crunch-2.mp3 - Gros achat (impactant)');
  console.log('  • /sounds/golden_appear.mp3 - Golden + Mission (brillant)');
  
  console.log('\n🎨 Animations visuelles:');
  console.log('  • Cookie: Scale 1.1 + rotation ±15° (150ms spring)');
  console.log('  • Achat: Flash ring emerald + background (300ms)');
  console.log('  • Golden: 50 particules burst (au lieu de 30)');
  console.log('  • Mission: 80 particules confetti + ping aigu');
  
  console.log('\n⚙️ Performance:');
  console.log('  • Réutilise RAF existant (pas de nouveau interval)');
  console.log('  • Sons via useSound/useAudio existants');
  console.log('  • Animations throttlées via Framer Motion');
  console.log('  • Respect toggle Son ON/OFF');
}

export function showCurrentAudioState() {
  try {
    const state = JSON.parse(localStorage.getItem('cookie-craze-save'));
    console.log('\n🔊 ÉTAT AUDIO ACTUEL:');
    console.log(`  UI Sounds: ${state.ui?.sounds ? 'ON' : 'OFF'}`);
    console.log(`  Settings soundEnabled: ${state.settings?.soundEnabled ? 'ON' : 'OFF'}`);
    console.log(`  Feature ENABLE_SOUNDS: ${state.settings?.soundEnabled ? 'ON' : 'OFF'}`);
    
    if (!state.ui?.sounds) {
      console.log('\n⚠️  Les sons sont désactivés !');
      console.log('   Activez avec le bouton 🔊 dans l\'interface');
    }
  } catch (e) {
    console.log('❌ Erreur lecture état audio:', e.message);
  }
}

// Ajoute les fonctions au window en mode DEV
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.juicyDemo = {
    help: createJuicyDemo,
    click: testClickEffects,
    purchase: testPurchaseEffects,
    golden: testGoldenEffects,
    mission: testMissionEffects,
    all: testAllEffects,
    sounds: demonstrateSoundFeatures,
    audio: showCurrentAudioState
  };
  
  console.log('🎮 Juicy Demo chargé ! Tapez juicyDemo.help() pour voir les commandes');
}
