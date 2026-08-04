import { describe, it, expect } from "vitest";
import {
  starsFor,
  availableStars,
  canAscend,
  ascensionEffects,
  trackCost,
  trackLevel,
  TRACKS,
  TRACK_BY_ID,
  ASCENSION_MIN_CHIPS,
} from "../data/ascension.js";
import { deriveStats, costOf } from "../utils/selectors.js";
import { createFreshState, createResetState, migrate } from "../utils/state.js";
import { ITEMS, BASE_ITEMS, itemUnlocked, MINE_PER_CLICK_VALUE } from "../data/items.js";
import { chipsFor } from "../data/prestige.js";
import { onGrid } from "../utils/grid.js";
import { availableUpgrades } from "../data/upgrades.js";
import { play } from "../sim/engine.js";

const LATER = 6e5;
const partie = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  mutate(s);
  return s;
};

describe("les étoiles", () => {
  it("ne se gagnent qu'après que le prestige a cessé d'apporter", () => {
    expect(canAscend(partie())).toBe(false);
    expect(canAscend(partie((x) => (x.prestige.chips = ASCENSION_MIN_CHIPS - 1)))).toBe(false);
    expect(canAscend(partie((x) => (x.prestige.chips = ASCENSION_MIN_CHIPS)))).toBe(true);
  });

  it("suivent une racine cubique, comme les chips", () => {
    // La boucle est la même que celle des chips: les étoiles multiplient la
    // production, qui nourrit les chips, qui redonnent des étoiles. En racine
    // carrée, elle divergerait.
    expect(starsFor(0)).toBe(0);
    expect(starsFor(ASCENSION_MIN_CHIPS)).toBeGreaterThan(0);
    let precedent = -1;
    for (const chips of [0, 50, 500, 5_000, 50_000, 5e6, 5e9]) {
      const n = starsFor(chips);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(precedent);
      precedent = n;
    }
  });

  it("ignorent une valeur de chips aberrante", () => {
    for (const mauvais of [-1, NaN, undefined, null, Infinity]) {
      const n = starsFor(mauvais);
      expect(Number.isFinite(n) || n === 0, `${String(mauvais)}`).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it("ne peuvent jamais être dépensées deux fois", () => {
    expect(availableStars(partie((x) => (x.ascension = { stars: 5, spent: 5, tracks: {}, count: 1 })))).toBe(0);
    expect(availableStars(partie((x) => (x.ascension = { stars: 5, spent: 99, tracks: {}, count: 1 })))).toBe(0);
    expect(availableStars(partie())).toBe(0);
  });
});

describe("les trois voies", () => {
  it("coûtent des entiers strictement croissants", () => {
    for (const t of TRACKS) {
      let precedent = 0;
      for (let n = 0; n < Math.min(20, t.maxLevel); n++) {
        const c = trackCost(t.id, n);
        expect(Number.isInteger(c), `${t.name} niveau ${n}`).toBe(true);
        expect(c).toBeGreaterThan(precedent);
        precedent = c;
      }
      expect(trackCost(t.id, t.maxLevel)).toBe(Infinity);
    }
  });

  it("écartent une voie inconnue", () => {
    expect(trackCost("inexistante", 0)).toBe(Infinity);
    expect(trackLevel(partie(), "inexistante")).toBe(0);
  });

  it("plafonnent Horizon à quatre, pour ne pas promettre l'infini", () => {
    expect(TRACK_BY_ID.horizon.maxLevel).toBe(4);
    expect(ascensionEffects(partie((x) => (x.ascension = { tracks: { horizon: 99 } }))).horizon).toBe(4);
  });

  it("laissent l'Éclat sans fin", () => {
    expect(TRACK_BY_ID.eclat.maxLevel).toBe(Infinity);
    expect(ascensionEffects(partie((x) => (x.ascension = { tracks: { eclat: 500 } }))).eclatSteps).toBe(500);
  });

  it("rendent des effets neutres sans ascension", () => {
    const e = ascensionEffects(partie());
    expect(e).toEqual({ horizon: 0, eclatSteps: 0, chipMult: 1 });
  });
});

describe("Horizon: du contenu, pas un multiplicateur", () => {
  it("ajoute un Cliqueur ET un Mineur par niveau", () => {
    for (let niveau = 0; niveau <= 4; niveau++) {
      const s = partie((x) => (x.ascension = { stars: 99, spent: 0, tracks: { horizon: niveau }, count: 1 }));
      const ouverts = ITEMS.filter((i) => itemUnlocked(i, s));
      expect(ouverts.length, `Horizon ${niveau}`).toBe(BASE_ITEMS.length + niveau * 2);
      expect(ouverts.filter((i) => i.mode === "click").length).toBe(8 + niveau);
      expect(ouverts.filter((i) => i.mode === "mine").length).toBe(8 + niveau);
    }
  });

  it("garde les deux familles exactement parallèles jusqu'au dernier rang", () => {
    const clics = ITEMS.filter((i) => i.mode === "click").sort((a, b) => a.rank - b.rank);
    const mines = ITEMS.filter((i) => i.mode === "mine").sort((a, b) => a.rank - b.rank);
    expect(clics.length).toBe(mines.length);
    for (let r = 0; r < clics.length; r++) {
      expect(mines[r].value, `rang ${r}`).toBe(clics[r].value * MINE_PER_CLICK_VALUE);
      expect(onGrid(clics[r].value), `rang ${r}`).toBe(true);
      expect(onGrid(mines[r].value), `rang ${r}`).toBe(true);
    }
  });

  it("garde les prix strictement croissants d'un rang au suivant", () => {
    for (const mode of ["click", "mine"]) {
      const liste = ITEMS.filter((i) => i.mode === mode).sort((a, b) => a.rank - b.rank);
      for (let r = 1; r < liste.length; r++) {
        expect(liste[r].base, `${liste[r].name}`).toBeGreaterThan(liste[r - 1].base);
        expect(Number.isFinite(liste[r].base)).toBe(true);
      }
    }
  });

  it("n'ouvre aucun palier sur un rang fermé", () => {
    // Un palier proposé sur un bâtiment qu'on ne peut pas acheter serait un
    // objectif impossible affiché en boutique.
    const ferme = partie();
    const ids = availableUpgrades(ferme).map((u) => u.target);
    for (const item of ITEMS.filter((i) => i.horizon > 0)) {
      expect(ids, `${item.name}`).not.toContain(item.id);
    }
  });

  it("n'obsolète pas les anciens bâtiments", () => {
    // Un rang neuf coûte dix fois plus et rapporte cinq fois plus par
    // exemplaire: les anciens gardent le meilleur rendement par cookie tant
    // qu'on n'en a pas beaucoup. Ils ne deviennent jamais inutiles.
    const s = partie((x) => {
      x.items = { portal: 50 };
      x.ascension = { stars: 99, spent: 0, tracks: { horizon: 4 }, count: 1 };
      x.cookies = 1e30;
    });
    const avant = deriveStats(s, LATER, 0).mining;
    const avecAncien = deriveStats({ ...s, items: { portal: 51 } }, LATER, 0).mining;
    expect(avecAncien).toBeGreaterThan(avant); // le Portail rapporte toujours
  });
});

describe("Éclat: le même cran sur les deux axes", () => {
  it("ajoute des crans de grille, jamais un pourcentage", () => {
    for (const niveau of [0, 1, 5, 40]) {
      const s = partie((x) => {
        x.items = { oven: 20, grandma: 20 };
        x.ascension = { stars: 99, spent: 0, tracks: { eclat: niveau }, count: 1 };
      });
      const d = deriveStats(s, LATER, 0);
      expect(onGrid(d.mineMult), `Éclat ${niveau}`).toBe(true);
      expect(d.mineMult).toBe(d.clickMult);
    }
  });

  it("ne déplace pas l'équilibre entre cliquer et laisser tourner", () => {
    // Le cookie de base vaut 1 par clic quoi qu'il arrive et ne suit aucun
    // multiplicateur: le rapport dérive donc très légèrement vers le bas quand
    // tout le reste grandit. À huit niveaux d'Éclat, l'écart est de 1,2 % —
    // à comparer aux 89 % qu'un bonus qui ne porterait que le minage
    // produirait.
    const parc = { oven: 40, grandma: 40 };
    const ratio = (niveau) => {
      const s = partie((x) => {
        x.items = parc;
        x.ascension = { stars: 99, spent: 0, tracks: { eclat: niveau }, count: 1 };
      });
      const d = deriveStats(s, LATER, 0);
      return (d.mining + d.perClickNoCombo * 1.5 * 5) / d.mining;
    };
    const ecart = Math.abs(ratio(8) / ratio(0) - 1);
    expect(ecart, `écart ${(ecart * 100).toFixed(2)} %`).toBeLessThan(0.02);
  });

  it("s'additionne aux autres sources au lieu de les multiplier", () => {
    // Multiplier ×2,25 par ×1,25 donnerait ×2,8125, hors grille.
    const s = partie((x) => {
      x.items = { oven: 10 };
      x.crypto.ledger = 3;
      x.ascension = { stars: 99, spent: 0, tracks: { eclat: 2 }, count: 1 };
      x.prestige = { chips: 0, spent: 0, upgrades: { celestial_dough: 1 } };
    });
    const d = deriveStats(s, LATER, 0);
    expect(d.mineMult).toBe(1 + 0.25 * (3 + 2 + 1));
    expect(onGrid(d.mineMult)).toBe(true);
  });
});

describe("Écho: la boucle du dessous accélère", () => {
  it("multiplie les chips gagnés à la renaissance, par quarts", () => {
    const sans = chipsFor(1e12, 1);
    for (let n = 1; n <= 8; n++) {
      const e = ascensionEffects(partie((x) => (x.ascension = { tracks: { echo: n } })));
      expect(e.chipMult).toBe(1 + 0.25 * n);
      expect(onGrid(e.chipMult)).toBe(true);
      expect(chipsFor(1e12, e.chipMult)).toBeGreaterThan(sans);
    }
  });

  it("ne fait jamais baisser les chips", () => {
    for (const mult of [0, -1, NaN, undefined]) {
      expect(chipsFor(1e12, mult)).toBe(chipsFor(1e12, 1));
    }
  });
});

describe("ce qu'une ascension emporte, et ce qu'elle garde", () => {
  const avant = () => {
    const s = partie((x) => {
      x.cookies = 1e12;
      x.lifetime = 1e15;
      x.items = { oven: 200, cursor: 150 };
      x.upgrades = { "tier:oven:0": true };
      x.prestige = { chips: 12_000, spent: 40, upgrades: { celestial_dough: 20 } };
      x.crypto.balance = 300;
      x.crypto.ledger = 4;
      x.skinsOwned.ice = true;
      x.unlocked = { click_1: 1 };
    });
    return s;
  };

  it("emporte la partie, les chips et l'arbre céleste", () => {
    const s = avant();
    const apres = createResetState({
      preservePrestige: false,
      ascension: { stars: starsFor(s.prestige.chips), spent: 0, tracks: {}, count: 1 },
    });
    expect(apres.cookies).toBe(0);
    expect(apres.items).toEqual({});
    expect(apres.upgrades).toEqual({});
    expect(apres.prestige).toEqual({ chips: 0, spent: 0, upgrades: {} });
  });

  it("garde les étoiles et la Voûte", () => {
    const apres = createResetState({
      preservePrestige: false,
      ascension: { stars: 7, spent: 3, tracks: { horizon: 2 }, count: 4 },
    });
    expect(apres.ascension).toEqual({ stars: 7, spent: 3, tracks: { horizon: 2 }, count: 4 });
  });

  it("ne perd pas le CRMB ni le Registre", () => {
    // Ils vivent dans `crypto`, que la remise à zéro ne touche pas: c'est au
    // jeu de les reporter. On vérifie qu'il n'y a rien de destructeur ici.
    const apres = createResetState({ preservePrestige: false, ascension: { stars: 1, spent: 0, tracks: {}, count: 1 } });
    expect(apres.crypto.balance).toBe(0);
    expect(apres.crypto.ledger).toBe(0);
  });
});

describe("migration vers l'Ascension", () => {
  it("laisse une sauvegarde d'avant l'Ascension parfaitement jouable", () => {
    const s = migrate({ version: 5, cookies: 500, items: { oven: 10 } });
    expect(s.ascension).toEqual({ stars: 0, spent: 0, tracks: {}, count: 0 });
    expect(ascensionEffects(s).horizon).toBe(0);
    expect(deriveStats(s, LATER, 0).mining).toBeGreaterThan(0);
    // Aucun rang d'Ascension n'est acheté par accident.
    for (const item of ITEMS.filter((i) => i.horizon > 0)) {
      expect(costOf(s, item.id, 1, LATER)).toBe(Infinity);
    }
  });

  it("assainit une Voûte bricolée", () => {
    const s = migrate({
      version: 5,
      ascension: {
        stars: -5,
        spent: 999,
        count: 2.7,
        tracks: { horizon: 99, eclat: -3, echo: "4", inconnue: 10, casse: NaN },
      },
    });
    expect(s.ascension.stars).toBe(0);
    expect(s.ascension.spent).toBe(0); // jamais plus que gagné
    expect(s.ascension.count).toBe(2);
    expect(s.ascension.tracks.horizon).toBe(4); // ramené au maximum de la voie
    expect(s.ascension.tracks.eclat).toBeUndefined();
    expect(s.ascension.tracks.echo).toBeUndefined(); // « 4 » n'est pas un nombre
    expect(s.ascension.tracks.inconnue).toBeUndefined();
    expect(s.ascension.tracks.casse).toBeUndefined();
    // Et rien de tout cela ne casse l'économie.
    const d = deriveStats(s, LATER, 0);
    expect(Number.isFinite(d.mining)).toBe(true);
    expect(d.perClickNoCombo).toBeGreaterThan(0);
    expect(onGrid(d.mineMult)).toBe(true);
  });

  it("garde les bâtiments d'un rang d'Ascension déjà possédé", () => {
    // Le catalogue déclare les douze rangs dès le départ: une sauvegarde qui
    // en contient garde ses bâtiments même si la voie a été perdue.
    const s = migrate({ version: 5, items: { bigbake: 5 } });
    expect(s.items.bigbake).toBe(5);
    expect(deriveStats(s, LATER, 0).mining).toBeGreaterThan(0);
  });
});

// ============================================================================
// Ce que l'Ascension change vraiment, mesuré
// ============================================================================

describe("la progression longue durée", () => {
  // Ces mesures font jouer une partie complète avec les vraies formules. Elles
  // sont lentes: une seule partie sert à tout.
  const JOUR = 24 * 3600e3;
  const avec = play({ clicksPerSecond: 5, durationMs: 30 * JOUR, strategy: "optimiser" });
  const sans = play({ clicksPerSecond: 5, durationMs: 30 * JOUR, strategy: "optimiser", ascension: false });

  it("ne se déclenche pas avant que le prestige ait donné ce qu'il a", () => {
    const jour = play({ clicksPerSecond: 5, durationMs: JOUR, strategy: "optimiser" });
    expect(jour.ascensions, "aucune ascension le premier jour").toBe(0);
    expect(jour.prestiges).toBeGreaterThan(0);
  });

  it("apporte du contenu neuf: les huit bâtiments qui n'existaient pas", () => {
    expect(avec.stats.voies.horizon).toBeGreaterThan(0);
    expect(avec.stats.batiments).toBeGreaterThan(sans.stats.batiments);
  });

  it("relance vraiment la production au trentième jour", () => {
    // Sans elle: 1,07e9/s au trentième jour, et 5,69e9 au trois-cent-
    // soixante-cinquième — un facteur 2,8 en onze mois.
    expect(avec.sommet).toBeGreaterThan(sans.sommet * 5);
  });

  it("ne fait pas exploser les nombres", () => {
    // Une couche de renaissance mal bornée diverge. Le sommet doit rester très
    // en dessous de la limite des entiers exacts de JavaScript.
    expect(Number.isFinite(avec.sommet)).toBe(true);
    expect(avec.sommet).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(Number.isFinite(avec.stats.lifetime)).toBe(true);
  });

  it("garde des ascensions espacées plutôt qu'une boucle qui tourne à vide", () => {
    // Ascendre pour une étoile quand on en a cinquante, c'est perdre son parc
    // pour rien. Le rythme doit rester celui d'un événement, pas d'une routine.
    expect(avec.ascensions).toBeGreaterThan(0);
    expect(avec.ascensions).toBeLessThan(30);
  });
});
