import { describe, it, expect } from "vitest";
import { offlineGains, OFFLINE_MIN_MS } from "../utils/offline.js";
import { createFreshState } from "../utils/state.js";
import { deriveStats } from "../utils/selectors.js";
import tuning from "../data/tuning.json";

const CFG = tuning.standard.offline;
const MIN = 60e3;
const H = 3600e3;

const partie = (mutate = () => {}) => {
  const s = createFreshState(0);
  s.ui.introSeen = true;
  s.items = { oven: 60, bakery: 30 };
  mutate(s);
  return s;
};

describe("ce qu'on trouve en revenant", () => {
  it("n'annonce rien pour une absence trop courte", () => {
    for (const away of [0, 1000, 30_000, OFFLINE_MIN_MS - 1]) {
      const g = offlineGains(partie(), away, 6e5);
      expect(g.vaut, `${away} ms`).toBe(false);
      expect(g.cookies).toBe(0);
      expect(g.crmb).toBe(0);
    }
  });

  it("rend un gain dégressif: généreux au début, faible ensuite", () => {
    const s = partie();
    const parSeconde = (away) => offlineGains(s, away, 6e5).cookies / (away / 1000);
    // Dix minutes: le taux plein. Deux heures: le taux réduit.
    expect(parSeconde(10 * MIN)).toBeCloseTo(deriveStats(s, 6e5).baseCps * CFG.ratio_0_10min, 6);
    expect(parSeconde(2 * H)).toBeLessThan(parSeconde(10 * MIN));
  });

  it("plafonne à deux heures, quelle que soit la durée d'absence", () => {
    const s = partie();
    const deuxHeures = offlineGains(s, CFG.max_seconds * 1000, 6e5).cookies;
    for (const away of [6 * H, 24 * H, 30 * 24 * H, 365 * 24 * H]) {
      expect(offlineGains(s, away, 6e5).cookies, `${away} ms`).toBeCloseTo(deuxHeures, 6);
    }
  });

  it("ne rapporte jamais plus que de jouer", () => {
    // Deux heures fermé doivent valoir bien moins que deux heures de minage.
    const s = partie();
    const minage = deriveStats(s, 6e5).baseCps * CFG.max_seconds;
    expect(offlineGains(s, 2 * H, 6e5).cookies).toBeLessThan(minage * 0.1);
  });

  it("traite une horloge reculée comme une absence nulle", () => {
    // Le joueur change de fuseau, la machine se resynchronise: `lastTs` se
    // retrouve dans le futur et l'absence devient négative. Elle ne doit ni
    // créditer, ni retirer, ni produire un montant non fini.
    for (const away of [-1, -1e9, -Infinity]) {
      const g = offlineGains(partie(), away, 6e5);
      expect(g.vaut, `${away}`).toBe(false);
      expect(g.cookies).toBe(0);
      expect(g.durationMs).toBe(0);
    }
  });

  it("écarte une durée absurde sans planter", () => {
    for (const away of [NaN, Infinity, undefined, null, "hier"]) {
      const g = offlineGains(partie(), away, 6e5);
      expect(Number.isFinite(g.cookies), `${String(away)}`).toBe(true);
      expect(Number.isFinite(g.crmb)).toBe(true);
      expect(g.cookies).toBeGreaterThanOrEqual(0);
    }
  });

  it("ne rend jamais un montant non fini, même sur un état corrompu", () => {
    // C'est le défaut qui vidait le portefeuille: un NaN ici s'ajoutait au
    // solde, s'affichait « ∞ », puis retombait à zéro au rechargement.
    const casse = partie((x) => {
      x.crypto.miners = { cpu: NaN };
      x.items = { oven: 60 };
    });
    const g = offlineGains(casse, 2 * H, 6e5);
    expect(Number.isFinite(g.cookies)).toBe(true);
    expect(Number.isFinite(g.crmb)).toBe(true);
    expect(g.crmb).toBeGreaterThanOrEqual(0);
  });

  it("crédite le CRMB du matériel, à moitié tarif", () => {
    const s = partie((x) => (x.crypto.miners = { gpu: 4 }));
    const g = offlineGains(s, 2 * H, 6e5);
    const attendu = deriveStats(s, 6e5).crmbRate * CFG.max_seconds * 0.5;
    expect(g.crmb).toBeCloseTo(attendu, 9);
    expect(g.crmb).toBeGreaterThan(0);
  });

  it("annonce quelque chose dès qu'il y a du CRMB, même sans un cookie", () => {
    // Un joueur sans le moindre Mineur mais avec du matériel d'extraction doit
    // quand même recevoir son CRMB.
    const s = partie((x) => {
      x.items = {};
      x.crypto.miners = { quantum: 2 };
    });
    const g = offlineGains(s, 2 * H, 6e5);
    expect(g.cookies).toBe(0);
    expect(g.crmb).toBeGreaterThan(0);
    expect(g.vaut).toBe(true);
  });

  it("suit le bonus « Équipe de nuit » de l'arbre céleste", () => {
    // Mêmes chips des deux côtés: elles changent le minage, et comparer deux
    // économies différentes n'aurait rien dit du bonus hors-ligne.
    const sans = partie((x) => (x.prestige = { chips: 50, spent: 0, upgrades: {} }));
    const avec = partie((x) => (x.prestige = { chips: 50, spent: 0, upgrades: { night_shift: 8 } }));
    expect(offlineGains(avec, 2 * H, 6e5).cookies).toBeCloseTo(offlineGains(sans, 2 * H, 6e5).cookies * 3, 6);
  });

  it("ne rapporte rien sur une partie neuve", () => {
    const neuf = createFreshState(0);
    neuf.ui.introSeen = true;
    const g = offlineGains(neuf, 2 * H, 6e5);
    expect(g.cookies).toBe(0);
    expect(g.crmb).toBe(0);
    expect(g.vaut).toBe(false);
  });
});
