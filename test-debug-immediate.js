// TEST IMMÉDIAT - À copier-coller dans la console du jeu

console.log('=== DEBUG MICRO-MISSIONS ===');

// 1. État actuel
const save = JSON.parse(localStorage.getItem('cookie-craze-save'));
console.log('1. État sauvegarde:');
console.log('   Mission:', save.mission);
console.log('   Micro-mission:', save.activeMicroMission);

// 2. Conditions d'affichage
const microMissionsEnabled = true; // Assumé activé
const hasActiveMicroMission = !!save.activeMicroMission;
const noMissionOrCompleted = !save.mission || save.mission.completed;

console.log('2. Conditions d\'affichage:');
console.log('   Feature activée:', microMissionsEnabled);
console.log('   A micro-mission:', hasActiveMicroMission);
console.log('   Mission absente ou terminée:', noMissionOrCompleted);
console.log('   DEVRAIT AFFICHER:', microMissionsEnabled && hasActiveMicroMission && noMissionOrCompleted);

// 3. Test de condition exacte du code
const shouldShow = microMissionsEnabled && save.activeMicroMission && (!save.mission || save.mission.completed);
console.log('3. Condition exacte du code:', shouldShow);

// 4. Si pas de micro-mission, on en force une
if (!save.activeMicroMission) {
    console.log('4. PAS DE MICRO-MISSION - Forçage...');
    save.activeMicroMission = {
        id: "collect_250_gain",
        startedAt: Date.now(),
        progress: 0,
        target: 250,
        meta: { lifetimeAtStart: save.lifetime || 0 }
    };
    localStorage.setItem('cookie-craze-save', JSON.stringify(save));
    console.log('   Micro-mission forcée ! Rechargez la page (F5)');
}

// 5. Si mission pas terminée, on la termine
if (save.mission && !save.mission.completed) {
    console.log('5. MISSION NON TERMINÉE - Forçage completion...');
    save.mission.completed = true;
    localStorage.setItem('cookie-craze-save', JSON.stringify(save));
    console.log('   Mission marquée terminée ! Rechargez la page (F5)');
}
