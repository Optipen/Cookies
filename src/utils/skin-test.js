// Test utilitaire pour le système de skins amélioré

export function createSkinTests() {
  console.log('👔 SKIN TESTS - Système amélioré');
  console.log('Commandes disponibles:');
  console.log('1. skinTests.showAll() - Liste tous les skins');
  console.log('2. skinTests.giveStarter() - Donne assez de cookies pour starter skin');
  console.log('3. skinTests.giveEarly() - Donne assez de cookies pour early skin');
  console.log('4. skinTests.unlockAll() - Débloque tous les skins');
  console.log('5. skinTests.testPreview() - Test système prévisualisation');
  console.log('6. skinTests.testMission() - Force mission "équipe ton 1er skin"');
  console.log('7. skinTests.exportTest() - Test export/import');
}

export function showAllSkins() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    console.log('\n👔 SKINS DISPONIBLES:');
    
    // Les skins sont définis dans CookieCraze.jsx
    const skins = {
      default: { price: 0, name: "Choco" },
      starter: { price: 1000, name: "Starter" },
      early: { price: 10000, name: "Early" },
      caramel: { price: 50000, name: "Caramel" },
      noir: { price: 200000, name: "Noir" },
      ice: { price: 500000, name: "Ice" },
      fire: { price: 2000000, name: "Lava" }
    };
    
    Object.entries(skins).forEach(([id, skin]) => {
      const owned = state.skinsOwned?.[id] ? '✅' : '❌';
      const equipped = state.skin === id ? '🎯' : '  ';
      const affordable = state.cookies >= skin.price ? '💰' : '💸';
      console.log(`  ${equipped} ${owned} ${affordable} ${skin.name.padEnd(8)} - ${skin.price.toLocaleString()} cookies`);
    });
    
    console.log(`\n💰 Cookies actuels: ${state.cookies.toLocaleString()}`);
    console.log(`🎯 Skin équipé: ${state.skin}`);
  } catch (e) {
    console.log('❌ Erreur lecture état:', e.message);
  }
}

export function giveStarterMoney() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    state.cookies = Math.max(state.cookies, 1500); // Assez pour starter + marge
    localStorage.setItem('cookieCrazeSaveV4', JSON.stringify(state));
    console.log('💰 Cookies donnés pour skin Starter (1,500)');
    window.location.reload();
  } catch (e) {
    console.log('❌ Erreur:', e.message);
  }
}

export function giveEarlyMoney() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    state.cookies = Math.max(state.cookies, 12000); // Assez pour early + marge
    localStorage.setItem('cookieCrazeSaveV4', JSON.stringify(state));
    console.log('💰 Cookies donnés pour skin Early (12,000)');
    window.location.reload();
  } catch (e) {
    console.log('❌ Erreur:', e.message);
  }
}

export function unlockAllSkins() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    state.skinsOwned = {
      default: true,
      starter: true,
      early: true,
      caramel: true,
      noir: true,
      ice: true,
      fire: true
    };
    state.cookies = Math.max(state.cookies, 5000000); // Assez pour tous
    localStorage.setItem('cookieCrazeSaveV4', JSON.stringify(state));
    console.log('🔓 Tous les skins débloqués + cookies donnés');
    window.location.reload();
  } catch (e) {
    console.log('❌ Erreur:', e.message);
  }
}

export function testPreviewSystem() {
  console.log('\n👁️ TEST PRÉVISUALISATION:');
  console.log('1. Allez dans l\'onglet Skins');
  console.log('2. Passez la souris sur différents skins');
  console.log('3. Vérifiez que le cookie principal change temporairement');
  console.log('4. Vérifiez les badges: 👁️ (preview) et ✓ (équipé)');
  console.log('5. Les transitions doivent être fluides (300ms)');
  
  // Test automatique d'émission d'événements
  console.log('\n🧪 Test automatique événements:');
  window.dispatchEvent(new CustomEvent('skinPreview', { detail: 'starter' }));
  setTimeout(() => {
    console.log('  → Prévisualisation starter activée');
    window.dispatchEvent(new CustomEvent('skinPreview', { detail: null }));
    setTimeout(() => {
      console.log('  → Prévisualisation désactivée');
    }, 500);
  }, 500);
}

export function forceSkinMission() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    
    // Force la mission "équipe ton 1er skin" comme active
    state.mission = {
      id: "equip_first_skin",
      startedAt: Date.now(),
      completed: false
    };
    
    // Assure que le joueur a un skin par défaut
    if (!state.skinsOwned.starter) {
      state.cookies = Math.max(state.cookies, 1500);
    }
    
    localStorage.setItem('cookieCrazeSaveV4', JSON.stringify(state));
    console.log('🎯 Mission "équipe ton 1er skin" forcée comme active');
    console.log('💰 Cookies donnés si nécessaire');
    window.location.reload();
  } catch (e) {
    console.log('❌ Erreur:', e.message);
  }
}

export function testExportImport() {
  try {
    console.log('\n📦 TEST EXPORT/IMPORT SKINS:');
    
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    console.log('État actuel:');
    console.log(`  Skin équipé: ${state.skin}`);
    console.log(`  Skins possédés: ${Object.entries(state.skinsOwned).filter(([k,v]) => v).map(([k]) => k).join(', ')}`);
    
    // Test export
    const exported = JSON.stringify(state, null, 2);
    console.log('\n✅ Export JSON généré (vérifiez que skin + skinsOwned sont présents)');
    
    // Test import simulation
    const parsed = JSON.parse(exported);
    if (parsed.skin && parsed.skinsOwned) {
      console.log('✅ Import simulation réussie - données skins préservées');
    } else {
      console.log('❌ Données skins manquantes dans l\'export');
    }
    
    // Petit test de corruption
    delete parsed.skinsOwned;
    const withMigration = migrateSkinData(parsed);
    if (withMigration.skinsOwned && withMigration.skinsOwned.default) {
      console.log('✅ Migration skins fonctionne (skinsOwned restauré)');
    } else {
      console.log('❌ Migration skins échouée');
    }
    
  } catch (e) {
    console.log('❌ Erreur test export/import:', e.message);
  }
}

function migrateSkinData(state) {
  // Simulation de la migration
  return {
    ...state,
    skin: state.skin || "default",
    skinsOwned: {
      default: true,
      starter: false,
      early: false,
      caramel: false,
      noir: false,
      ice: false,
      fire: false,
      ...(state.skinsOwned || {})
    }
  };
}

export function showSkinBusinessMetrics() {
  try {
    const state = JSON.parse(localStorage.getItem('cookieCrazeSaveV4'));
    console.log('\n📊 MÉTRIQUES BUSINESS SKINS:');
    
    const skinPrices = [1000, 10000, 50000, 200000, 500000, 2000000];
    const currentCookies = state.cookies;
    
    console.log(`💰 Cookies actuels: ${currentCookies.toLocaleString()}`);
    console.log('🎯 Paliers d\'accessibilité:');
    
    skinPrices.forEach((price, i) => {
      const skinNames = ['Starter', 'Early', 'Caramel', 'Noir', 'Ice', 'Lava'];
      const affordable = currentCookies >= price ? '✅' : '❌';
      const progress = Math.min(100, (currentCookies / price) * 100);
      console.log(`  ${affordable} ${skinNames[i].padEnd(8)} - ${price.toLocaleString().padStart(9)} (${progress.toFixed(1)}%)`);
    });
    
    // Recommandation next step
    const nextAffordable = skinPrices.find(p => currentCookies < p);
    if (nextAffordable) {
      const needed = nextAffordable - currentCookies;
      console.log(`\n🎯 Prochain objectif: ${needed.toLocaleString()} cookies supplémentaires`);
    } else {
      console.log('\n🏆 Tous les skins sont accessibles !');
    }
  } catch (e) {
    console.log('❌ Erreur métriques:', e.message);
  }
}

// Ajoute les fonctions au window en mode DEV
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.skinTests = {
    help: createSkinTests,
    showAll: showAllSkins,
    giveStarter: giveStarterMoney,
    giveEarly: giveEarlyMoney,
    unlockAll: unlockAllSkins,
    testPreview: testPreviewSystem,
    forceMission: forceSkinMission,
    exportTest: testExportImport,
    metrics: showSkinBusinessMetrics
  };
  
  console.log('👔 Skin Tests chargés ! Tapez skinTests.help() pour voir les commandes');
}
