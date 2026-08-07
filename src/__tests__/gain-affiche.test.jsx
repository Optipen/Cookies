// === Ce qu'une carte de boutique annonce ===
//
// Elle annonçait l'ÉCART entre les deux totaux, et cet écart mentait de deux
// façons opposées. La règle des nombres pose les totaux sur des entiers dès
// cent: de 99,75 à 599, l'écart brut vaut 499,25 — un nombre qui n'existe pas
// dans ce jeu. Et au-delà de cent par clic, un Curseur à 0,25 faisait passer la
// somme de 101 à 101,25, pliée à 101: la carte affichait « +0 /clic » sur un
// bouton qui demandait de payer.
//
// Elle annonce désormais la VALEUR UNITAIRE — ce qu'un exemplaire ajoute
// réellement à la somme, paliers et bonus compris. C'est la règle que le projet
// s'était donnée dès le départ: « la quantification se fait par exemplaire,
// c'est le gain unitaire que la boutique annonce ». Le détail avant → après
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
  it("annonce la valeur unitaire, jamais un écart qui n'existe pas", () => {
    // 395 Curseurs: puissance 99,75. Une IA de frappe vaut +500 par clic, et
    // c'est ce qu'elle annonce — pas l'écart 499,25 entre les deux totaux.
    const s = partie((x) => {
      x.items = { cursor: 395 };
      x.cookies = 10;
      x.lifetime = 1e9;
    });
    render(<Shop state={s} filter="click" onBuy={() => {}} qty={1} stats={deriveStats(s, 0, 0)} />);
    const texte = document.body.textContent;
    expect(texte).not.toMatch(/499,25|499,75|499,5\b/);
    expect(texte).toContain("+500");
  });

  it("n'annonce JAMAIS « +0 » sur un bâtiment qui rapporte quelque chose", () => {
    // Le défaut, et il était permanent: au-delà de cent par clic, la règle des
    // entiers avalait les 0,25 du Curseur et sa carte — la première de la
    // liste, celle que le Guide fait acheter — affichait « +0 /clic » sur un
    // bouton payant. Rien n'était perdu dans le moteur (quatre Curseurs font
    // bien +1), mais l'écran demandait de payer pour rien.
    const s = partie((x) => {
      x.items = { grandma: 100 }; // puissance de clic à 101: au-delà de cent
      x.cookies = 1e9;
      x.lifetime = 1e9;
    });
    render(<Shop state={s} filter="click" onBuy={() => {}} qty={1} stats={deriveStats(s, 0, 0)} />);
    const texte = document.body.textContent;
    expect(texte).not.toMatch(/\+0\s*\/clic/);
    expect(texte).toContain("+0,25");
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
