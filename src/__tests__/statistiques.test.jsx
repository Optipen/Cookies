import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import CookieCraze from "../components/CookieCraze.jsx";
import { productionStats, deriveStats } from "../utils/selectors.js";
import { createFreshState, SAVE_KEY } from "../utils/state.js";
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

    // Et à cadence non nulle, l'écart au minage vaut ce que les clics
    // rapportent, POSÉ SUR LA RÈGLE des valeurs: la production des clics est
    // « par clic × cadence affichée » replié (quarts sous cent, entiers dès
    // cent), et le total replie la somme — c'est pour cela que la ligne
    // active porte un « ≈ ».
    const c = productionStats(d, 4);
    expect(c.prodClics).toBe(snapDown(d.perClick * 4));
    expect(c.total).toBe(snapDown(c.minage + c.prodClics));
  });

  it("restent sur la grille même sous un buff en quarts", () => {
    // Les récompenses de quêtes multiplient par ×1,5 ou ×2,25: grille × 1,5
    // quitte la grille. Minage et clic replient le produit avant l'écran.
    const s2 = partie((x) => {
      x.items = { oven: 13, grandma: 7, cursor: 9 };
      x.buffs = { cpsMulti: 1.5, cpcMulti: 2.25, until: LATER + 10_000, label: "×1,5 minage" };
    });
    const d2 = deriveStats(s2, LATER, 24);
    expect(onGrid(d2.mining), `minage ${d2.mining}`).toBe(true);
    expect(onGrid(d2.perClickNoCombo), `puissance ${d2.perClickNoCombo}`).toBe(true);
    expect(onGrid(d2.perClick), `parClic ${d2.perClick}`).toBe(true);
    expect(d2.mining).toBe(snapDown(d2.baseMining * 1.5));
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

  it("se lisent comme une phrase: puissance × cadence affichée = production des clics", () => {
    const c = productionStats(d, 3);
    expect(c.cadenceAffichee).toBe(3);
    expect(c.prodClics).toBe(snapDown(c.parClic * c.cadenceAffichee));
    expect(c.total).toBe(snapDown(c.minage + c.prodClics));
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
    expect(c.cadenceAffichee).toBe(c.creditee);
    expect(c.prodClics).toBe(snapDown(c.parClic * c.cadenceAffichee));
    expect(c.total).toBe(snapDown(c.minage + c.prodClics));
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

describe("l'écran ne montre que ce sur quoi le joueur agit", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("affiche la banque, le gain par clic et le minage — et rien d'autre en /s", async () => {
    await demarrer((x) => (x.items = { oven: 20, cursor: 10 }));
    expect(screen.getByTestId("solde")).toBeTruthy();
    expect(screen.getByTestId("stat-par-clic")).toBeTruthy();
    expect(screen.getByTestId("stat-minage")).toBeTruthy();
    for (const libelle of ["Par clic", "Minage"]) {
      expect(screen.getAllByText(new RegExp(libelle, "i")).length, libelle).toBeGreaterThan(0);
    }
  });

  it("ne montre plus la cadence, la production des clics ni le total", async () => {
    // Cinq nombres dont trois bougeaient en permanence, pour répondre à une
    // question qu'un joueur qui découvre ne se pose pas encore. Ils ont
    // disparu de l'écran — le moteur, lui, les calcule toujours.
    const { container } = await demarrer((x) => (x.items = { oven: 20, cursor: 10 }));
    expect(screen.queryByTestId("stat-cadence")).toBeNull();
    expect(screen.queryByTestId("stat-clics")).toBeNull();
    expect(screen.queryByTestId("stat-total")).toBeNull();
    expect(container.textContent).not.toMatch(/Cadence(?!\s+créditée)/i);
  });

  it("n'écrit plus le même nombre dans l'en-tête ET dans la scène", async () => {
    // « Par clic » et « Minage » vivaient aux deux endroits: le même nombre à
    // deux centimètres d'écart. L'en-tête ne garde que ce que la scène ne
    // montre pas — les chips et le CRMB.
    const { container } = await demarrer((x) => (x.items = { oven: 20, cursor: 10 }));
    const entete = within(container.querySelector("header"));
    expect(entete.queryByText(/Par clic/i)).toBeNull();
    expect(entete.queryByText(/Minage/i)).toBeNull();
    // Et la scène, elle, les porte bien une fois chacun.
    expect(screen.getAllByText(/^Par clic$/i).length).toBe(1);
  });

  it("garde le gain par clic vivant quand on clique", async () => {
    await demarrer((x) => (x.items = { oven: 20, cursor: 10 }));
    const avant = screen.getByTestId("stat-par-clic").textContent;
    await cliquer(14, 90);
    await act(async () => vi.advanceTimersByTime(300));
    // Le combo monte: le gain par clic affiché doit suivre, c'est le seul
    // retour visuel qui reste sur l'action de cliquer.
    expect(screen.getByTestId("stat-par-clic").textContent).not.toBe(avant);
  });

  it("prévient encore quand les clics cessent d'être crédités", async () => {
    // La cadence a disparu de l'écran, pas du moteur: un joueur dont les clics
    // ne comptent plus doit continuer de l'apprendre.
    await demarrer((x) => (x.items = { oven: 20 }));
    await cliquer(40, 8);
    await act(async () => vi.advanceTimersByTime(400));
    expect(screen.getByText(new RegExp(`limitée à ${CREDIT_MAX_CPS} clics/s`, "i"))).toBeTruthy();
  });

  it("ne parle jamais de CPC ni de CPS", async () => {
    const { container } = await demarrer((x) => (x.items = { oven: 20, cursor: 10 }));
    expect(container.textContent).not.toMatch(/\bCPC\b/);
    expect(container.textContent).not.toMatch(/\bCPS\b/);
  });
});
