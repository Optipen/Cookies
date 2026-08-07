// === Plus j'en achète, plus chacun rapporte ===
//
// Le retour du joueur, mot pour mot: « tu achètes la première fois le curseur
// et ça donne +0,25 ; si tu l'achètes au bout de quatre, cinq fois, ça doit te
// donner plus. » Il avait raison sur le ressenti, et le mécanisme qui répond à
// ça existait déjà — le PALIER, qui double la valeur d'un bâtiment. Il arrivait
// au dixième exemplaire, et il vivait dans un autre onglet: rien, sur la carte
// qu'on regarde en achetant, ne disait qu'il approchait.
//
// Ce que ces tests verrouillent:
//
//   1. le premier palier tombe à CINQ, et le cumul reste identique à partir de
//      dix — sinon tout le jeu devient deux fois plus fort pour toujours;
//   2. la carte de boutique MONTRE le palier qui approche;
//   3. elle annonce la valeur unitaire, jamais « +0 ».

import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Shop from "../components/Shop.jsx";
import { createFreshState } from "../utils/state.js";
import { deriveStats } from "../utils/selectors.js";
import { unitValue } from "../utils/calc.js";
import { tierThreshold, tierMultiplier, nextTierFor, TIER_FIRST, TIER_SECOND } from "../data/upgrades.js";
import { ITEM_BY_ID } from "../data/items.js";

afterEach(cleanup);

const partie = (patch) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  s.cookies = 1e9;
  s.lifetime = 1e9;
  patch?.(s);
  return s;
};

const boutique = (s, filter = "click") =>
  render(<Shop state={s} filter={filter} onBuy={() => {}} qty={1} stats={deriveStats(s, 0, 0)} />);

// ===========================================================================

describe("l'échelle des paliers", () => {
  it("place le premier à cinq exemplaires", () => {
    expect(TIER_FIRST).toBe(5);
    expect(tierThreshold(0)).toBe(5);
  });

  it("garde le jeu strictement identique à partir du dixième", () => {
    // C'est la contrainte qui a décidé de la forme. Le seuil suivant reste à
    // vingt: un palier de plus à CHAQUE étage aurait ajouté un doublement
    // permanent, et le rapport actif/passif serait tombé de 2,43 à 2,32 sur
    // les dix premières minutes.
    expect(TIER_SECOND).toBe(20);
    const cumul = (owned) =>
      [0, 1, 2, 3, 4, 5, 6].reduce((m, n) => (tierThreshold(n) <= owned ? m * tierMultiplier(n) : m), 1);
    expect(cumul(4)).toBe(1);
    expect(cumul(5)).toBe(2); // le gain, et il est là où il manquait
    expect(cumul(10)).toBe(2);
    expect(cumul(20)).toBe(4);
    expect(cumul(80)).toBe(16);
  });

  it("double vraiment la valeur unitaire du Curseur, sans quitter la grille", () => {
    // 0,25 × 2 = 0,50: le nombre que le joueur attendait. Un multiplicateur
    // fractionnaire (×1,5) aurait donné 0,375, plié à 0,25 par la grille des
    // quarts — un palier payé qui ne fait littéralement rien.
    const cursor = ITEM_BY_ID.cursor;
    expect(unitValue(cursor, 1, 1)).toBe(0.25);
    expect(unitValue(cursor, tierMultiplier(0), 1)).toBe(0.5);
  });

  it("nomme le prochain palier de chaque bâtiment", () => {
    const s = partie((x) => (x.items = { cursor: 3 }));
    const p = nextTierFor(s, "cursor");
    expect(p.threshold).toBe(5);
    expect(p.remaining).toBe(2);
    expect(p.pret).toBe(false);
    expect(p.multiplier).toBe(2);

    const atteint = nextTierFor(partie((x) => (x.items = { cursor: 7 })), "cursor");
    expect(atteint.pret).toBe(true);
    expect(atteint.remaining).toBe(0);

    // Palier déjà acheté: on passe au suivant.
    const suivant = nextTierFor(
      partie((x) => {
        x.items = { cursor: 7 };
        x.upgrades = { "tier:cursor:0": true };
      }),
      "cursor"
    );
    expect(suivant.threshold).toBe(20);
  });

  it("répond null pour un bâtiment qui n'existe pas", () => {
    expect(nextTierFor(partie(), "nimportequoi")).toBeNull();
  });
});

describe("la carte de boutique montre que le prochain vaudra plus", () => {
  it("affiche le palier qui approche, et de combien", () => {
    boutique(partie((x) => (x.items = { cursor: 3 })));
    const badge = screen.getByTestId("palier-cursor");
    expect(badge.textContent).toBe("×2 dans 2");
  });

  it("bascule en appel à l'action une fois le seuil atteint", () => {
    boutique(partie((x) => (x.items = { cursor: 5 })));
    expect(screen.getByTestId("palier-cursor").textContent).toBe("×2 à prendre");
  });

  it("annonce la valeur unitaire réelle, paliers compris", () => {
    // Cinq Curseurs et le palier acheté: chacun vaut 0,50, et la carte le dit.
    boutique(
      partie((x) => {
        x.items = { cursor: 6 };
        x.upgrades = { "tier:cursor:0": true };
      })
    );
    const carte = document.getElementById("item-cursor");
    expect(carte.textContent.replace(/[\s ]+/g, " ")).toContain("+0,5 /clic");
  });

  it("ne montre rien de trompeur sur un bâtiment jamais acheté", () => {
    boutique(partie());
    const badge = screen.getByTestId("palier-cursor");
    expect(badge.textContent).toBe("×2 dans 5");
  });
});
