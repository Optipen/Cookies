// Génère la table des rivaux du Classement.
//
// Chaque rival est une VRAIE partie jouée par le simulateur du jeu — mêmes
// formules de prix, mêmes paliers, mêmes renaissances. On relève sa production
// cumulée à une série de temps de jeu, et c'est cette table qui est recopiée
// dans `src/data/rivaux.js`.
//
// Pourquoi une table figée plutôt qu'une simulation à l'exécution: faire jouer
// six parties d'un mois dans le navigateur du joueur prendrait des secondes et
// bloquerait l'écran. La table, elle, se lit en un coup.
//
// Usage: npx vite-node scripts/rivaux.mjs
import { play } from "../src/sim/engine.js";

const MIN = 60e3;
const H = 3600e3;
const J = 24 * H;

// Temps de JEU (pas de temps réel): la table se lit avec la montre du joueur,
// pas avec le calendrier. Resserrée là où tout se passe — les vingt premières
// minutes — et espacée ensuite.
const PALIERS = [
  0.5 * MIN, 1 * MIN, 2 * MIN, 3 * MIN, 5 * MIN, 8 * MIN, 12 * MIN, 20 * MIN, 30 * MIN, 45 * MIN,
  1 * H, 1.5 * H, 2 * H, 3 * H, 5 * H, 8 * H, 12 * H, 18 * H,
  1 * J, 1.5 * J, 2 * J, 3 * J, 5 * J, 7 * J, 10 * J, 14 * J, 21 * J, 30 * J,
];

// UNE SEULE stratégie d'achat pour tout le monde, et c'est le point:
// les rivaux ne diffèrent QUE par la cadence de clic. L'échelle du classement
// est donc exactement l'échelle « qui appuie le plus », ce qui est la réponse
// à la seule question que le jeu ne répondait pas: à quoi sert de cliquer.
//
// Deux stratégies différentes se croiseraient en cours de route (mesuré: le
// profil « mauvaise » à 0,5 c/s dépasse « gourmand » à 1 c/s entre la
// cinquième et la vingtième minute) et le classement se mettrait à sauter
// tout seul, sans que le joueur ait rien fait.
const STRATEGIE = "optimiser";
const PROFILS = [
  ["flocon", 0.25],
  ["nino", 1],
  ["salome", 2],
  ["tarek", 3.5],
  ["iris", 5.5],
  ["zoe", 8],
  ["crumb9000", 12],
];

const lignes = [];
for (const [id, cps] of PROFILS) {
  const serie = [];
  for (const ms of PALIERS) {
    // SANS la couche d'événements, et c'est mesuré.
    //
    // On l'a essayée: elle décrit les quêtes et les succès par leur moteur
    // réel, mais les dorés et la pluie par leur ESPÉRANCE mathématique — une
    // borne haute, pas un joueur. Relevé à la cinquième minute, Flocon passait
    // de 3 385 à 1 500 000 cookies: quatre cent quarante fois plus. Des rivaux
    // taillés là-dessus sont hors de portée d'un humain, et un classement
    // qu'on ne rattrape jamais ne motive personne.
    //
    // Le socle mécanique — bâtiments, paliers, renaissances — est celui que le
    // simulateur reproduit exactement, et c'est celui qui domine dès qu'on
    // sort des premières minutes. Le trou du tout début (les cadeaux ponctuels
    // que le jeu verse à un débutant) est traité côté lecture, par le plancher
    // de `scoreRival`, et non en gonflant les rivaux.
    const r = play({ clicksPerSecond: cps, strategy: STRATEGIE, durationMs: ms, prestige: true, ascension: true });
    serie.push(r.produitTotal);
  }
  // Monotone par construction du jeu, mais une renaissance juste avant la borne
  // peut faire relever un total légèrement inférieur au précédent: on lisse.
  for (let i = 1; i < serie.length; i++) serie[i] = Math.max(serie[i], serie[i - 1]);
  lignes.push([id, cps, STRATEGIE, serie]);
  console.log(
    `${id.padEnd(11)} ${String(cps).padStart(5)} c/s ` + serie.map((v) => v.toExponential(1)).join(" ")
  );
}

// Le classement doit être un ESCALIER: chaque rival au-dessus du précédent à
// tous les paliers. Les achats sont discrets — un Portail acheté une minute
// plus tôt suffit à faire passer momentanément un rival devant son aîné — et
// un croisement ferait bouger le classement sans que le joueur ait joué.
let corrections = 0;
for (let i = 1; i < lignes.length; i++) {
  const bas = lignes[i - 1][3];
  const haut = lignes[i][3];
  for (let k = 0; k < haut.length; k++) {
    const plancher = bas[k] * 1.05;
    if (haut[k] < plancher) {
      corrections++;
      haut[k] = plancher;
    }
  }
}
console.log(`\n${corrections} valeur(s) relevée(s) pour garder l'escalier strict.`);

const arrondi = (v) => Number(v.toPrecision(4));

console.log("\n// --- à recopier dans src/data/rivaux.js ---");
console.log("export const PALIERS_MS = [");
console.log("  " + PALIERS.map((v) => String(v)).join(", "));
console.log("];\n");
for (const [id, , , serie] of lignes) {
  console.log(`  ${id}: [${serie.map(arrondi).join(", ")}],`);
}

console.log("\n// --- lecture humaine: qui est devant qui, et quand ---");
for (const ms of [1 * MIN, 5 * MIN, 20 * MIN, 1 * H, 5 * H, 1 * J, 7 * J, 30 * J]) {
  const i = PALIERS.indexOf(ms);
  const nom = ms >= J ? `${ms / J} j` : ms >= H ? `${ms / H} h` : `${ms / MIN} min`;
  console.log(
    `${nom.padEnd(7)} ` + lignes.map(([id, , , s]) => `${id} ${s[i].toExponential(1)}`).join("  ·  ")
  );
}
