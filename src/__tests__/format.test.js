import { describe, it, expect } from "vitest";
import {
  fmt,
  fmtInt,
  fmtExact,
  fmtMult,
  fmtApprox,
  fmtPct,
  fmtDuration,
  fmtClock,
  fmtCrmb,
  clamp,
  LOCALE,
  COMPACT_FROM,
} from "../utils/format.js";
import { STEP, snap } from "../utils/grid.js";
import { ITEMS } from "../data/items.js";
import { COMBO } from "../utils/combo.js";

// La locale fr-FR sépare les milliers par une espace insécable étroite (U+202F)
// et non par une espace ordinaire. On normalise avant de comparer.
const esp = (s) => String(s).replace(/[\u202f\u00a0\s]/g, " ");
const relire = (s) => Number(esp(s).replace(/ /g, "").replace(",", "."));

describe("un nombre affiché est le nombre calculé", () => {
  it("n'ampute jamais une valeur exacte de sa dernière décimale", () => {
    // Le défaut nommé: 401,75 s'affichait « 401,8 » — une décimale supprimée
    // sur une valeur qui en avait deux, et deux valeurs différentes finissaient
    // par s'écrire pareil.
    expect(fmt(401.75)).toBe("401,75");
    expect(fmt(401.5)).toBe("401,5");
    expect(fmt(401.25)).toBe("401,25");
    expect(fmt(401.75)).not.toBe(fmt(401.5));
    expect(fmt(401.75)).not.toBe("401,7");
    expect(fmt(401.75)).not.toBe("401,8");
  });

  it("écrit exactement toutes les valeurs de la grille sous mille", () => {
    for (let k = 1; k * STEP < 1000; k++) {
      const v = snap(k * STEP);
      expect(relire(fmt(v)), `${v} → ${fmt(v)}`).toBeCloseTo(v, 9);
    }
  });

  it("préfère « 1 720 » à « 1,72K »", () => {
    // Une abréviation qui fabrique une décimale là où le nombre n'en avait pas
    // rend le nombre moins lisible, pas plus.
    expect(esp(fmt(1720))).toBe("1 720");
    expect(esp(fmt(12345))).toBe("12 345");
    expect(fmt(1720)).not.toContain("K");
  });

  it("reste compact pour les très grands nombres — sans décimale dans le suffixe", () => {
    // Règle définitive: « 1 910K » plutôt que « 1,91M ». Une mantisse qui
    // aurait une virgule descend d'un suffixe pour redevenir entière.
    expect(esp(fmt(1_234_567))).toBe("1 230K");
    expect(esp(fmt(12_345_678))).toBe("12 300K");
    expect(fmt(123_456_789)).toBe("123M");
    expect(esp(fmt(1.5e12))).toBe("1 500B");
  });

  it("ne fabrique jamais « 1 000K » en arrondissant vers le haut", () => {
    expect(fmt(999_999_999)).toBe("1B");
    expect(fmt(999_999)).not.toContain("K");
    for (let e = 5; e < 40; e++) {
      for (const m of [0.999999, 1, 9.999999]) {
        const texte = fmt(m * Math.pow(10, e));
        expect(esp(texte), `${m}e${e} → ${texte}`).not.toMatch(/^1 000/);
      }
    }
  });

  it("rend un texte fini pour tout nombre représentable", () => {
    for (const n of [0, 1, -1, 1e-9, 1e15, 1e42, 1e60, 1e120, 1e300, Number.MAX_VALUE]) {
      const texte = fmt(n);
      expect(typeof texte).toBe("string");
      expect(texte.length).toBeGreaterThan(0);
      expect(texte).not.toContain("undefined");
      expect(texte).not.toContain("NaN");
    }
  });

  it("ne prétend jamais qu'une valeur positive vaut zéro", () => {
    for (const n of [1e-9, 0.001, 0.004]) {
      expect(fmt(n), `${n}`).not.toBe("0");
    }
    expect(fmt(0)).toBe("0");
  });

  it("écarte les valeurs non finies sans planter", () => {
    for (const mauvais of [NaN, Infinity, -Infinity, undefined, null, "abc"]) {
      expect(typeof fmt(mauvais)).toBe("string");
      expect(fmt(mauvais)).not.toContain("NaN");
    }
    expect(fmt(Infinity)).toBe("∞");
    expect(fmtInt(Infinity)).toBe("∞");
  });
});

describe("valeur exacte, jamais compactée", () => {
  it("écrit une valeur de fiche en toutes lettres", () => {
    expect(esp(fmtExact(80_000))).toBe("80 000");
    expect(fmtExact(0.25)).toBe("0,25");
    expect(esp(fmtExact(2500))).toBe("2 500");
  });

  it("écrit chaque valeur du catalogue sans abréviation ni décimale inventée", () => {
    for (const item of ITEMS) {
      const texte = fmtExact(item.value);
      expect(texte, `${item.name} → ${texte}`).not.toMatch(/[KMBT]/);
      expect(relire(texte), `${item.name}`).toBe(item.value);
    }
  });
});

describe("multiplicateurs", () => {
  it("écrit les quatre valeurs du combo sans en inventer une cinquième", () => {
    expect(fmtMult(1)).toBe("1");
    expect(fmtMult(1.25)).toBe("1,25");
    expect(fmtMult(1.5)).toBe("1,50");
    expect(fmtMult(COMBO.max)).toBe("1,75");
  });

  it("garde deux décimales pour aligner les fractions", () => {
    expect(fmtMult(2)).toBe("2");
    expect(fmtMult(2.25)).toBe("2,25");
  });
});

describe("valeur mesurée", () => {
  it("annonce l'approximation au lieu de faire croire à une mesure exacte", () => {
    // Une cadence est une moyenne glissante. L'écrire « 4,25 /s » tout court
    // serait faussement précis.
    expect(fmtApprox(4.25)).toBe("≈4,25");
    expect(fmtApprox(0)).toBe("≈0");
  });
});

describe("seuil de compactage", () => {
  it("est un nombre rond, et le même partout", () => {
    expect(COMPACT_FROM).toBe(100_000);
    expect(fmt(COMPACT_FROM - 1)).not.toContain("K");
    expect(fmt(COMPACT_FROM)).toContain("K");
  });

  it("s'applique aussi au solde", () => {
    expect(esp(fmtInt(99_999))).toBe("99 999");
    expect(esp(fmtInt(1_234_567))).toBe("1 230K");
    expect(fmtInt(0)).toBe("0");
    expect(fmtInt(-5)).toBe("0"); // un solde ne s'affiche jamais négatif
  });

  it("ne montre jamais de décimale sur un solde en toutes lettres", () => {
    // Le solde bouge dix fois par seconde: deux décimales qui clignotent ne
    // s'attrapent pas à l'œil.
    expect(esp(fmtInt(1234.99))).toBe("1 234");
  });
});

describe("durées", () => {
  it("choisit l'unité la plus lisible", () => {
    expect(fmtDuration(5_000)).toBe("5s");
    expect(fmtDuration(59_000)).toBe("59s");
    expect(fmtDuration(90_000)).toBe("1m 30s");
    expect(fmtDuration(3_600_000)).toBe("1h 00m");
    expect(fmtDuration(3_900_000)).toBe("1h 05m");
    expect(fmtDuration(0)).toBe("0s");
    expect(fmtDuration(-10)).toBe("0s");
    expect(fmtDuration(Infinity)).toBe("0s");
  });
});

describe("chrono", () => {
  it("formate en mm:ss", () => {
    expect(fmtClock(65_000)).toBe("01:05");
    expect(fmtClock(0)).toBe("00:00");
  });
});

describe("CRMB", () => {
  it("se compte en pièces, pas en millièmes", () => {
    expect(fmtCrmb(1)).toBe("1");
    expect(fmtCrmb(2.5)).toBe("2,5");
    expect(fmtCrmb(0.12345, 2)).toBe("0,12");
  });
});

describe("pourcentages", () => {
  it("préfixe les gains d'un signe +", () => {
    expect(fmtPct(0.25)).toBe("+25 %");
    expect(fmtPct(-0.1)).toBe("-10 %");
    expect(fmtPct(0)).toBe("0 %");
  });
});

describe("locale figée", () => {
  it("ne dépend pas de la langue du navigateur", () => {
    expect(LOCALE).toBe("fr-FR");
    expect(fmt(1.25)).toContain(",");
    expect(fmt(1.25)).not.toContain(".");
  });
});

describe("clamp", () => {
  it("borne la valeur", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
