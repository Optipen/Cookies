// === Ce que l'écran doit rendre au joueur ===
//
// Trois défauts de la même famille, tous vérifiés en navigateur avant d'être
// corrigés: le jeu récompensait bien, mais il le disait mal ou pas du tout.
//
//   1. le BANDEAU n'avait qu'un emplacement, et trois systèmes écrivaient
//      dedans. Pendant le tutoriel, le deuxième chassait le premier au bout de
//      quelques dixièmes de seconde: un débutant dépassait Flocon sans jamais
//      voir « Flocon dépassé »;
//   2. le DIALOGUE de Renaissance — le geste le plus intimidant du jeu —
//      n'énumérait pas ce qui survit, alors que ceux de l'Ascension et de la
//      réinitialisation le font;
//   3. la SÉRIE quotidienne, la seule chose du jeu qui parle de demain, vivait
//      uniquement dans un onglet que personne n'ouvre de lui-même.

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import CookieCraze from "../components/CookieCraze.jsx";
import { SAVE_KEY, createFreshState } from "../utils/state.js";
import { createFileBannieres, MAX_BANNIERES } from "../utils/bannieres.js";
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
  s.lastTs = Date.now();
  mutate(s);
  return s;
};

const demarrer = async (etat) => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(etat));
  const utils = render(<CookieCraze />);
  await act(async () => {});
  return utils;
};

// ===========================================================================

describe("les bandeaux font la queue", () => {
  it("garde les deux, dans l'ordre, plutôt que d'écraser le premier", () => {
    const f = createFileBannieres();
    expect(f.push({ title: "Étape franchie", sub: "Appuie sur le cookie" })).toBe(true);
    expect(f.push({ title: "Flocon dépassé", sub: "+1 CRMB" })).toBe(true);
    expect(f.taille()).toBe(2);
    expect(f.shift().title).toBe("Étape franchie");
    expect(f.shift().title).toBe("Flocon dépassé");
    expect(f.shift()).toBeNull();
  });

  it("écarte un doublon exact, qui n'est jamais deux événements", () => {
    const f = createFileBannieres();
    f.push({ title: "Flocon dépassé", sub: "+1 CRMB" });
    expect(f.push({ title: "Flocon dépassé", sub: "+1 CRMB" })).toBe(false);
    expect(f.taille()).toBe(1);
    // Même titre, autre sous-titre: deux vrais événements.
    expect(f.push({ title: "Flocon dépassé", sub: "+2 CRMB" })).toBe(true);
  });

  it("plafonne la file: en fêter huit d'affilée n'est plus une fête", () => {
    const f = createFileBannieres();
    for (let i = 0; i < 20; i++) f.push({ title: `t${i}` });
    expect(f.taille()).toBe(MAX_BANNIERES);
  });

  it("refuse ce qui n'a pas de titre plutôt que d'afficher un bandeau vide", () => {
    const f = createFileBannieres();
    expect(f.push({})).toBe(false);
    expect(f.push()).toBe(false);
    expect(f.taille()).toBe(0);
  });
});

describe("le dialogue de Renaissance énumère ce qui reste", () => {
  it("nomme ce qu'on perd ET tout ce qu'on garde", async () => {
    await demarrer(
      neuf((s) => {
        s.lifetime = PRESTIGE_MIN_LIFETIME * 4;
        s.cookies = 1e6;
      })
    );
    await act(async () => {
      screen.getByRole("tab", { name: "Prestige" }).click();
    });
    const bouton = await screen.findByRole("button", { name: /Renaître/ });
    await act(async () => {
      bouton.click();
    });

    const dialogue = screen.getByTestId("confirmation").textContent;
    // Ce qui part.
    expect(dialogue).toMatch(/tes cookies, tes bâtiments et tes améliorations/i);
    // Et ce qui reste — la liste que l'ancien texte passait sous silence.
    for (const garde of [/chips célestes/i, /étoiles/i, /CRMB/i, /apparences/i, /succès/i, /compteurs à vie/i, /Classement/i]) {
      expect(dialogue, String(garde)).toMatch(garde);
    }
  }, 15000);
});

describe("la série quotidienne est visible sans ouvrir d'onglet", () => {
  it("n'affiche rien tant qu'il n'y a pas de série à protéger", async () => {
    await demarrer(neuf());
    expect(screen.queryByTestId("serie")).toBeNull();
  });

  it("l'affiche dès le premier jour, et dit à quoi elle sert", async () => {
    await demarrer(neuf((s) => (s.quests.streak = 3)));
    const pastille = screen.getByTestId("serie");
    expect(pastille.textContent).toMatch(/3 j/);
    expect(pastille.getAttribute("title")).toMatch(/quotidienne/i);
  });

  it("emmène aux quêtes d'un appui", async () => {
    await demarrer(neuf((s) => (s.quests.streak = 2)));
    await act(async () => {
      screen.getByTestId("serie").click();
    });
    expect(screen.getByRole("tab", { name: "Quêtes" }).getAttribute("aria-selected")).toBe("true");
  });
});
