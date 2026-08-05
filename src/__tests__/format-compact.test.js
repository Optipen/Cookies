// === La règle définitive des nombres — volet affichage compact ===
//
// Principe validé: « 1 910K » plutôt que « 1,91M ». Un suffixe ne porte
// JAMAIS de décimale: quand la mantisse à trois chiffres en aurait, on
// descend d'un suffixe pour retrouver un entier. Un nombre exactement
// représentable (les prix, posés sur 0,25 × 10^k) s'affiche EXACTEMENT.
// Séparateurs français partout, aucune notation anglaise.

import { describe, expect, it } from "vitest";
import { fmt, fmtInt, fmtExact, fmtApprox, COMPACT_FROM } from "../utils/format.js";

// toLocaleString("fr-FR") sépare les milliers par une espace fine insécable.
const espaces = (s) => s.replace(/[\s  ]/g, " ");

describe("le compact préfère un suffixe plus bas à une décimale", () => {
  it("suit les exemples validés à la lettre", () => {
    expect(espaces(fmt(1_910_000))).toBe("1 910K");
    expect(espaces(fmt(20_100_000))).toBe("20 100K");
    expect(espaces(fmt(5_750_000))).toBe("5 750K");
  });

  it("garde le suffixe haut quand la mantisse est entière", () => {
    expect(fmt(25_000_000)).toBe("25M");
    expect(fmt(2_000_000)).toBe("2M");
    expect(fmt(123_000_000)).toBe("123M");
    expect(fmt(1_000_000_000)).toBe("1B");
    expect(fmt(400_000)).toBe("400K");
  });

  it("affiche EXACTEMENT un prix posé sur le quart de son ordre de grandeur", () => {
    // 11 750 000 est un prix légal (0,25 × 10^7 près). « 11,8M » mentirait.
    expect(espaces(fmt(11_750_000))).toBe("11 750K");
    expect(espaces(fmt(99_825_000))).toBe("99 825K");
  });

  it("arrondit à trois chiffres significatifs ce qui n'est pas représentable exactement", () => {
    expect(espaces(fmt(123_456_789))).toBe("123M");
    expect(espaces(fmt(20_941_234))).toBe("20 900K");
    expect(espaces(fmt(1_234_567))).toBe("1 230K");
  });

  it("ne porte jamais ni décimale ni point anglais dans un suffixe", () => {
    for (let i = 0; i < 4000; i++) {
      const v = Math.round(Math.exp(Math.random() * 55 + Math.log(COMPACT_FROM)));
      const texte = fmt(v);
      expect(texte, `${v} → ${texte}`).not.toMatch(/,\d+\s?(K|M|B|T|Qa|Qi|Sx|Sp|Oc|No|Dc|Ud|Dd)/);
      expect(texte, `${v} → ${texte}`).not.toMatch(/\d\.\d/);
    }
  });

  it("traverse les frontières demandées sans accroc", () => {
    expect(fmt(99.75)).toBe("99,75");
    expect(fmt(100)).toBe("100");
    expect(fmt(999)).toBe("999");
    expect(espaces(fmt(1_000))).toBe("1 000");
    expect(espaces(fmt(99_999))).toBe("99 999");
    expect(espaces(fmt(100_000))).toBe("100K");
    expect(espaces(fmtInt(99_999))).toBe("99 999");
    expect(espaces(fmtInt(100_000))).toBe("100K");
  });

  it("couvre milliards, billions et les extrêmes du jeu", () => {
    expect(espaces(fmt(1_910_000_000))).toBe("1 910M");
    expect(espaces(fmt(2.5e12))).toBe("2 500B");
    expect(fmt(1e12)).toBe("1T");
    expect(fmt(1.2e19)).toBe("12Qi"); // production d'un an simulé: mantisse entière, suffixe haut
    // Au-delà du dernier suffixe: notation scientifique à virgule française.
    const extreme = fmt(1e46);
    expect(extreme).toMatch(/e\+/);
    expect(extreme).toContain(",");
  });

  it("ne montre jamais de décimale à partir de cent, hors suffixe comme dans le plein", () => {
    expect(fmt(401)).toBe("401");
    expect(fmt(401.0)).toBe("401");
    // Sous cent, les quarts s'affichent tels quels, zéros inutiles retirés.
    expect(fmt(1.25)).toBe("1,25");
    expect(fmt(2.5)).toBe("2,5");
    expect(fmt(20.75)).toBe("20,75");
    expect(fmt(1)).toBe("1");
  });
});

describe("les autres formateurs suivent la même règle", () => {
  it("fmtExact reste plein et français", () => {
    expect(espaces(fmtExact(80_000))).toBe("80 000");
    expect(fmtExact(0.25)).toBe("0,25");
  });

  it("fmtApprox préfixe ≈ sans changer la forme", () => {
    expect(fmtApprox(4.25)).toBe("≈4,25");
    expect(fmtApprox(4)).toBe("≈4");
  });
});
