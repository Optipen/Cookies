// Test utilitaire pour la navigation par onglets

export function createTabsTests() {
  console.log('📑 TABS TESTS - Navigation fixe et responsive');
  console.log('Commandes disponibles:');
  console.log('1. tabsTests.testKeyboard() - Test raccourcis clavier');
  console.log('2. tabsTests.testMobile() - Simulation mobile responsive');
  console.log('3. tabsTests.testAccessibility() - Vérifications a11y');
  console.log('4. tabsTests.showShortcuts() - Liste des raccourcis');
  console.log('5. tabsTests.cycleAll() - Cycle automatique tous onglets');
}

export function testKeyboardShortcuts() {
  console.log('\n⌨️ TEST RACCOURCIS CLAVIER:');
  console.log('Raccourcis disponibles:');
  console.log('  • Ctrl/Cmd + 1 → Boutique');
  console.log('  • Ctrl/Cmd + 2 → Auto');  
  console.log('  • Ctrl/Cmd + 3 → Améliorations');
  console.log('  • Ctrl/Cmd + 4 → Skins');
  console.log('  • Escape → Fermer menu');
  
  console.log('\n🧪 Test automatique raccourcis:');
  
  // Simule les raccourcis clavier
  const shortcuts = [
    { key: '1', name: 'Boutique' },
    { key: '2', name: 'Auto' },
    { key: '3', name: 'Améliorations' },
    { key: '4', name: 'Skins' }
  ];
  
  shortcuts.forEach((shortcut, i) => {
    setTimeout(() => {
      const event = new KeyboardEvent('keydown', {
        key: shortcut.key,
        ctrlKey: true,
        bubbles: true
      });
      
      window.dispatchEvent(event);
      console.log(`  → ${shortcut.name} activé (Ctrl+${shortcut.key})`);
    }, i * 800);
  });
}

export function testMobileResponsive() {
  console.log('\n📱 TEST MOBILE RESPONSIVE:');
  
  // Simule un écran mobile
  console.log('Simulation écran mobile (375px width):');
  console.log('1. Vérifiez que les onglets scrollent horizontalement');
  console.log('2. Les emojis doivent être visibles pour une meilleure UX');
  console.log('3. Le scroll snapping doit fonctionner');
  console.log('4. Pas de scrollbar visible');
  
  // Test de scrolling automatique
  const tabsContainer = document.querySelector('[role="tablist"] > div');
  if (tabsContainer) {
    console.log('\n🔄 Test scroll automatique:');
    tabsContainer.scrollTo({ left: 0, behavior: 'smooth' });
    
    setTimeout(() => {
      tabsContainer.scrollTo({ left: tabsContainer.scrollWidth, behavior: 'smooth' });
      console.log('  → Scroll vers la droite');
    }, 500);
    
    setTimeout(() => {
      tabsContainer.scrollTo({ left: 0, behavior: 'smooth' });
      console.log('  → Retour au début');
    }, 1500);
  } else {
    console.log('❌ Container d\'onglets non trouvé');
  }
}

export function testAccessibility() {
  console.log('\n♿ TEST ACCESSIBILITÉ:');
  
  const tablist = document.querySelector('[role="tablist"]');
  const tabs = document.querySelectorAll('[role="tab"]');
  
  if (tablist) {
    console.log('✅ role="tablist" présent');
    console.log(`✅ aria-label: "${tablist.getAttribute('aria-label')}"`);
  } else {
    console.log('❌ role="tablist" manquant');
  }
  
  if (tabs.length > 0) {
    console.log(`✅ ${tabs.length} onglets trouvés`);
    
    tabs.forEach((tab, i) => {
      const ariaSelected = tab.getAttribute('aria-selected');
      const hasRole = tab.getAttribute('role') === 'tab';
      const hasFocus = tab.className.includes('focus:ring');
      
      console.log(`  Onglet ${i + 1}:`);
      console.log(`    • role="tab": ${hasRole ? '✅' : '❌'}`);
      console.log(`    • aria-selected: ${ariaSelected === 'true' ? '✅ true' : ariaSelected === 'false' ? '⚪ false' : '❌ manquant'}`);
      console.log(`    • focus visible: ${hasFocus ? '✅' : '❌'}`);
    });
  } else {
    console.log('❌ Aucun onglet trouvé');
  }
  
  // Test navigation avec Tab
  console.log('\n🔍 Test navigation Tab:');
  console.log('Testez manuellement:');
  console.log('1. Appuyez Tab pour atteindre les onglets');
  console.log('2. Utilisez les flèches gauche/droite pour naviguer');
  console.log('3. Appuyez Entrée/Espace pour activer');
  console.log('4. Le focus doit être visible (ring cyan)');
}

export function showShortcuts() {
  console.log('\n⌨️ RACCOURCIS CLAVIER DISPONIBLES:');
  console.log('┌─────────────────┬──────────────────┐');
  console.log('│ Raccourci       │ Action           │');
  console.log('├─────────────────┼──────────────────┤');
  console.log('│ Ctrl/Cmd + 1   │ 🛍️  Boutique      │');
  console.log('│ Ctrl/Cmd + 2   │ ⚙️  Auto          │');
  console.log('│ Ctrl/Cmd + 3   │ ⬆️  Améliorations │');
  console.log('│ Ctrl/Cmd + 4   │ 👔 Skins         │');
  console.log('│ Escape          │ Fermer menu      │');
  console.log('└─────────────────┴──────────────────┘');
}

export function cycleAllTabs() {
  console.log('\n🔄 CYCLE AUTOMATIQUE ONGLETS:');
  
  const tabs = ['shop', 'auto', 'upgrades', 'skins'];
  
  tabs.forEach((tabId, i) => {
    setTimeout(() => {
      // Simule clic sur l'onglet
      const tabButton = Array.from(document.querySelectorAll('[role="tab"]'))
        .find(btn => btn.textContent.toLowerCase().includes(
          tabId === 'shop' ? 'boutique' : 
          tabId === 'auto' ? 'auto' : 
          tabId === 'upgrades' ? 'améliorations' : 
          'skins'
        ));
      
      if (tabButton) {
        tabButton.click();
        console.log(`  → ${tabId.toUpperCase()} activé`);
      }
    }, i * 1000);
  });
  
  setTimeout(() => {
    console.log('✅ Cycle terminé - retour à Boutique');
    const shopTab = Array.from(document.querySelectorAll('[role="tab"]'))
      .find(btn => btn.textContent.toLowerCase().includes('boutique'));
    if (shopTab) shopTab.click();
  }, tabs.length * 1000);
}

export function checkStickyPosition() {
  console.log('\n📌 TEST POSITION STICKY:');
  
  const tabsBar = document.querySelector('[role="tablist"]');
  if (tabsBar) {
    const rect = tabsBar.getBoundingClientRect();
    const styles = window.getComputedStyle(tabsBar);
    
    console.log('État actuel de la barre d\'onglets:');
    console.log(`  • Position: ${styles.position}`);
    console.log(`  • Top: ${styles.top}`);
    console.log(`  • Z-index: ${styles.zIndex}`);
    console.log(`  • Distance du top: ${rect.top}px`);
    
    if (styles.position === 'sticky') {
      console.log('✅ Position sticky active');
    } else {
      console.log('❌ Position sticky manquante');
    }
    
    if (styles.zIndex >= 10) {
      console.log('✅ Z-index suffisant pour rester au-dessus');
    } else {
      console.log('⚠️ Z-index peut être insuffisant');
    }
  } else {
    console.log('❌ Barre d\'onglets non trouvée');
  }
}

// Ajoute les fonctions au window en mode DEV
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.tabsTests = {
    help: createTabsTests,
    testKeyboard: testKeyboardShortcuts,
    testMobile: testMobileResponsive,
    testAccessibility: testAccessibility,
    shortcuts: showShortcuts,
    cycleAll: cycleAllTabs,
    checkSticky: checkStickyPosition
  };
  
  console.log('📑 Tabs Tests chargés ! Tapez tabsTests.help() pour voir les commandes');
}
