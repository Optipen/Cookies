import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import CookieCraze from "../components/CookieCraze.jsx";
import { productionStats, deriveStats } from "../utils/selectors.js";
import { createFreshState, SAVE_KEY } from "../utils/state.js";
import { RATE_WINDOW_MS, RATE_IDLE_MS } from "../hooks/useClickRate.js";
import { CREDIT_MAX_CPS } from "../utils/rate.js";
import { SHARE_BASE } from "../data/upgrades.js";
import { onGrid, snapDown } from "../utils/grid.js";

const LATER = 6e5;
const partie = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  mutate(s);
  return s;
};

// ============================================================================
// Les cinq chiffres, calculés
// ============================================================================

describe("les cinq chiffres", () => {
  const s = partie((x) => (x.items = { oven: 40, bakery: 20, cursor: 30, grandma: 15 }));
  const d = deriveStats(s, LATER, 0);

  it("s'éteignent proprement au repos", () => {
    // Sans les doigts, il ne reste que le minage. La colonne du milieu doit
    // valoir zéro, et le total doit valoir le minage EXACTEMENT — pas « à peu
    // près », pas « à 0,3 près ».
    const c = productionStats(d, 0);
    expect(c.prodClics).toBe(0);
    expect(c.total).toBe(c.minage);
    expect(c.total).toBe(d.mining);
    expect(c.actif).toBe(false);
  });

  it("restent égaux au minage pour toute cadence nulle ou aberrante", () => {
    for (const cadence of [0, -1, NaN, undefined, null, "abc"]) {
      const c = productionStats(d, cadence);
      expect(c.total, `cadence ${cadence}`).toBe(d.mining);
      expect(c.prodClics).toBe(0);
    }
  });

  it("ne comptent jamais le minage deux fois", () => {
    // La part reversée fait qu'un Mineur augmente AUSSI la puissance de clic.
    // Ce n'est pas le même minage recompté: c'est un gain supplémentaire, versé
    // à chaque clic, dans une autre unité. La preuve: à cadence nulle il
    // disparaît complètement, et le total retombe au minage seul.
    // La part reversée est posée sur la grille AVANT d'entrer dans le clic:
    // 6 % du minage est un nombre quelconque, l'écran n'en montre jamais.
    expect(d.sharedClick).toBe(snapDown(d.baseMining * SHARE_BASE));
    expect(onGrid(d.sharedClick)).toBe(true);
    expect(productionStats(d, 0).total).toBe(d.mining);

    // Et à cadence non nulle, l'écart au minage vaut exactement ce que les
    // clics rapportent — rien de plus, rien de moins.
    const c = productionStats(d, 4);
    expect(c.total - c.minage).toBeCloseTo(d.perClick * 4, 9);
    expect(c.prodClics).toBeCloseTo(d.perClick * 4, 9);
  });

  it("font du « par clic » le gain réel d'un appui, combo compris", () => {
    for (const streak of [0, 12, 24, 36]) {
      const stats = deriveStats(s, LATER, streak);
      const c = productionStats(stats, 5);
      expect(c.parClic).toBe(stats.perClick);
      // Le produit par le combo est replié sur la grille, plancher au « sans
      // combo »: ce qui s'affiche est ce qui est crédité, au quart près.
      expect(c.parClic).toBe(snapDown(stats.perClickNoCombo * stats.combo, stats.perClickNoCombo));
      expect(onGrid(c.parClic)).toBe(true);
    }
  });

  it("se lisent comme une phrase: puissance × cadence = production des clics", () => {
    const c = productionStats(d, 3);
    expect(c.prodClics).toBeCloseTo(c.parClic * c.cadence, 9);
    expect(c.total).toBeCloseTo(c.minage + c.prodClics, 9);
  });

  it("ne comptent que les clics crédités", () => {
    // Annoncer 50 clics/s de production quand le jeu n'en crédite que quinze
    // serait une promesse que la banque ne tient pas. Et afficher « 50 /s »
    // à côté de « 12 par clic » ferait multiplier deux nombres qui ne se
    // multiplient pas.
    const brute = productionStats(d, 50);
    const bornee = productionStats(d, CREDIT_MAX_CPS);
    expect(brute.creditee).toBe(CREDIT_MAX_CPS);
    expect(brute.prodClics).toBe(bornee.prodClics);
    expect(brute.total).toBe(bornee.total);
    // La cadence brute reste connue: c'est elle qui déclenche l'avertissement.
    expect(brute.cadence).toBe(50);
    expect(brute.bornee).toBe(true);
    expect(bornee.bornee).toBe(false);
  });

  it("gardent la phrase vraie même quand la cadence est bornée", () => {
    const c = productionStats(d, 50);
    expect(c.prodClics).toBeCloseTo(c.parClic * c.creditee, 9);
    expect(c.total).toBeCloseTo(c.minage + c.prodClics, 9);
  });

  it("restent finis sur un empire démesuré", () => {
    const enorme = partie((x) => (x.items = { portal: 1e6, singularity: 1e6 }));
    const c = productionStats(deriveStats(enorme, LATER, 36), 15);
    for (const v of [c.parClic, c.cadence, c.prodClics, c.minage, c.total]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("valent zéro partout sur une partie neuve, sauf le clic de base", () => {
    const neuf = deriveStats(partie(), LATER, 0);
    const c = productionStats(neuf, 0);
    expect(c.minage).toBe(0);
    expect(c.prodClics).toBe(0);
    expect(c.total).toBe(0);
    expect(c.parClic).toBe(1); // on gagne toujours au moins un cookie par clic
  });
});

// ============================================================================
// Les cinq chiffres, à l'écran
// ============================================================================

const demarrer = async (mutate = () => {}) => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(partie(mutate)));
  const r = render(<CookieCraze />);
  await act(async () => {});
  return r;
};

const cliquer = async (n = 1, pasMs = 200) => {
  const cookie = screen.getByRole("button", { name: /Cliquer le cookie/i });
  for (let i = 0; i < n; i++) {
    await act(async () => {
      fireEvent.click(cookie);
      vi.advanceTimersByTime(pasMs);
    });
  }
};

describe("les cinq chiffres à l'écran", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("affiche les cinq intitulés", async () => {
    await demarrer((x) => (x.items = { oven: 20, cursor: 10 }));
    for (const libelle of ["Par clic", "Cadence", "Clics", "Minage", "Total"]) {
      expect(screen.getAllByText(new RegExp(libelle, "i")).length, libelle).toBeGreaterThan(0);
    }
  });

  it("montre une cadence éteinte tant qu'on ne clique pas", async () => {
    await demarrer((x) => (x.items = { oven: 20 }));
    expect(screen.getByTestId("stat-cadence").textContent).toContain("—");
    expect(screen.getByTestId("stat-clics").textContent).toContain("0");
  });

  it("allume la cadence dès qu'on clique, avec le signe « environ »", async () => {
    await demarrer((x) => (x.items = { oven: 20 }));
    await cliquer(6, 200);
    await act(async () => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("stat-cadence").textContent).toContain("≈");
  });

  it("éteint la cadence et la production des clics après une pause", async () => {
    await demarrer((x) => (x.items = { oven: 20 }));
    await cliquer(6, 200);
    await act(async () => vi.advanceTimersByTime(RATE_IDLE_MS + RATE_WINDOW_MS + 500));
    expect(screen.getByTestId("stat-cadence").textContent).toContain("—");
    expect(screen.getByTestId("stat-clics").textContent).toContain("0");
    // Au repos, le total affiché est exactement le minage affiché.
    expect(screen.getByTestId("stat-total").textContent).toBe(screen.getByTestId("stat-minage").textContent);
  });

  it("ne parle jamais de CPC ni de CPS", async () => {
    const { container } = await demarrer((x) => (x.items = { oven: 20, cursor: 10 }));
    expect(container.textContent).not.toMatch(/\bCPC\b/);
    expect(container.textContent).not.toMatch(/\bCPS\b/);
  });
});
