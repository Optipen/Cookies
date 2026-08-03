import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import CookieCraze from "../components/CookieCraze.jsx";
import { SAVE_KEY, createFreshState } from "../utils/state.js";

// Le jeu s'appuie sur des API absentes de jsdom
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.confirm = vi.fn(() => true);
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

/** Démarre le jeu en sautant l'écran d'accueil. */
const startGame = async (mutate = () => {}) => {
  const save = createFreshState();
  save.ui.introSeen = true;
  save.ui.sounds = false;
  mutate(save);
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  const utils = render(<CookieCraze />);
  await act(async () => {});
  return utils;
};

const clickCookie = async () => {
  const cookie = screen.getByRole("button", { name: /Cliquer le cookie/i });
  await act(async () => {
    fireEvent.click(cookie);
  });
};

describe("démarrage", () => {
  it("affiche l'écran d'accueil sur une partie neuve", async () => {
    render(<CookieCraze />);
    await act(async () => {});
    expect(screen.getByText("COOKIE CRAZE")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Commencer à cuire/i })).toBeTruthy();
  });

  it("lance la partie après « Commencer »", async () => {
    render(<CookieCraze />);
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Commencer à cuire/i }));
    });
    expect(screen.getByRole("heading", { name: "Cookie Craze" })).toBeTruthy();
  });

  it("charge une partie existante sans repasser par l'accueil", async () => {
    await startGame((s) => (s.cookies = 4242));
    expect(screen.queryByText("COOKIE CRAZE")).toBeNull();
    expect(screen.getByRole("heading", { name: "Cookie Craze" })).toBeTruthy();
  });
});

describe("boucle de jeu", () => {
  it("crédite des cookies au clic", async () => {
    await startGame();
    expect(screen.getByText(/👆 Clics :/).textContent).toContain("0");
    await clickCookie();
    expect(screen.getByText(/👆 Clics :/).textContent).toContain("1");
  });

  it("achète un bâtiment et met à jour la production", async () => {
    await startGame((s) => (s.cookies = 100_000));
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Auto/i }));
    });
    const ovenButton = screen.getByRole("button", { name: /Four, 0 possédés/i });
    await act(async () => {
      fireEvent.click(ovenButton);
    });
    expect(screen.getByRole("button", { name: /Four, 1 possédés/i })).toBeTruthy();
  });

  it("refuse un achat trop cher", async () => {
    await startGame((s) => {
      s.cookies = 0;
      // Le premier bâtiment automatique est offert en début de partie:
      // on marque le cadeau comme déjà utilisé pour tester le vrai blocage.
      s.flags.freeFirstAutoGiven = true;
      s.items = { oven: 1 };
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Auto/i }));
    });
    const ovenButton = screen.getByRole("button", { name: /Four, 1 possédés/i });
    expect(ovenButton.disabled).toBe(true);
  });

  it("offre le premier bâtiment automatique en début de partie", async () => {
    await startGame((s) => (s.cookies = 0));
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Auto/i }));
    });
    const ovenButton = screen.getByRole("button", { name: /Four, 0 possédés/i });
    expect(ovenButton.disabled).toBe(false);
    expect(ovenButton.textContent).toContain("OFFERT");
  });
});

describe("navigation", () => {
  it("ouvre chaque onglet sans erreur", async () => {
    await startGame((s) => {
      s.cookies = 5e6;
      s.lifetime = 5e6;
      s.prestige = { chips: 12, spent: 0, upgrades: {} };
    });

    for (const name of [/Améliorations/i, /Quêtes/i, /CRMB/i, /Skins/i, /Prestige/i, /Stats/i, /Boutique/i]) {
      await act(async () => {
        fireEvent.click(screen.getByRole("tab", { name }));
      });
    }
    // Le dernier onglet ouvert doit être rendu
    expect(screen.getByRole("tab", { name: /Boutique/i }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("prestige", () => {
  // Régression: `DEFAULT_STATE` n'était pas importé, le bouton Prestige
  // levait un ReferenceError et ne faisait rien.
  it("réinitialise la partie et crédite les chips", async () => {
    await startGame((s) => {
      s.cookies = 5e6;
      s.lifetime = 9e6; // 3 chips
      s.items = { oven: 20 };
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Prestige/i }));
    });

    const prestigeButton = screen.getByRole("button", { name: /Renaître/i });
    expect(prestigeButton.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(prestigeButton);
    });

    expect(window.confirm).toHaveBeenCalled();
    // La partie repart de zéro et 3 chips sont crédités
    expect(screen.getByText(/👆 Clics :/).textContent).toContain("0");
    const chipTiles = screen.getAllByText("3", { selector: ".text-lg" });
    expect(chipTiles.length).toBeGreaterThan(0);
  });

  it("achète un nœud de l'arbre céleste", async () => {
    await startGame((s) => {
      s.lifetime = 5e6;
      s.prestige = { chips: 20, spent: 0, upgrades: {} };
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /Prestige/i }));
    });
    const buttons = screen.getAllByRole("button", { name: /Améliorer/i });
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(screen.getAllByText(/1\/20/).length).toBeGreaterThan(0);
  });
});

describe("réinitialisation", () => {
  // Régression: `setRainCrumbs`/`setRainUntil` n'existaient pas; le handler
  // levait un ReferenceError après avoir effacé le localStorage, laissant le
  // jeu dans un état incohérent.
  it("remet la partie à zéro sans lever d'erreur", async () => {
    await startGame((s) => {
      s.cookies = 999_999;
      s.items = { oven: 10 };
      s.stats.clicks = 500;
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Réglages/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /Réinitialiser/i }));
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByText(/👆 Clics :/).textContent).toContain("0");
  });
});

describe("crypto", () => {
  it("achète du CRMB au marché", async () => {
    await startGame((s) => {
      s.cookies = 1e9;
      s.lifetime = 1e9;
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /CRMB/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Acheter/i }));
    });
    expect(screen.getByText(/Acheté .* CRMB/)).toBeTruthy();
  });

  it("bloque le retrait d'une position verrouillée", async () => {
    await startGame((s) => {
      s.cookies = 1e9;
      s.crypto.balance = 5;
      s.crypto.positions = [
        { id: "p1", amount: 1, tierId: "long", startedAt: Date.now(), unlockAt: Date.now() + 86_400_000 },
      ];
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /CRMB/i }));
    });
    const locked = screen.getByRole("button", { name: /Verrouillé/i });
    expect(locked.disabled).toBe(true);
  });
});

describe("sauvegarde", () => {
  it("persiste la partie au démontage", async () => {
    const { unmount } = await startGame((s) => (s.cookies = 777));
    await clickCookie();
    await act(async () => {
      unmount();
    });
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(saved.stats.clicks).toBeGreaterThanOrEqual(1);
    expect(saved.cookies).toBeGreaterThan(777);
  });

  it("ne sérialise jamais les notifications", async () => {
    const { unmount } = await startGame();
    await act(async () => {
      unmount();
    });
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(saved.toasts).toEqual([]);
  });
});

describe("robustesse", () => {
  it("démarre sur une sauvegarde corrompue", async () => {
    localStorage.setItem(SAVE_KEY, "{ ceci n'est pas du json");
    render(<CookieCraze />);
    await act(async () => {});
    expect(screen.getByText("COOKIE CRAZE")).toBeTruthy();
  });

  it("survit à un localStorage indisponible", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("accès refusé");
    });
    render(<CookieCraze />);
    await act(async () => {});
    expect(screen.getByText("COOKIE CRAZE")).toBeTruthy();
    spy.mockRestore();
  });
});
