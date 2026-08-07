// === Le Classement ===
//
// Le défaut qu'il corrige tient en une phrase du joueur: « on ne comprend
// toujours pas l'intérêt de cliquer, il n'y a pas de réel gain au bout ». Le
// jeu affichait bien que cliquer multiplie la production par 2,6 — mais un
// multiplicateur est une information, pas une raison.
//
// Ce que ces tests verrouillent, dans l'ordre d'importance:
//
//   1. le classement est un ESCALIER: chaque rival devant le précédent, à tous
//      les temps de jeu. Un croisement ferait bouger le rang du joueur sans
//      qu'il ait joué, et c'est la seule chose qu'un classement ne peut pas se
//      permettre;
//   2. RENAÎTRE NE FAIT PAS RECULER. La renaissance vide `lifetime`: sans
//      cumul, un joueur perdrait toutes ses places au moment précis où le jeu
//      lui demande de tout recommencer;
//   3. une prime de dépassement se paie UNE FOIS, et jamais pour un rival déjà
//      devancé au chargement.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { CLICS_PREMIERE_ETAPE, PRIX_PREMIER_ACHAT, ETAPES } from "../data/guide.js";
import { play } from "../sim/engine.js";
import { buildContext, tickQuests } from "../quests/engine.js";
import CookieCraze from "../components/CookieCraze.jsx";
import {
  SAVE_KEY,
  STATE_VERSION,
  LEGACY_KEYS,
  createFreshState,
  createResetState,
  couchesConservees,
  cumulerVie,
  cookiesAVie,
  tempsDeJeuAVie,
  migrate,
} from "../utils/state.js";
import {
  RIVAUX,
  PALIERS_MS,
  scoreRival,
  classement,
  positionDuJoueur,
  rivauxDevances,
  rubanVisible,
  primeDepassement,
  AVANCE_MS,
} from "../data/rivaux.js";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MIN = 60e3;
const H = 3600e3;
const J = 24 * H;

const neuf = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  s.ui.sounds = false;
  // Partie quittée à l'instant: sans ça, `lastTs` à zéro fait croire au jeu que
  // le joueur revient après cinquante-cinq ans et le rapport hors-ligne verse
  // un million de cookies au démarrage — de quoi doubler les sept rivaux avant
  // le premier tic, et rendre toute mesure de dépassement illisible.
  s.lastTs = Date.now();
  mutate(s);
  return s;
};

/** Un joueur avec `cookies` cuits à vie et `ms` de jeu à vie. */
const joueur = (cookies, ms) =>
  neuf((s) => {
    s.lifetime = cookies;
    s.stats.playtimeMs = ms;
  });

const demarrer = async (etat) => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(etat));
  const utils = render(<CookieCraze />);
  await act(async () => {});
  return utils;
};

// ===========================================================================

describe("l'escalier des rivaux", () => {
  it("range les sept du plus lent au plus rapide", () => {
    const cadences = RIVAUX.map((r) => r.cadence);
    expect([...cadences].sort((a, b) => a - b)).toEqual(cadences);
  });

  it("ne les sépare QUE par la cadence de clic", () => {
    // C'est tout le propos: dépasser quelqu'un, c'est appuyer plus que lui.
    // Si un rival gagnait aussi un bonus de départ ou un autre catalogue, le
    // classement ne dirait plus rien du geste du joueur.
    for (const r of RIVAUX) {
      expect(r.cadence, r.id).toBeGreaterThan(0);
      expect(Object.keys(r).sort()).toEqual(["cadence", "crmb", "icone", "id", "nom", "phrase"]);
    }
  });

  it("garde chaque rival devant le précédent, à TOUS les temps de jeu", () => {
    // L'invariant qui casse en silence: rejouer `scripts/rivaux.mjs` après un
    // rééquilibrage des prix peut faire se croiser deux courbes, et le rang du
    // joueur se mettrait alors à bouger tout seul.
    const instants = [
      1e3, 10e3, 30e3, MIN, 3 * MIN, 10 * MIN, 30 * MIN, H, 3 * H, 12 * H, J, 3 * J, 7 * J, 30 * J, 120 * J,
    ];
    for (const t of instants) {
      for (let i = 1; i < RIVAUX.length; i++) {
        const bas = scoreRival(RIVAUX[i - 1].id, t);
        const haut = scoreRival(RIVAUX[i].id, t);
        expect(haut, `${RIVAUX[i].id} vs ${RIVAUX[i - 1].id} à ${t} ms`).toBeGreaterThan(bas);
      }
    }
  });

  it("fait monter chaque rival sans jamais le faire redescendre", () => {
    for (const r of RIVAUX) {
      let precedent = -1;
      for (let t = 0; t <= 40 * J; t += 7 * MIN) {
        const v = scoreRival(r.id, t);
        expect(v, `${r.id} à ${t}`).toBeGreaterThanOrEqual(precedent);
        precedent = v;
      }
    }
  });

  it("interpole en géométrique entre deux relevés, pas en droite", () => {
    // Sur un segment qui va de dix millions à quatre-vingts millions, la
    // droite passerait par quarante-cinq millions à mi-parcours là où le jeu
    // en produit vingt-huit: le classement sauterait à chaque palier franchi.
    // En temps JOUEUR: la montre des rivaux avance de `AVANCE_MS`.
    const i = 12;
    const [ta, tb] = [PALIERS_MS[i] - AVANCE_MS, PALIERS_MS[i + 1] - AVANCE_MS];
    for (const r of RIVAUX) {
      const va = scoreRival(r.id, ta);
      const vb = scoreRival(r.id, tb);
      const milieu = scoreRival(r.id, (ta + tb) / 2);
      expect(milieu / Math.sqrt(va * vb), r.id).toBeCloseTo(1, 6);
    }
  });

  it("prolonge la courbe au-delà du dernier relevé, sans jamais partir à l'infini", () => {
    const dernier = PALIERS_MS[PALIERS_MS.length - 1];
    for (const r of RIVAUX) {
      const fin = scoreRival(r.id, dernier);
      const bienApres = scoreRival(r.id, 10 * dernier);
      expect(bienApres).toBeGreaterThan(fin);
      expect(Number.isFinite(bienApres), r.id).toBe(true);
    }
  });

  it("part avec huit minutes d'avance, pour les cadeaux de bienvenue du joueur", () => {
    // Mesuré en navigateur sans cette avance: un débutant à trois clics par
    // seconde qui suit le Guide passait PREMIER sur huit au bout de
    // quarante-neuf secondes — devant un adversaire simulé à douze clics par
    // seconde. Les primes du Guide, les premiers succès et les premières
    // quêtes ne sont pas dans les courbes, et elles font toute la partie
    // pendant le premier quart d'heure.
    // À l'instant zéro du joueur, les rivaux en sont déjà à leur huitième
    // minute: l'échelle est peuplée d'entrée.
    for (const r of RIVAUX) {
      expect(scoreRival(r.id, 0), r.id).toBeGreaterThan(0);
      expect(scoreRival(r.id, 12 * MIN)).toBe(scoreRival(r.id, 12 * MIN - AVANCE_MS + AVANCE_MS));
    }

    // Et l'avance a la bonne ALLURE: un handicap énorme pendant le premier
    // quart d'heure — quand les cadeaux font toute la partie — et presque rien
    // au bout d'une journée, quand ils ne pèsent plus rien. Mesuré: ×4,9 à dix
    // minutes, ×1,02 à vingt-quatre heures.
    const avance = (id, t) => scoreRival(id, t) / scoreRival(id, Math.max(0, t - AVANCE_MS));
    for (const r of RIVAUX) {
      expect(avance(r.id, 10 * MIN), r.id).toBeGreaterThan(4);
      expect(avance(r.id, 24 * H), r.id).toBeLessThan(1.05);
    }

    // Et un joueur qui vient d'ouvrir le jeu est bien dernier.
    expect(positionDuJoueur(neuf()).rang).toBe(RIVAUX.length + 1);
  });

  it("colle à ce que le simulateur du jeu produit vraiment", () => {
    // La table est GÉNÉRÉE, et une table générée dérive en silence: on change
    // un prix, on oublie de rejouer `scripts/rivaux.mjs`, et les rivaux
    // décrivent un jeu qui n'existe plus. Ce test rejoue quelques parties et
    // compare. La tolérance couvre l'arrondi à quatre chiffres significatifs
    // et les deux valeurs que le script relève de 5 % pour tenir l'escalier.
    for (const r of [RIVAUX[1], RIVAUX[4]]) {
      for (const t of [12 * MIN, 30 * MIN, 3 * H]) {
        const reel = play({
          clicksPerSecond: r.cadence,
          strategy: "optimiser",
          durationMs: t,
          prestige: true,
          ascension: true,
        }).produitTotal;
        // `scoreRival` lit la montre du joueur, qui retarde de `AVANCE_MS` sur
        // celle des rivaux: on la remet à l'heure pour comparer.
        const lu = scoreRival(r.id, t - AVANCE_MS);
        expect(Math.abs(lu / reel - 1), `${r.id} à ${t} ms : ${lu} vs ${reel}`).toBeLessThan(0.06);
      }
    }
  }, 30000);

  it("répond zéro pour un rival qui n'existe pas, plutôt que NaN", () => {
    expect(scoreRival("personne", H)).toBe(0);
    expect(scoreRival("flocon", NaN)).toBe(0);
    expect(scoreRival("flocon", -5)).toBe(0);
  });
});

describe("la place du joueur", () => {
  it("le met dernier tant qu'il n'a rien cuit", () => {
    const p = positionDuJoueur(neuf());
    expect(p.rang).toBe(RIVAUX.length + 1);
    expect(p.devant.id).toBe("flocon");
  });

  it("le fait monter d'un cran par rival dépassé", () => {
    const t = 10 * MIN;
    // Juste au-dessus de chaque rival, l'un après l'autre.
    for (let i = 0; i < RIVAUX.length; i++) {
      const s = joueur(scoreRival(RIVAUX[i].id, t) * 1.01, t);
      expect(positionDuJoueur(s).rang, RIVAUX[i].id).toBe(RIVAUX.length - i);
    }
  });

  it("le déclare premier quand il devance la machine", () => {
    const t = 10 * MIN;
    const s = joueur(scoreRival("crumb9000", t) * 2, t);
    const p = positionDuJoueur(s);
    expect(p.rang).toBe(1);
    expect(p.devant).toBeNull();
    expect(p.part).toBe(1);
  });

  it("mesure l'écart au suivant en fraction lisible, toujours entre 0 et 1", () => {
    for (const t of [MIN, H, J, 20 * J]) {
      for (const f of [0, 0.3, 0.9, 1.5, 40]) {
        const s = joueur(scoreRival("iris", t) * f, t);
        const p = positionDuJoueur(s);
        expect(p.part).toBeGreaterThanOrEqual(0);
        expect(p.part).toBeLessThanOrEqual(1);
      }
    }
  });

  it("compte le joueur DERRIÈRE à égalité stricte", () => {
    // Se voir premier sans avoir rien fait ferait du classement une décoration
    // dès la première seconde.
    const t = 5 * MIN;
    const s = joueur(scoreRival("flocon", t), t);
    expect(positionDuJoueur(s).rang).toBe(RIVAUX.length + 1);
  });

  it("liste exactement les rivaux devancés", () => {
    const t = 10 * MIN;
    const s = joueur(scoreRival("tarek", t) * 1.01, t);
    expect(rivauxDevances(s).map((r) => r.id)).toEqual(["flocon", "nino", "salome", "tarek"]);
  });

  it("ne sacre pas le débutant champion en trente clics, mais met Flocon à portée", () => {
    // Vingt-cinq clics et la prime qui les accompagne, c'est tout ce qu'un
    // débutant a au bout d'une demi-minute. Il est dernier, et c'est la seule
    // place honnête: la course ne se gagne pas avec un cadeau de bienvenue.
    const s = joueur(CLICS_PREMIERE_ETAPE + PRIX_PREMIER_ACHAT, 25e3);
    expect(positionDuJoueur(s).rang).toBe(RIVAUX.length + 1);

    // Flocon, lui, doit rester le premier objectif ATTEIGNABLE: de l'ordre de
    // ce que le Guide verse sur ses sept étapes. Au-delà, le débutant resterait
    // dernier assez longtemps pour ne jamais voir le classement.
    const primes = ETAPES.reduce((n, e) => n + e.recompense, 0);
    expect(scoreRival("flocon", 0)).toBeLessThan(5 * primes);
    // Mesuré en navigateur: premier dépassement autour de la cinquantième
    // seconde, deuxième vers deux minutes trente.
    expect(scoreRival("flocon", 50e3)).toBeLessThan(18_824);
    expect(scoreRival("nino", 50e3)).toBeGreaterThan(18_824);
  });

  it("n'affiche le ruban qu'une fois le premier rival dépassé", () => {
    expect(rubanVisible(neuf())).toBe(false);
    expect(rubanVisible(neuf((s) => (s.classement.battus.flocon = true)))).toBe(true);
  });
});

describe("les compteurs à vie qui portent le classement", () => {
  it("additionnent la partie en cours et les parties passées", () => {
    const s = neuf((x) => {
      x.lifetime = 300;
      x.stats.playtimeMs = 5 * MIN;
      x.lifetimeStats.cookiesAvant = 1000;
      x.lifetimeStats.playtimeAvant = 20 * MIN;
    });
    expect(cookiesAVie(s)).toBe(1300);
    expect(tempsDeJeuAVie(s)).toBe(25 * MIN);
  });

  it("replient la partie qui s'achève au moment où elle s'achève", () => {
    const s = neuf((x) => {
      x.lifetime = 300;
      x.stats.playtimeMs = 5 * MIN;
      x.lifetimeStats.cookiesAvant = 1000;
      x.lifetimeStats.playtimeAvant = 20 * MIN;
    });
    const v = cumulerVie(s);
    expect(v.cookiesAvant).toBe(1300);
    expect(v.playtimeAvant).toBe(25 * MIN);
    // Et les autres compteurs à vie passent intacts.
    expect(v.clicks).toBe(s.lifetimeStats.clicks);
  });

  it("NE FAIT PAS RECULER le joueur au classement quand il renaît", () => {
    // Le cas qui justifie tout ce cumul: la Renaissance remet `lifetime` à
    // zéro. Branché dessus, le classement renverrait le joueur bon dernier au
    // moment précis où le jeu lui demande de tout recommencer — le meilleur
    // moyen de lui faire fermer l'onglet.
    const avant = neuf((s) => {
      s.lifetime = 5e9;
      s.stats.playtimeMs = 3 * H;
      s.classement.battus = { flocon: true, nino: true, salome: true };
    });
    const rangAvant = positionDuJoueur(avant).rang;

    const apres = createResetState({ ...couchesConservees(avant), preservePrestige: true, prestige: avant.prestige });
    expect(apres.lifetime).toBe(0);
    expect(cookiesAVie(apres)).toBe(5e9);
    expect(positionDuJoueur(apres).rang).toBe(rangAvant);
    // Et les trophées suivent le joueur, pas la partie.
    expect(apres.classement.battus).toEqual({ flocon: true, nino: true, salome: true });
  });

  it("garde le temps de jeu à travers la renaissance", () => {
    const avant = neuf((s) => {
      s.stats.playtimeMs = 3 * H;
      s.lifetimeStats.playtimeAvant = 2 * H;
    });
    const apres = createResetState({ ...couchesConservees(avant), preservePrestige: false });
    expect(apres.stats.playtimeMs).toBe(0);
    expect(tempsDeJeuAVie(apres)).toBe(5 * H);
  });

  it("survit à un tic de quêtes", () => {
    // Le défaut trouvé en navigateur, et pas en test: `tickQuests` reconstruit
    // `lifetimeStats` — et le faisait en énumérant les cinq compteurs qu'il
    // connaissait. Chaque tic effaçait donc les deux cumuls du Classement, et
    // le seul symptôme était un joueur renvoyé bon dernier après une
    // renaissance. Un littéral d'objet ne signale jamais un champ absent.
    const s = neuf((x) => {
      x.lifetimeStats.cookiesAvant = 4e9;
      x.lifetimeStats.playtimeAvant = 3 * H;
      x.items = { oven: 20 };
      x.lifetime = 5e5;
    });
    const r = tickQuests(s, buildContext(s), Date.now(), () => 0.5);
    const apres = r.changed ? r.state : s;
    expect(apres.lifetimeStats.cookiesAvant).toBe(4e9);
    expect(apres.lifetimeStats.playtimeAvant).toBe(3 * H);
  });

  it("emporte tout avec « Tout effacer », classement compris", () => {
    const apres = createResetState({ preservePrestige: false });
    expect(cookiesAVie(apres)).toBe(0);
    expect(tempsDeJeuAVie(apres)).toBe(0);
    expect(apres.classement).toEqual({ battus: {} });
  });
});

describe("la migration d'une sauvegarde d'avant le classement", () => {
  it("lit une v7 et la classe sur la partie qu'elle a sous les yeux", () => {
    const migre = migrate({
      version: 7,
      lifetime: 4e6,
      stats: { clicks: 12_000, playtimeMs: 45 * MIN },
      lifetimeStats: { clicks: 50_000 },
    });
    expect(migre.version).toBe(STATE_VERSION);
    expect(migre.migratedFrom).toBe(7);
    expect(migre.classement).toEqual({ battus: {} });
    // Rien d'inventé sur les parties passées: un plancher honnête.
    expect(migre.lifetimeStats.cookiesAvant).toBe(0);
    expect(migre.lifetimeStats.playtimeAvant).toBe(0);
    expect(cookiesAVie(migre)).toBe(4e6);
    expect(tempsDeJeuAVie(migre)).toBe(45 * MIN);
  });

  it("garde la clé de la v7 lisible pour toujours", () => {
    expect(SAVE_KEY).toMatch(/^cookieCrazeSaveV\d+$/);
    expect(LEGACY_KEYS[0]).toBe("cookieCrazeSaveV7");
  });

  it("assainit un `classement` bricolé plutôt que de le recopier", () => {
    expect(migrate({ version: 8, classement: "n'importe quoi" }).classement).toEqual({ battus: {} });
    expect(migrate({ version: 8, classement: { battus: { zoe: true } } }).classement.battus.zoe).toBe(true);
  });

  it("ne recule jamais un cumul déjà écrit", () => {
    const migre = migrate({ version: 8, lifetimeStats: { cookiesAvant: 9e9, playtimeAvant: -5 } });
    expect(migre.lifetimeStats.cookiesAvant).toBe(9e9);
    expect(migre.lifetimeStats.playtimeAvant).toBe(0);
  });
});

describe("la prime de dépassement", () => {
  it("vaut une minute de production, clic compris", () => {
    expect(primeDepassement({ mining: 100, perClickNoCombo: 20 })).toBe(60 * 120);
  });

  it("garde un plancher qui se voit, même sans rien produire", () => {
    expect(primeDepassement({ mining: 0, perClickNoCombo: 0 })).toBe(50);
    expect(primeDepassement(null)).toBe(50);
    expect(primeDepassement({ mining: NaN, perClickNoCombo: undefined })).toBe(50);
  });

  it("monte avec le rang du rival, côté CrumbCoin", () => {
    const crmb = RIVAUX.map((r) => r.crmb);
    expect([...crmb].sort((a, b) => a - b)).toEqual(crmb);
    expect(crmb[0]).toBeGreaterThan(0);
  });
});

describe("le classement à l'écran", () => {
  it("reste caché tant que le joueur n'a dépassé personne", async () => {
    await demarrer(neuf());
    expect(screen.queryByTestId("ruban-classement")).toBeNull();
  });

  it("apparaît, avec la place et celui qui est devant", async () => {
    const t = 10 * MIN;
    await demarrer(
      neuf((s) => {
        s.lifetime = scoreRival("salome", t) * 1.01;
        s.stats.playtimeMs = t;
        s.classement.battus = { flocon: true, nino: true, salome: true };
      })
    );
    const ruban = screen.getByTestId("ruban-classement");
    // Trois rivaux derrière lui sur sept: cinquième sur huit.
    expect(ruban.getAttribute("data-rang")).toBe("5");
    expect(ruban.textContent).toMatch(/Tarek est devant/);
  });

  it("verse la prime du dépassement aux premiers appuis qui font passer devant", async () => {
    const t = 10 * MIN;
    // Cinq cents Mamies: cinq cents cookies par appui, AUCUN minage. Rien ne
    // bouge donc à l'écran tant que le joueur ne touche pas au cookie — et
    // quelques appuis suffisent à combler ce qui le sépare de Flocon.
    const etat = neuf((s) => {
      s.lifetime = scoreRival("flocon", t) * 0.999;
      s.cookies = 0;
      s.stats.playtimeMs = t;
      s.items = { grandma: 500 };
      // Les succès sont déjà tous décrochés: leurs primes fausseraient la
      // mesure en versant des cookies au démarrage.
      s.unlocked = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 1]));
    });
    await demarrer(etat);
    expect(screen.queryByTestId("ruban-classement")).toBeNull();
    const crmbAvant = screen.getByTestId("solde-crmb").textContent;

    await act(async () => {
      for (let i = 0; i < 5; i++) fireEvent.click(screen.getByLabelText(/Cliquer le cookie/i));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1300));
    });

    const ruban = screen.getByTestId("ruban-classement");
    // Il a doublé quelqu'un: il n'est plus dernier.
    expect(Number(ruban.getAttribute("data-rang"))).toBeLessThan(RIVAUX.length + 1);
    // Et la prime en CrumbCoin est versée.
    expect(screen.getByTestId("solde-crmb").textContent).not.toBe(crmbAvant);
  }, 20000);

  it("ne verse RIEN à un joueur qui devançait déjà tout le monde au chargement", async () => {
    // Sinon, ouvrir la nouvelle version verserait les sept primes d'un coup à
    // quelqu'un qui n'a rien dépassé devant nous.
    const t = 10 * MIN;
    const etat = neuf((s) => {
      s.lifetime = scoreRival("crumb9000", t) * 4;
      s.cookies = 1000;
      s.stats.playtimeMs = t;
    });
    await demarrer(etat);
    const avant = Number(screen.getByTestId("solde").textContent.replace(/\D/g, ""));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 1400));
    });
    const apres = Number(screen.getByTestId("solde").textContent.replace(/\D/g, ""));
    // Aucun minage dans cet état: le solde ne peut bouger que d'une prime.
    expect(apres).toBe(avant);
    // Les sept sont pourtant bien verrouillés comme dépassés.
    expect(screen.getByTestId("ruban-classement").getAttribute("data-rang")).toBe("1");
  }, 15000);
});

describe("le tableau complet", () => {
  it("classe les huit lignes, joueur compris, sans doublon de rang", () => {
    const t = 2 * H;
    const l = classement(joueur(scoreRival("tarek", t) * 1.2, t));
    expect(l.length).toBe(RIVAUX.length + 1);
    expect(l.map((x) => x.rang)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(l.filter((x) => x.moi).length).toBe(1);
    for (let i = 1; i < l.length; i++) expect(l[i].score).toBeLessThanOrEqual(l[i - 1].score);
  });

  it("dit à l'écran que les rivaux ne sont pas des joueurs en ligne", async () => {
    // Un classement rempli par le navigateur de chacun se truque en dix
    // secondes. Le jeu préfère le dire que le laisser croire.
    const t = 10 * MIN;
    await demarrer(
      neuf((s) => {
        s.lifetime = scoreRival("nino", t) * 1.01;
        s.stats.playtimeMs = t;
        s.classement.battus = { flocon: true };
      })
    );
    await act(async () => {
      screen.getByTestId("ruban-classement").click();
    });
    const panneau = await screen.findByTestId("panneau-classement");
    expect(panneau.textContent).toMatch(/ne sont pas des joueurs en ligne/i);
    expect(panneau.textContent).toMatch(/cadence/i);
  }, 15000);
});
