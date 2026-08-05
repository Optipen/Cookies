// === Le gain affiché d'un achat franchissant cent est plié sur la règle ===
//
// Avant l'achat: 99,75 (quart légal). Après: 599 (entier légal). L'écart brut
// vaut 499,25 — un nombre qui n'existe pas dans ce jeu. La carte de boutique
// et le panneau d'améliorations plient l'écart AFFICHÉ; le détail avant → après
// reste exact pour qui veut vérifier.

import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Shop from "../components/Shop.jsx";
import { createFreshState } from "../utils/state.js";
import { deriveStats } from "../utils/selectors.js";

const partie = (patch) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  patch?.(s);
  return s;
};

const surLaRegle = (v) =>
  v < 100 ? Math.abs(v * 4 - Math.round(v * 4)) < 1e-9 : Number.isInteger(v);

describe("les gains affichés en boutique restent sur la règle", () => {
  it("plie l'écart d'un achat qui franchit cent", () => {
    // 395 Curseurs: puissance 99,75. Une IA de frappe (+500) porte à 599.
    const s = partie((x) => {
      x.items = { cursor: 395 };
      x.cookies = 10;
      x.lifetime = 1e9;
    });
    render(<Shop state={s} filter="click" onBuy={() => {}} qty={1} stats={deriveStats(s, 0, 0)} />);
    // La carte IA de frappe annonce son gain: jamais « 499,25 ».
    const texte = document.body.textContent;
    expect(texte).not.toMatch(/499,25|499,75|499,5\b/);
    expect(texte).toContain("+499");
  });

  it("tout gain rendu par les cartes est un nombre de la règle", () => {
    const s = partie((x) => {
      x.items = { cursor: 395, oven: 3 };
      x.cookies = 1e7;
      x.lifetime = 1e9;
    });
    render(<Shop state={s} filter="all" onBuy={() => {}} qty={1} stats={deriveStats(s, 0, 0)} />);
    const gains = [...document.querySelectorAll("[data-shop] span.block")].map((el) => el.textContent);
    for (const g of gains) {
      const m = g.replace(/[\s  ]/g, " ").match(/\+([\d ]+(?:,\d+)?)/);
      if (!m) continue;
      const v = parseFloat(m[1].replace(/ /g, "").replace(",", "."));
      expect(surLaRegle(v), `gain affiché « ${g.trim()} » → ${v}`).toBe(true);
    }
    expect(gains.length).toBeGreaterThan(3);
  });
});
