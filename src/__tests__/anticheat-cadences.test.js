// === Anti-autoclicker: la matrice des cadences ===
//
// Les cadences exigées par l'audit, une par une: 3 · 5 · 8 · 11 · 12–15 avec
// gigue humaine · 20 · 50 clics/s, intervalles parfaitement réguliers, deux
// rafales à la même fréquence exacte, multitouch, événements synthétiques.
//
// Deux garanties se testent séparément:
//   · le SEAU crédite tout joueur humain (≤15/s) et borne le reste à 15/s;
//   · le SCORE ne demande JAMAIS de vérification à une gigue humaine — et
//     finit toujours par en demander une à une machine.
//
// La protection reste entièrement côté client: rien ici n'empêche de modifier
// le localStorage ni d'appeler le moteur en console — et une vérification non
// persistée se contourne par un rechargement, EXPRÈS, pour qu'un bug ne puisse
// enfermer personne. Le dernier test le documente.

import { describe, expect, it } from "vitest";
import { createGuard } from "../utils/anticheat.js";
import { CREDIT_MAX_CPS, CREDIT_BURST } from "../utils/rate.js";

/** PRNG déterministe: la matrice rend le même verdict à chaque exécution. */
function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Joue `dureeS` secondes de clics à `cps` moyen avec `gigue` relative
 * (écart-type humain: 20 à 35 %), et rend le bilan du garde-fou.
 */
function jouer(guard, { cps, dureeS, gigue = 0.3, seed = 42, contexte = {} }) {
  const rnd = prng(seed);
  let t = 1000;
  const fin = 1000 + dureeS * 1000;
  let envoyes = 0;
  let credites = 0;
  let verification = false;
  while (t < fin) {
    const v = guard.enregistrer(t, contexte);
    envoyes += 1;
    if (v.credite) credites += 1;
    if (v.verification) verification = true;
    const base = 1000 / cps;
    t += Math.max(8, base * (1 - gigue + rnd() * 2 * gigue));
  }
  return { envoyes, credites, verification, etat: guard.etat() };
}

describe("le seau crédite l'humain, borne la machine", () => {
  for (const cps of [3, 5, 8, 11]) {
    it(`crédite TOUT à ${cps} clics/s humains, sans vérification`, () => {
      const bilan = jouer(createGuard(), { cps, dureeS: 120, gigue: 0.3, seed: cps });
      expect(bilan.verification).toBe(false);
      expect(bilan.credites).toBe(bilan.envoyes);
    });
  }

  it("laisse passer 12–15 clics/s en rafales humaines, sans vérification", () => {
    const guard = createGuard();
    const rnd = prng(7);
    let t = 1000;
    let envoyes = 0;
    let credites = 0;
    let verification = false;
    // Vingt vagues: rafale de 2 à 4 s entre 12 et 15 clics/s, micro-pause.
    for (let vague = 0; vague < 20; vague++) {
      const cps = 12 + rnd() * 3;
      const finVague = t + (2 + rnd() * 2) * 1000;
      while (t < finVague) {
        const v = guard.enregistrer(t, {});
        envoyes += 1;
        if (v.credite) credites += 1;
        if (v.verification) verification = true;
        t += Math.max(8, (1000 / cps) * (0.7 + rnd() * 0.6));
      }
      t += (0.25 + rnd() * 0.5) * 1000;
    }
    expect(verification).toBe(false);
    // La gigue dépasse ponctuellement la borne: quelques clics du haut de
    // rafale peuvent attendre le jeton suivant, jamais plus de quelques pourcents.
    expect(credites / envoyes).toBeGreaterThan(0.95);
  });

  it("ramène 20 clics/s à la borne exacte, sans vérification — le seau suffit", () => {
    const bilan = jouer(createGuard(), { cps: 20, dureeS: 60, gigue: 0.25, seed: 20 });
    expect(bilan.verification).toBe(false);
    expect(bilan.credites).toBeLessThanOrEqual(CREDIT_MAX_CPS * 60 + CREDIT_BURST);
    expect(bilan.credites).toBeGreaterThanOrEqual(CREDIT_MAX_CPS * 60 - CREDIT_MAX_CPS);
  });

  it("ramène 50 clics/s à la borne ET finit par demander une vérification", () => {
    const bilan = jouer(createGuard(), { cps: 50, dureeS: 60, gigue: 0.2, seed: 50 });
    expect(bilan.credites).toBeLessThanOrEqual(CREDIT_MAX_CPS * 60 + CREDIT_BURST);
    expect(bilan.verification).toBe(true);
  });
});

describe("la forme du geste", () => {
  it("finit par exiger une vérification d'un métronome parfait, même lent", () => {
    // Huit clics par seconde, intervalle EXACT de 125 ms, une minute durant:
    // aucune main n'a un écart-type nul. Le seau ne bronche pas (8 < 15),
    // c'est la régularité qui le repère.
    const guard = createGuard();
    let verification = false;
    for (let i = 0; i < 8 * 60; i++) {
      if (guard.enregistrer(1000 + i * 125, {}).verification) verification = true;
    }
    expect(verification).toBe(true);
  });

  it("repère deux rafales à la même fréquence exacte, sans condamner sur ce seul signal", () => {
    const guard = createGuard();
    const rafale = (depart) => {
      let etat;
      for (let i = 0; i < 20; i++) etat = guard.enregistrer(depart + i * 100, {});
      return etat;
    };
    rafale(1000);
    const apres = rafale(6000); // 3 s de pause, puis la MÊME fréquence au millième
    expect(apres.signaux).toContain("frequenceRepetee");
    expect(apres.verification).toBe(false);
  });

  it("compte un multitouch impossible sans condamner seul", () => {
    const guard = createGuard();
    const v = guard.enregistrer(1000, { touches: 7 });
    expect(v.signaux).toContain("multitouch");
    expect(v.verification).toBe(false);
  });

  it("laisse tranquille dix minutes d'événements synthétiques à cadence humaine", () => {
    // Une extension d'accessibilité produit des événements non fiables. Dix
    // minutes à 4 clics/s: le signal ne pèse presque rien et se réarme
    // lentement — jamais de vérification pour ça tout seul.
    const bilan = jouer(createGuard(), {
      cps: 4,
      dureeS: 600,
      gigue: 0.35,
      seed: 9,
      contexte: { trusted: false },
    });
    expect(bilan.verification).toBe(false);
    expect(bilan.credites).toBe(bilan.envoyes);
  });

  it("un rechargement rend un garde neuf: la vérification n'est pas persistée, exprès", () => {
    const avant = createGuard();
    jouer(avant, { cps: 50, dureeS: 60, gigue: 0.2, seed: 50 });
    expect(avant.etat().verification).toBe(true);
    // Le « rechargement »: l'application reconstruit son garde. Un bug de
    // détection ne peut donc enfermer personne — c'est un choix documenté,
    // pas un oubli, et il est contournable par définition.
    const apres = createGuard();
    expect(apres.etat().verification).toBe(false);
    expect(apres.etat().score).toBe(0);
  });
});
