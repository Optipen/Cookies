import { describe, it, expect } from "vitest";
import { fmt, fmtInt, fmtPct, fmtDuration, fmtClock, fmtCrmb, clamp } from "../utils/format.js";

describe("fmt", () => {
  it("garde les petits nombres tels quels", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(42)).toBe("42");
    expect(fmt(999)).toBe("999");
  });

  it("ajoute un suffixe au-delà du millier", () => {
    expect(fmt(1500)).toBe("1,5K");
    expect(fmt(1_234_567)).toBe("1,23M");
    expect(fmt(1e12)).toBe("1T");
  });

  it("utilise toujours la locale française, quel que soit l'environnement", () => {
    // Le séparateur décimal doit être une virgule même si Node tourne en en-US
    expect(fmt(1500)).toContain(",");
    expect(fmt(1500)).not.toContain(".");
  });

  it("gère l'infini", () => {
    expect(fmt(Infinity)).toBe("∞");
    expect(fmtInt(Infinity)).toBe("∞");
  });
});

describe("fmtInt", () => {
  it("affiche deux décimales au-delà du millier", () => {
    expect(fmtInt(1500)).toBe("1,50K");
    expect(fmtInt(999)).toBe("999");
  });

  it("n'affiche jamais de valeur négative", () => {
    expect(fmtInt(-50)).toBe("0");
  });
});

describe("fmtPct", () => {
  it("préfixe les gains d'un signe +", () => {
    expect(fmtPct(0.25)).toBe("+25 %");
    expect(fmtPct(-0.1)).toBe("-10 %");
    expect(fmtPct(0)).toBe("0 %");
  });
});

describe("fmtDuration", () => {
  it("choisit l'unité la plus lisible", () => {
    expect(fmtDuration(5_000)).toBe("5s");
    expect(fmtDuration(90_000)).toBe("1m 30s");
    expect(fmtDuration(3_900_000)).toBe("1h 05m");
    expect(fmtDuration(0)).toBe("0s");
    expect(fmtDuration(-10)).toBe("0s");
  });
});

describe("fmtClock", () => {
  it("formate en mm:ss", () => {
    expect(fmtClock(65_000)).toBe("01:05");
    expect(fmtClock(0)).toBe("00:00");
  });
});

describe("fmtCrmb", () => {
  it("garde une précision fixe", () => {
    expect(fmtCrmb(1)).toBe("1"); // le CRMB se compte en pièces entières
    expect(fmtCrmb(2.5)).toBe("2,5");
    expect(fmtCrmb(0.12345, 2)).toBe("0,12");
  });
});

describe("clamp", () => {
  it("borne la valeur", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
