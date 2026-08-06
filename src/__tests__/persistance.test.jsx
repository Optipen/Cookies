// === Ce qui survit à une remise à zéro ===
//
// Ce fichier existe parce que l'ancienne suite ne le couvrait pas, et que deux
// pertes de données irréversibles s'y étaient logées:
//
//   · la réinitialisation « douce » annonçait « le prestige et l'arbre céleste
//     sont conservés » et emportait pourtant TOUTE l'Ascension — les étoiles,
//     la Voûte, et avec Horizon les huit bâtiments qu'elle débloque;
//   · la renaissance emportait les apparences, dont les deux payées 35 CRMB,
//     alors que le portefeuille CRMB qui les avait achetées, lui, survivait.
//
// Aucun test ne les a vues, et pour une raison précise: la suite éprouvait
// `createResetState` ISOLÉMENT, jamais ce que les gestes du jeu lui passent.
// Une fonction correcte appelée avec un argument manquant reste correcte.
//
// On teste donc ici les deux bouts: le contrat de la fonction ET le geste réel
// du joueur, écran compris.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup, waitFor, within } from "@testing-library/react";
import CookieCraze from "../components/CookieCraze.jsx";
import {
  SAVE_KEY,
  STATE_VERSION,
  createFreshState,
  createResetState,
  couchesConservees,
  migrate,
  storageDisponible,
} from "../utils/state.js";
import { PRESTIGE_MIN_LIFETIME, chipsFor } from "../data/prestige.js";
import { ACHIEVEMENTS } from "../data/achievements.js";

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

/** Une partie avancée: prestige, ascension, apparences, CRMB, compteurs à vie. */
const partieAvancee = (mutate = () => {}) => {
  const s = createFreshState();
  s.ui.introSeen = true;
  s.ui.sounds = false;
  s.cookies = 5e11;
  s.lifetime = 5e11;
  s.items = { oven: 60, cursor: 60 };
  s.prestige = { chips: 8_000, spent: 120, upgrades: { celestial_dough: 6 } };
  s.ascension = { stars: 40, spent: 7, tracks: { horizon: 2, eclat: 3, echo: 1 }, count: 3 };
  s.skin = "fire";
  s.skinsOwned = { default: true, starter: true, early: true, caramel: true, noir: true, ice: true, fire: true };
  s.crypto = { ...s.crypto, balance: 300, ledger: 4, miners: { cpu: 3 } };
  s.unlocked = { click_1: 1, bank_1k: 1 };
  s.lifetimeStats = { clicks: 120_000, goldenClicks: 300, cookiesEaten: 40, questsCompleted: 210, bestStreak: 12 };
  s.stats = { ...s.stats, clicks: 40_000, goldenClicks: 90, prestigeCount: 6 };
  s.cookieEatenCount = 12;
  mutate(s);
  return s;
};

/**
 * Production totale à partir de laquelle la renaissance rapporte plus que les
 * huit mille chips déjà possédés — donc à partir de laquelle le bouton
 * s'active. Calculée depuis la formule du jeu: la coder en dur casserait ce
 * fichier à la première recalibration.
 */
const VIE_POUR_RENAITRE = (() => {
  let vie = PRESTIGE_MIN_LIFETIME;
  while (chipsFor(vie, 1.25) <= 8_000) vie *= 10;
  return vie;
})();

const demarrer = async (etat) => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(etat));
  const utils = render(<CookieCraze />);
  await act(async () => {});
  return utils;
};

/**
 * Force l'écriture sur disque et relit la sauvegarde.
 *
 * L'autosauvegarde tourne toutes les cinq secondes; `pagehide` est l'autre
 * déclencheur, celui d'iOS Safari, et il persiste immédiatement. C'est donc lui
 * qu'on utilise pour lire ce que le joueur retrouverait en rechargeant — la
 * seule mesure qui compte pour une perte de données.
 */
const lireSauvegarde = async () => {
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
  });
  return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
};

/** Ouvre le menu ⚙️ et déclenche « Réinitialiser », puis confirme. */
const reinitialiser = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: /Réinitialiser/ }));
  });
  const dialogue = screen.getByTestId("confirmation");
  const texte = dialogue.textContent;
  await act(async () => {
    fireEvent.click(within(dialogue).getByRole("button", { name: "Réinitialiser" }));
  });
  return texte;
};

const renaitre = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("tab", { name: "Prestige" }));
  });
  await waitFor(() => expect(screen.queryByLabelText("Chargement")).toBeNull());
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Renaître/ }));
  });
  const dialogue = screen.getByTestId("confirmation");
  await act(async () => {
    fireEvent.click(within(dialogue).getByRole("button", { name: "Renaître" }));
  });
};

// ===========================================================================

describe("le contrat de conservation", () => {
  it("ne garde RIEN qu'on ne lui ait confié", () => {
    const s = createResetState({ preservePrestige: false });
    expect(s.ascension).toEqual({ stars: 0, spent: 0, tracks: {}, count: 0 });
    expect(s.crypto.balance).toBe(0);
    expect(s.crypto.ledger).toBe(0);
    expect(s.skinsOwned.ice).toBe(false);
    expect(s.unlocked).toEqual({});
    expect(s.lifetimeStats.clicks).toBe(0);
  });

  it("garde exactement les couches qu'on lui confie", () => {
    const avant = partieAvancee();
    const s = createResetState({ ...couchesConservees(avant), preservePrestige: false });
    expect(s.crypto.balance).toBe(300);
    expect(s.crypto.ledger).toBe(4);
    expect(s.skinsOwned.fire).toBe(true);
    expect(s.skin).toBe("fire");
    expect(s.unlocked).toEqual({ click_1: 1, bank_1k: 1 });
    expect(s.lifetimeStats.clicks).toBe(120_000);
  });

  it("n'équipe jamais une apparence qu'on ne possède pas", () => {
    // Une sauvegarde bricolée ne doit pas pouvoir poser un skin non acheté.
    const s = createResetState({ skin: "fire", skinsOwned: { default: true } });
    expect(s.skin).toBe("default");
  });

  it("remet les horloges du marché à l'instant de la renaissance", () => {
    // Reprises telles quelles, une partie relancée après une longue absence
    // verserait d'un coup tout le rendement de cette absence.
    const avant = partieAvancee((s) => {
      s.crypto.lastMarketTs = 0;
      s.crypto.lastYieldTs = 0;
    });
    const s = createResetState({ ...couchesConservees(avant), now: 5_000 });
    expect(s.crypto.lastMarketTs).toBe(5_000);
    expect(s.crypto.lastYieldTs).toBe(5_000);
  });
});

describe("la renaissance céleste", () => {
  it("garde les apparences — y compris celles payées en CRMB", async () => {
    // Le défaut exact: le joueur payait Ice 10 CRMB et Lava 25, renaissait, et
    // retrouvait un vestiaire vide avec le portefeuille intact.
    await demarrer(partieAvancee((s) => (s.lifetime = VIE_POUR_RENAITRE)));
    await renaitre();
    await act(async () => {});

    const s = await lireSauvegarde();
    expect(s.skinsOwned.ice).toBe(true);
    expect(s.skinsOwned.fire).toBe(true);
    expect(s.skin).toBe("fire");
  });

  it("garde les étoiles, la Voûte, le CRMB, le Registre et les succès", async () => {
    await demarrer(partieAvancee((s) => (s.lifetime = VIE_POUR_RENAITRE)));
    await renaitre();
    await act(async () => {});

    const s = await lireSauvegarde();
    expect(s.ascension.stars).toBe(40);
    expect(s.ascension.tracks).toEqual({ horizon: 2, eclat: 3, echo: 1 });
    expect(s.crypto.ledger).toBe(4);
    expect(s.crypto.miners.cpu).toBe(3);
    // +5 CRMB pour la renaissance elle-même, jamais moins que le solde d'avant.
    expect(s.crypto.balance).toBeGreaterThanOrEqual(300);
    expect(s.unlocked.click_1).toBeTruthy();
  });

  it("garde les compteurs à vie et remet ceux de la partie à zéro", async () => {
    await demarrer(partieAvancee((s) => (s.lifetime = VIE_POUR_RENAITRE)));
    await renaitre();
    await act(async () => {});

    const s = await lireSauvegarde();
    // À vie: rien ne redescend.
    expect(s.lifetimeStats.clicks).toBeGreaterThanOrEqual(120_000);
    expect(s.lifetimeStats.questsCompleted).toBeGreaterThanOrEqual(210);
    expect(s.lifetimeStats.goldenClicks).toBeGreaterThanOrEqual(300);
    // Partie: repart de zéro, c'est le sens même d'une renaissance.
    expect(s.stats.clicks).toBeLessThan(120_000);
    expect(s.items).toEqual({});
  });
});

describe("la réinitialisation de partie", () => {
  it("garde l'Ascension entière — étoiles ET Voûte", async () => {
    // Le défaut exact: quarante étoiles et les trois voies partaient à zéro,
    // sous un dialogue qui promettait que le prestige était conservé.
    await demarrer(partieAvancee());
    await reinitialiser();
    await act(async () => {});

    const s = await lireSauvegarde();
    expect(s.ascension.stars).toBe(40);
    expect(s.ascension.spent).toBe(7);
    expect(s.ascension.tracks).toEqual({ horizon: 2, eclat: 3, echo: 1 });
    expect(s.ascension.count).toBe(3);
  });

  it("garde aussi le prestige, le CRMB, les apparences, les succès et les compteurs à vie", async () => {
    await demarrer(partieAvancee());
    await reinitialiser();
    await act(async () => {});

    const s = await lireSauvegarde();
    expect(s.prestige.chips).toBe(8_000);
    expect(s.crypto.balance).toBe(300);
    expect(s.crypto.ledger).toBe(4);
    expect(s.skinsOwned.ice).toBe(true);
    expect(s.unlocked.bank_1k).toBeTruthy();
    expect(s.lifetimeStats.clicks).toBe(120_000);
    // Et la partie, elle, repart bien de zéro.
    expect(s.items).toEqual({});
    expect(s.cookies).toBe(0);
  });

  it("énumère dans le dialogue ce qui est conservé", async () => {
    // Une promesse vague devant un geste destructeur est ce qui a rendu le
    // défaut invisible: le dialogue doit nommer chaque couche.
    await demarrer(partieAvancee());
    const texte = await reinitialiser();
    for (const mot of ["chips", "étoiles", "Voûte", "CRMB", "Registre", "apparences", "succès"]) {
      expect(texte).toContain(mot);
    }
  });

  it("« Tout effacer » emporte vraiment tout", async () => {
    await demarrer(partieAvancee());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    });
    // Maj + clic: le geste documenté sous le bouton.
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /Réinitialiser/ }), { shiftKey: true });
    });
    const dialogue = screen.getByTestId("confirmation");
    await act(async () => {
      fireEvent.click(within(dialogue).getByRole("button", { name: "Tout effacer" }));
    });
    await act(async () => {});

    const s = await lireSauvegarde();
    expect(s.prestige.chips).toBe(0);
    expect(s.ascension.stars).toBe(0);
    expect(s.crypto.ledger).toBe(0);
    expect(s.skinsOwned.ice).toBe(false);
    expect(s.unlocked).toEqual({});
    expect(s.lifetimeStats.clicks).toBe(0);
  });
});

describe("les compteurs à vie", () => {
  it("montent avec les clics, sans jamais redescendre", async () => {
    await demarrer(partieAvancee());
    const avant = (await lireSauvegarde()).lifetimeStats.clicks;
    const cookie = screen.getByRole("button", { name: /Cliquer le cookie/i });
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        fireEvent.click(cookie);
      });
    }
    await act(async () => {});
    expect((await lireSauvegarde()).lifetimeStats.clicks).toBeGreaterThan(avant);
  });

  it("sont semés depuis la partie en cours quand la sauvegarde est antérieure", () => {
    // Un joueur à quatre-vingt mille clics ne doit pas repartir de rien pour un
    // succès qu'il touchait presque.
    const ancienne = {
      version: 6,
      cookies: 1e6,
      items: { oven: 4 },
      stats: { clicks: 80_000, goldenClicks: 150 },
      cookieEatenCount: 20,
      quests: { completed: { click_warmup: 90, gain_small: 30 }, streak: 5 },
    };
    const s = migrate(ancienne);
    expect(s.version).toBe(STATE_VERSION);
    expect(s.migratedFrom).toBe(6);
    expect(s.lifetimeStats.clicks).toBe(80_000);
    expect(s.lifetimeStats.goldenClicks).toBe(150);
    expect(s.lifetimeStats.cookiesEaten).toBe(20);
    expect(s.lifetimeStats.questsCompleted).toBe(120);
    expect(s.lifetimeStats.bestStreak).toBe(5);
  });

  it("ne redescendent jamais sous ce qu'une sauvegarde contient déjà", () => {
    const s = migrate({
      version: 7,
      lifetimeStats: { clicks: 500_000, goldenClicks: 0, cookiesEaten: 0, questsCompleted: 0, bestStreak: 0 },
      stats: { clicks: 12 },
    });
    expect(s.lifetimeStats.clicks).toBe(500_000);
  });

  it("assainissent les valeurs aberrantes d'une sauvegarde bricolée", () => {
    const s = migrate({ version: 7, lifetimeStats: { clicks: -50, goldenClicks: "beaucoup", bestStreak: 3.7 } });
    expect(s.lifetimeStats.clicks).toBe(0);
    expect(s.lifetimeStats.goldenClicks).toBe(0);
    expect(s.lifetimeStats.bestStreak).toBe(3);
  });
});

describe("les succès cumulatifs comptent une VIE, pas une partie", () => {
  const trouver = (id) => ACHIEVEMENTS.find((a) => a.id === id);

  it("restent acquis après une renaissance qui vide les compteurs de partie", () => {
    const apresRenaissance = createFreshState();
    apresRenaissance.lifetimeStats = {
      clicks: 100_000,
      goldenClicks: 200,
      cookiesEaten: 25,
      questsCompleted: 150,
      bestStreak: 7,
    };
    // Les compteurs de PARTIE sont à zéro: c'est exactement l'état d'un joueur
    // qui vient de renaître.
    expect(apresRenaissance.stats.clicks).toBe(0);

    for (const id of ["click_100k", "golden_200", "eaten_25", "quest_150", "streak_7"]) {
      expect(trouver(id).cond(apresRenaissance, {})).toBe(true);
    }
  });

  it("ne se déclenchent pas sur un joueur qui n'a rien fait", () => {
    const neuf = createFreshState();
    for (const id of ["click_100k", "golden_200", "eaten_25", "quest_150", "streak_7"]) {
      expect(trouver(id).cond(neuf, {})).toBe(false);
    }
  });

  it("décrivent bien ce qu'ils exigent", () => {
    // « Un nœud au maximum » testait `niveau >= 20`, hors de portée des six
    // nœuds plafonnés à 8 ou 10: la description ne décrivait pas la condition.
    expect(trouver("tree_maxed").desc).toContain("20");
  });
});

describe("l'avertissement de sauvegarde impossible", () => {
  /** Rend `localStorage` inutilisable, comme en navigation privée. */
  const casserStockage = () => {
    const vrai = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("refusé", "SecurityError");
      },
    });
    return () => Object.defineProperty(window, "localStorage", vrai);
  };

  it("détecte un stockage qui refuse d'écrire", () => {
    const restaurer = casserStockage();
    try {
      expect(storageDisponible()).toBe(false);
    } finally {
      restaurer();
    }
    expect(storageDisponible()).toBe(true);
  });

  it("prévient le joueur au lieu de le laisser jouer pour rien", async () => {
    const restaurer = casserStockage();
    try {
      render(<CookieCraze />);
      await act(async () => {});
      // Sans stockage, la partie est neuve: on passe l'écran d'accueil.
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Commencer à cuire/i }));
      });
      const alerte = screen.getByTestId("sauvegarde-ko");
      expect(alerte.textContent).toMatch(/ne peut pas être sauvegardée/i);
      // Et il repart avec quelque chose: un fichier.
      expect(within(alerte).getByRole("button", { name: /Exporter/i })).toBeTruthy();
    } finally {
      restaurer();
    }
  });

  it("ne dit rien quand tout va bien", async () => {
    await demarrer(partieAvancee());
    expect(screen.queryByTestId("sauvegarde-ko")).toBeNull();
  });
});
