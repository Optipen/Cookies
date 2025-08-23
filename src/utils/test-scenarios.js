// Utilitaires pour tester les différents scénarios de boot en DEV
import { SAVE_KEY, createIncompleteSave, createCorruptedSave } from './state.js';

export function testScenarios() {
  console.log('🔧 Tests de migration Cookie Craze disponibles:');
  console.log('1. testFreshBoot() - Supprime la save et recharge');
  console.log('2. testIncompleteSave() - Charge une save ancienne incomplète');
  console.log('3. testCorruptedSave() - Charge une save corrompue');
  console.log('4. getCurrentSaveInfo() - Affiche les infos de la save actuelle');
}

export function testFreshBoot() {
  console.log('🧹 Test Fresh Boot: suppression de la sauvegarde...');
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem("cookieCrazeSaveV3");
    localStorage.removeItem("cookieCrazeSaveV2");
    localStorage.removeItem("cookieCrazeSaveV1");
    console.log('✅ Sauvegarde supprimée, rechargement...');
    window.location.reload();
  } catch (error) {
    console.error('❌ Erreur lors du fresh boot:', error);
  }
}

export function testIncompleteSave() {
  console.log('📝 Test Sauvegarde Incomplète: création d\'une save v2...');
  try {
    const incompleteSave = createIncompleteSave();
    console.log('   Save incomplète créée:', incompleteSave);
    localStorage.setItem(SAVE_KEY, JSON.stringify(incompleteSave));
    console.log('✅ Save incomplète chargée, rechargement...');
    window.location.reload();
  } catch (error) {
    console.error('❌ Erreur lors du test de migration:', error);
  }
}

export function testCorruptedSave() {
  console.log('💥 Test Sauvegarde Corrompue: corruption de la save...');
  try {
    const corruptedSave = createCorruptedSave();
    console.log('   Save corrompue créée:', corruptedSave);
    localStorage.setItem(SAVE_KEY, corruptedSave);
    console.log('✅ Save corrompue chargée, rechargement...');
    window.location.reload();
  } catch (error) {
    console.error('❌ Erreur lors du test de corruption:', error);
  }
}

export function getCurrentSaveInfo() {
  console.log('ℹ️  Informations de la sauvegarde actuelle:');
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      console.log('   Aucune sauvegarde trouvée (fresh boot)');
      return;
    }
    
    const save = JSON.parse(raw);
    console.log(`   Version: ${save.version || 'inconnue'}`);
    console.log(`   Cookies: ${save.cookies || 0}`);
    console.log(`   Items: ${Object.keys(save.items || {}).length} types`);
    console.log(`   Créé le: ${save.createdAt ? new Date(save.createdAt).toLocaleString() : 'inconnu'}`);
    console.log(`   Mission: ${save.mission?.id || 'null'}`);
    console.log(`   Micro-mission: ${save.activeMicroMission?.id || 'null'}`);
    console.log(`   Skins possédés: ${Object.keys(save.skinsOwned || {}).length}`);
    console.log(`   UI sounds: ${save.ui?.sounds ?? 'undefined'}`);
  } catch (error) {
    console.error('   Erreur lors de la lecture de la save:', error);
  }
}

// Ajoute les fonctions au window en mode DEV pour accès console
if (import.meta?.env?.DEV || new URLSearchParams(window.location.search).get('dev') === '1') {
  window.cookieCrazeTests = {
    help: testScenarios,
    freshBoot: testFreshBoot,
    incompleteSave: testIncompleteSave,
    corruptedSave: testCorruptedSave,
    saveInfo: getCurrentSaveInfo
  };
  
  console.log('🎮 Cookie Craze Dev Tools chargés ! Tapez cookieCrazeTests.help() pour voir les commandes');
}
