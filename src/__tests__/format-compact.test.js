// === La règle définitive des nombres — volet affichage compact ===
//
// Principe: **une seule unité par palier, trois chiffres significatifs,
// tronqués.** « 1,23M », jamais « 1 230K ».
//
// L'ancienne règle refusait toute décimale derrière un suffixe et descendait
// d'un cran pour l'éviter. La suite affichée sautait alors d'une unité à
// l'autre et revenait en arrière — 999K → 1M → 1 100K → 1 200K → 2M → 2 500K —
// et « 2 000K » pour deux millions ne se lit pas comme une progression. Ce que
// ce fichier verrouille désormais:
//
//   1. l'unité ne redescend JAMAIS quand le nombre monte;
//   2. le compact ne franchit jamais un palier à la place du joueur: à
//      999 999 cookies on n'a pas « 1M »;
//   3. `fmtPrix` reste exact au cookie près, dans l'unité du solde;
//   4. séparateurs français partout, aucune notation anglaise.

import { describe, expect, it } from "vitest";
import {
  fmt,
  fmtInt,
  fmtExact,
  fmtApprox,
  fmtPrix,
  fmtMult,
  fmtCrmb,
  fmtDuration,
  COMPACT_FROM,
} from "../utils/format.js";

// toLocaleString("fr-FR") sépare les milliers par une espace fine insécable.
const espaces = (s) => s.replace(/[\s  ]/g, " ");

const SUFFIXES = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud", "Dd"];
const unite = (texte) => {
  const m = texte.match(/(K|M|B|T|Qa|Qi|Sx|Sp|Oc|No|Dc|Ud|Dd)$/);
  return m ? SUFFIXES.indexOf(m[1]) : -1;
};

describe("le compact tient dans une seule unité", () => {
  it("écrit les millions en millions, décimale comprise", () => {
    expect(fmt(1_000_000)).toBe("1M");
    expect(fmt(1_100_000)).toBe("1,1M");
    expect(fmt(1_200_000)).toBe("1,2M");
    expect(fmt(1_234_567)).toBe("1,23M");
    expect(fmt(2_000_000)).toBe("2M");
    expect(fmt(2_500_000)).toBe("2,5M");
    expect(fmt(20_941_234)).toBe("20,9M");
    expect(fmt(123_456_789)).toBe("123M");
  });

  it("ne descend jamais d'unité quand le nombre monte", () => {
    // Le défaut d'origine, en une propriété: la suite des unités affichées est
    // croissante. « 1M » suivi de « 1 100K » était une régression visible.
    let precedent = -1;
    for (let v = COMPACT_FROM; v < 1e15; v *= 1.017) {
      const u = unite(fmt(v));
      expect(u, `${v} → ${fmt(v)}`).toBeGreaterThanOrEqual(precedent);
      precedent = u;
    }
  });

  it("ne fait jamais reculer le texte d'un compteur qui monte", () => {
    // Deux valeurs croissantes ne peuvent pas donner un affichage décroissant.
    const valeur = (texte) => {
      const u = unite(texte);
      const m = Number(texte.replace(/[^\d,]/g, "").replace(",", "."));
      return m * Math.pow(1000, u + 1);
    };
    let precedent = 0;
    for (let v = COMPACT_FROM; v < 1e21; v *= 1.013) {
      const lu = valeur(fmt(v));
      expect(lu + 1e-6, `${v} → ${fmt(v)}`).toBeGreaterThanOrEqual(precedent);
      precedent = lu;
    }
  });

  it("tronque: on n'annonce jamais un palier qu'on n'a pas atteint", () => {
    expect(fmt(999_999)).toBe("999K");
    expect(fmt(1_999_999)).toBe("1,99M");
    expect(fmt(999_999_999)).toBe("999M");
    // Propriété générale: le nombre relu est toujours ≤ le nombre affiché.
    for (let i = 0; i < 4000; i++) {
      const v = Math.round(Math.exp(Math.random() * 45 + Math.log(COMPACT_FROM)));
      const texte = fmt(v);
      const u = unite(texte);
      if (u < 0) continue;
      const lu = Number(texte.replace(/[^\d,]/g, "").replace(",", ".")) * Math.pow(1000, u + 1);
      expect(lu, `${v} → ${texte}`).toBeLessThanOrEqual(v * (1 + 1e-9));
    }
  });

  it("garde trois chiffres significatifs, et pas un de plus", () => {
    expect(fmt(1_234_567)).toBe("1,23M"); // 1,23 → trois chiffres
    expect(fmt(12_345_678)).toBe("12,3M"); // 12,3 → trois chiffres
    expect(fmt(123_456_789)).toBe("123M"); // 123 → trois chiffres
    // Les zéros de queue tombent: « 2M », pas « 2,00M ».
    expect(fmt(2_000_000)).toBe("2M");
    expect(fmt(1_200_000)).toBe("1,2M");
    expect(fmt(400_000)).toBe("400K");
  });

  it("n'écrit jamais un point anglais ni un séparateur dans la mantisse", () => {
    for (let i = 0; i < 4000; i++) {
      const v = Math.round(Math.exp(Math.random() * 55 + Math.log(COMPACT_FROM)));
      const texte = fmt(v);
      expect(texte, `${v} → ${texte}`).not.toMatch(/\d\.\d/);
      // Une mantisse tient toujours sur trois chiffres: aucun millier à séparer.
      if (unite(texte) >= 0) expect(texte, `${v} → ${texte}`).not.toMatch(/[\s ]/);
    }
  });

  it("traverse les frontières demandées sans accroc", () => {
    expect(fmt(99.75)).toBe("99,75");
    expect(fmt(100)).toBe("100");
    expect(fmt(999)).toBe("999");
    expect(espaces(fmt(1_000))).toBe("1 000");
    expect(espaces(fmt(99_999))).toBe("99 999");
    expect(fmt(100_000)).toBe("100K");
    expect(espaces(fmtInt(99_999))).toBe("99 999");
    expect(fmtInt(100_000)).toBe("100K");
  });

  it("couvre milliards, billions et les extrêmes du jeu", () => {
    expect(fmt(1_910_000_000)).toBe("1,91B");
    expect(fmt(2.5e12)).toBe("2,5T");
    expect(fmt(1e12)).toBe("1T");
    expect(fmt(1.2e19)).toBe("12Qi"); // production d'un an simulé
    expect(fmt(4.4e17)).toBe("440Qa"); // le rival CRUMB-9000 à trente jours
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

describe("fmtPrix: le prix affiché est le prix payé, sans exception", () => {
  it("écrit le nombre plein sous le million", () => {
    expect(espaces(fmtPrix(124_800))).toBe("124 800"); // « 125K » aurait menti de 200
    expect(espaces(fmtPrix(999_999))).toBe("999 999");
    expect(fmtPrix(100)).toBe("100");
  });

  it("compacte au-delà, dans l'unité du solde, et seulement si c'est EXACT", () => {
    expect(fmtPrix(1_248_000)).toBe("1,248M"); // et non « 1 248K »
    expect(fmtPrix(124_800_000)).toBe("124,8M");
    expect(fmtPrix(27_500_000_000)).toBe("27,5B");
    expect(fmtPrix(2_000_000)).toBe("2M");
    expect(fmtPrix(11_750_000)).toBe("11,75M");
  });

  it("préfère le nombre plein à un compact menteur", () => {
    expect(espaces(fmtPrix(1_248_300))).toBe("1 248 300"); // 1,2483M n'existe pas
    expect(espaces(fmtPrix(12_345_678))).toBe("12 345 678");
  });

  it("se lit dans la même unité que le solde juste au-dessus", () => {
    // C'est la raison d'être du changement: comparer « 1 248K » à un solde de
    // « 1,2M » demandait une conversion mentale à chaque achat.
    for (const v of [1_248_000, 7_250_000, 27_500_000_000, 2.75e12]) {
      const prix = fmtPrix(v);
      if (!/\d$/.test(prix)) expect(unite(prix), `${v}`).toBe(unite(fmt(v)));
    }
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

  it("fmtMult sépare les milliers et abrège comme le reste", () => {
    // Le cas entier partait droit sur `String(v)`: un multiplicateur global de
    // fin de partie s'écrivait « ×1500000000 », sans le moindre séparateur.
    expect(fmtMult(1)).toBe("1");
    expect(fmtMult(1.25)).toBe("1,25");
    expect(fmtMult(12.5)).toBe("12,50");
    expect(espaces(fmtMult(1_500))).toBe("1 500");
    expect(espaces(fmtMult(15_000))).toBe("15 000");
    expect(fmtMult(1_234_567)).toBe("1,23M");
    expect(fmtMult(1.5e9)).toBe("1,5B");
  });

  it("fmtCrmb abrège au-delà du seuil, garde le centime en dessous", () => {
    expect(fmtCrmb(18)).toBe("18");
    expect(fmtCrmb(2.5)).toBe("2,5");
    expect(espaces(fmtCrmb(1_234.5))).toBe("1 234,5");
    expect(fmtCrmb(123_456.78)).toBe("123K"); // « 123 456,78 » débordait de la pastille
    expect(fmtCrmb(9.9e7)).toBe("99M");
  });

  it("fmtDuration compte en jours plutôt qu'en centaines d'heures", () => {
    expect(fmtDuration(90_000)).toBe("1m 30s");
    expect(fmtDuration(3_900_000)).toBe("1h 05m");
    expect(fmtDuration(30 * 3600e3)).toBe("1j 06h"); // et non « 30h 00m »
    expect(fmtDuration(5 * 24 * 3600e3)).toBe("5j 00h");
    expect(espaces(fmtDuration(400 * 24 * 3600e3))).toBe("400j 00h");
    // Deux unités au plus, la plus grande d'abord: la même règle que les nombres.
    for (const ms of [1e3, 1e5, 1e7, 1e9, 1e11]) {
      expect(fmtDuration(ms).split(" ").length, `${ms}`).toBeLessThanOrEqual(2);
    }
  });
});
