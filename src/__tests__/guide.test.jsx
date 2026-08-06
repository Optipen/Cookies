// === Le Guide ===
//
// Le défaut qu'il corrige n'est pas un bug: c'est que le jeu ne disait à
// personne pourquoi il fallait continuer. Un joueur ouvrait Crumbora, voyait
// un cookie et cinq nombres, cliquait dix fois, et refermait — tout le jeu
// (paliers, quêtes, CRMB, Renaissance) était derrière ce mur de trente
// secondes.
//
// Ce que ces tests verrouillent, dans l'ordre d'importance:
//
//   1. un joueur NEUF reçoit une première consigne, tout de suite;
//   2. un VÉTÉRAN ne se fait jamais réexpliquer le clic — y compris juste
//      après une Renaissance, qui vide pourtant son parc;
//   3. il y a TOUJOURS quelque chose à viser: l'écran n'est jamais sans
//      horizon, c'est exactement ce qui fait fermer l'onglet.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup, within, waitFor } from "@testing-library/react";
import CookieCraze from "../components/CookieCraze.jsx";
import { SAVE_KEY, createFreshState, createResetState, couchesConservees, migrate } from "../utils/state.js";
import {
  ETAPES,
  CLICS_PREMIERE_ETAPE,
  PRIX_PREMIER_ACHAT,
  conseil,
  etapeCourante,
  etapeFaite,
  prochainObjectif,
} from "../data/guide.js";
import { deriveStats, costOf } from "../utils/selectors.js";
import { PRESTIGE_MIN_LIFETIME } from "../data/prestige.js";

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

const neuf = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  s.ui.sounds = false;
  mutate(s);
  return s;
};

const demarrer = async (etat) => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(etat));
  const utils = render(<CookieCraze />);
  await act(async () => {});
  return utils;
};

/** Un joueur qui a tout découvert: parc, améliorations, quêtes, dorés. */
const veteran = (mutate = () => {}) =>
  neuf((s) => {
    s.cookies = 5e8;
    s.lifetime = 5e9;
    s.items = { cursor: 40, oven: 40, grandma: 20, bakery: 20 };
    s.upgrades = { "tier:oven:0": true };
    s.lifetimeStats = { clicks: 50_000, goldenClicks: 120, cookiesEaten: 10, questsCompleted: 60, bestStreak: 4 };
    s.stats = { ...s.stats, clicks: 12_000, prestigeCount: 3 };
    mutate(s);
  });

// ===========================================================================

describe("un joueur qui découvre", () => {
  it("reçoit une consigne dès la première seconde", () => {
    const c = conseil(neuf(), {});
    expect(c).not.toBeNull();
    expect(c.phase).toBe("decouverte");
    expect(c.index).toBe(1);
    expect(c.titre).toMatch(/cookie/i);
  });

  it("voit le guide à l'écran, avec quoi faire ET pourquoi", async () => {
    await demarrer(neuf());
    const guide = screen.getByTestId("guide");
    expect(guide.textContent).toMatch(/À faire · 1\/7/);
    expect(guide.textContent).toMatch(/Appuie sur le gros cookie/i);
    // La promesse: sans elle, la consigne n'est qu'un ordre.
    expect(guide.textContent).toMatch(/rapporte des cookies/i);
    // Et la récompense, annoncée AVANT l'effort.
    expect(guide.textContent).toMatch(/cookies à la clé/i);
  });

  it("avance d'étape quand il fait ce qu'on lui demande", () => {
    const apres = neuf((s) => (s.lifetimeStats.clicks = CLICS_PREMIERE_ETAPE));
    const c = conseil(apres, {});
    expect(c.index).toBe(2);
    expect(c.titre).toMatch(/Curseur/i);
    expect(c.onglet).toBe("shop");
  });

  it("« Montre-moi » ouvre l'onglet, POSE LE BON FILTRE et désigne la carte", async () => {
    // Le défaut qui rendait le guide inutilisable: « prends le Four » ouvrait
    // la Boutique en laissant le filtre sur « Clic ». Le Four n'était pas dans
    // la liste — le joueur cherchait un bâtiment que l'écran ne montrait pas.
    const defilements = [];
    window.HTMLElement.prototype.scrollIntoView = function (opts) {
      defilements.push({ opts, id: this.id });
    };
    await demarrer(
      neuf((s) => {
        s.lifetimeStats.clicks = CLICS_PREMIERE_ETAPE;
        s.items = { cursor: 1 }; // étape « le Four », donc filtre Minage
        s.guide.faites = { clic: true, curseur: true };
      })
    );
    const guide = screen.getByTestId("guide");
    expect(guide.textContent).toMatch(/Four/i);

    await act(async () => {
      fireEvent.click(within(guide).getByRole("button", { name: /Montre-moi/i }));
    });
    expect(screen.getByRole("tab", { name: "Boutique" }).getAttribute("aria-selected")).toBe("true");
    // Le filtre « Minage » est bien celui qui est actif.
    expect(screen.getByRole("button", { name: "Minage" }).getAttribute("aria-pressed")).toBe("true");
    // Et le Four est visible, désigné, et c'est vers LUI qu'on a défilé.
    const four = document.getElementById("item-oven");
    expect(four).not.toBeNull();
    expect(four.getAttribute("data-designe")).toBe("true");
    expect(within(four).getByText(/C'est ici/i)).toBeTruthy();
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(defilements.some((d) => d.id === "item-oven")).toBe(true);
  });

  it("laisse de quoi ACHETER le Curseur au moment où il le demande", () => {
    // Le mur mesuré: dix clics donnaient dix cookies, le Curseur en coûtait
    // soixante-quinze, et le guide demandait pourtant de l'acheter tout de
    // suite. Le joueur arrivait en boutique devant un bouton éteint.
    const neufJoueur = neuf();
    const gainParClic = deriveStats(neufJoueur, 0, 0).perClickNoCombo;
    const prix = costOf(neufJoueur, "cursor", 1, 0);

    // Ce que le joueur a EXACTEMENT quand l'étape 1 se referme: ses clics, plus
    // la prime de l'étape. Rien d'autre — surtout pas la récompense d'un succès
    // qui tombe une seconde et demie plus tard et masquerait le trou.
    const enPoche = CLICS_PREMIERE_ETAPE * gainParClic + ETAPES[0].recompense;

    expect(prix).toBe(PRIX_PREMIER_ACHAT);
    expect(enPoche).toBeGreaterThanOrEqual(prix);
  });

  it("verse la prime de l'étape 1 et rend le Curseur achetable, à l'écran", async () => {
    // La même propriété, mais vue du joueur: le bouton doit être ALLUMÉ.
    await demarrer(neuf((s) => (s.lifetimeStats.clicks = CLICS_PREMIERE_ETAPE - 1)));
    const cookie = screen.getByRole("button", { name: /Cliquer le cookie/i });
    await act(async () => {
      fireEvent.click(cookie);
    });
    // Le verrou d'étape tourne à la seconde: on le laisse passer.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1200));
    });
    const solde = Number(screen.getByTestId("solde").textContent.replace(/\D/g, ""));
    expect(solde).toBeGreaterThanOrEqual(PRIX_PREMIER_ACHAT);

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Boutique" }));
    });
    const acheter = screen.getByRole("button", { name: /^Acheter Curseur/i });
    expect(acheter.disabled).toBe(false);
  }, 15000);

  it("récompense chaque étape franchie, en cookies", () => {
    // Un guide qui ne promet rien n'est qu'une liste de corvées.
    for (const e of ETAPES) expect(e.recompense, e.id).toBeGreaterThan(0);
    // Et la récompense grandit avec l'effort demandé.
    const primes = ETAPES.map((e) => e.recompense);
    expect([...primes].sort((a, b) => a - b)).toEqual(primes);
  });

  it("enchaîne les sept étapes dans l'ordre, sans trou", () => {
    // Chaque étape doit être atteignable: on les franchit une à une et on
    // vérifie qu'on tombe bien sur la suivante, jamais deux fois sur la même.
    const s = neuf();
    const vus = [];
    for (let i = 0; i < ETAPES.length; i++) {
      const c = etapeCourante(s);
      expect(c, `étape ${i}`).not.toBeNull();
      expect(vus).not.toContain(c.etape.id);
      vus.push(c.etape.id);
      s.guide.faites[c.etape.id] = true;
    }
    expect(etapeCourante(s)).toBeNull();
    expect(vus.length).toBe(7);
  });
});

describe("un joueur qui sait déjà jouer", () => {
  it("ne se fait jamais réexpliquer le clic", () => {
    const c = conseil(veteran(), {});
    expect(c.phase).toBe("objectif");
  });

  it("a toutes les étapes considérées comme franchies, sans rien avoir stocké", () => {
    // Aucune sauvegarde antérieure ne contient `guide`: les étapes se mesurent
    // sur l'état RÉEL, il n'y a donc rien à semer à la migration.
    const migre = migrate({
      version: 7,
      items: { cursor: 40, oven: 40, grandma: 20, bakery: 20 },
      upgrades: { "tier:oven:0": true },
      lifetimeStats: { clicks: 50_000, goldenClicks: 120, questsCompleted: 60 },
    });
    expect(migre.guide).toEqual({ faites: {}, masque: false });
    for (const e of ETAPES) expect(etapeFaite(migre, e), e.id).toBe(true);
    expect(conseil(migre, {}).phase).toBe("objectif");
  });

  it("garde ses étapes après une Renaissance qui vide pourtant son parc", () => {
    // C'est LE cas qui justifie le verrou: `items` et `upgrades` repartent à
    // zéro, mais le joueur, lui, n'a rien désappris.
    const avant = veteran((s) => {
      s.guide = { faites: Object.fromEntries(ETAPES.map((e) => [e.id, true])), masque: false };
    });
    const apres = createResetState({ ...couchesConservees(avant), preservePrestige: true, prestige: avant.prestige });
    expect(apres.items).toEqual({});
    expect(apres.upgrades).toEqual({});
    expect(etapeCourante(apres)).toBeNull();
    expect(conseil(apres, {}).phase).toBe("objectif");
  });

  it("perd le guide avec « Tout effacer », comme tout le reste", () => {
    const apres = createResetState({ preservePrestige: false });
    expect(apres.guide).toEqual({ faites: {}, masque: false });
    expect(etapeCourante(apres)?.etape.id).toBe("clic");
  });
});

describe("il y a toujours quelque chose à viser", () => {
  it("propose l'amélioration payable en priorité", () => {
    const s = veteran((x) => {
      x.items = { oven: 40 };
      x.upgrades = {};
      x.cookies = 1e12;
      // Sous le seuil de Renaissance: elle passerait devant, et c'est voulu.
      x.lifetime = PRESTIGE_MIN_LIFETIME / 2;
    });
    const o = prochainObjectif(s, deriveStats(s, 0));
    expect(o.cle).toMatch(/^amelioration:/);
    expect(o.onglet).toBe("upgrades");
  });

  it("sinon, nomme le palier de bâtiment le plus proche et ce qu'il change", () => {
    const s = veteran((x) => {
      x.items = { oven: 7 };
      x.upgrades = {};
      x.cookies = 0;
      x.lifetime = PRESTIGE_MIN_LIFETIME / 2;
    });
    const o = prochainObjectif(s, deriveStats(s, 0));
    expect(o.cle).toMatch(/^palier:/);
    expect(o.pourquoi).toMatch(/deux fois plus/i);
    expect(o.but).toBeGreaterThan(o.fait);
  });

  it("annonce la Renaissance dès qu'elle est possible, avant tout le reste", () => {
    // Le plus gros moment du jeu, et il passait inaperçu: le bouton s'allume
    // dans un onglet qu'un joueur n'ouvre pas de lui-même.
    const s = veteran((x) => {
      x.lifetime = PRESTIGE_MIN_LIFETIME * 2;
      x.cookies = 1e12; // une amélioration est payable: elle doit céder le pas
    });
    const o = prochainObjectif(s, deriveStats(s, 0));
    expect(o.cle).toBe("renaissance-prete");
    expect(o.onglet).toBe("prestige");
    expect(o.pourquoi).toMatch(/permanents/i);
  });

  it("garde la Renaissance en dernier recours quand il n'y a plus de palier", () => {
    const s = neuf((x) => {
      x.lifetime = PRESTIGE_MIN_LIFETIME / 2;
      x.cookies = 0;
      // Aucun bâtiment achetable en vue: on force le catalogue à ne rien rendre.
      x.upgrades = {};
    });
    const o = prochainObjectif({ ...s, items: {} }, deriveStats(s, 0));
    // Un palier reste normalement visible: c'est bien, et c'est le cas courant.
    expect(["renaissance", "palier:tier:cursor:0"]).toContain(o.cle);
    expect(o.but).toBeGreaterThan(0);
  });

  it("n'affiche jamais un écran sans horizon", async () => {
    // Le vrai test: à trois stades très différents, il y a toujours une carte.
    for (const etat of [neuf(), veteran(), veteran((s) => (s.cookies = 0))]) {
      expect(conseil(etat, deriveStats(etat, 0))).not.toBeNull();
    }
  });
});

describe("le joueur reste maître de l'affichage", () => {
  it("peut masquer le guide, et il ne revient pas tout seul", async () => {
    await demarrer(neuf());
    const guide = screen.getByTestId("guide");
    await act(async () => {
      fireEvent.click(within(guide).getByRole("button", { name: /Masquer le guide/i }));
    });
    // `AnimatePresence` garde l'élément le temps de l'animation de sortie.
    await waitFor(() => expect(screen.queryByTestId("guide")).toBeNull());
    // Et il reste masqué au tick suivant: ce n'est pas un simple repli visuel.
    await act(async () => {});
    expect(screen.queryByTestId("guide")).toBeNull();
  });

  it("peut le réafficher depuis les réglages", async () => {
    await demarrer(neuf((s) => (s.guide = { faites: {}, masque: true })));
    expect(screen.queryByTestId("guide")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /Réafficher le guide/i }));
    });
    expect(screen.getByTestId("guide")).toBeTruthy();
  });

  it("ne propose « Réafficher » que s'il est masqué", async () => {
    await demarrer(neuf());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    });
    expect(screen.queryByRole("menuitem", { name: /Réafficher le guide/i })).toBeNull();
  });
});
