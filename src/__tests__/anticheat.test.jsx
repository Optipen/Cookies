import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import CookieCraze from "../components/CookieCraze.jsx";
import { createFreshState, SAVE_KEY } from "../utils/state.js";
import { createGuard, fabriquerDefi, SEUIL_VERIFICATION, POIDS } from "../utils/anticheat.js";
import { CREDIT_MAX_CPS, CREDIT_BURST, creditedRate } from "../utils/rate.js";

/** Joue `n` clics à `cps` clics par seconde, avec une gigue donnée. */
function jouer(guard, { n, cps, gigue = 0, depart = 0, contexte = {}, graine = 1 }) {
  let t = depart;
  let credites = 0;
  let dernier = null;
  let alea = graine;
  const suivant = () => {
    // Générateur déterministe: une simulation doit être rejouable.
    alea = (alea * 1103515245 + 12345) % 2147483648;
    return alea / 2147483648;
  };
  for (let i = 0; i < n; i++) {
    dernier = guard.enregistrer(Math.round(t), contexte);
    if (dernier.credite) credites++;
    t += 1000 / cps + (gigue ? (suivant() - 0.5) * 2 * gigue : 0);
  }
  return { credites, duree: t - depart, dernier };
}

describe("le seau à jetons borne ce que le jeu crédite", () => {
  // Ces tests mesurent le SEAU seul: le score de suspicion est désarmé pour
  // qu'une vérification déclenchée en cours de route ne fausse pas le compte.
  const seau = () => createGuard({ seuil: Infinity });

  it("ne gêne jamais un joueur rapide", () => {
    // Douze clics par seconde à deux pouces, avec une gigue humaine ordinaire:
    // tout doit passer.
    for (const cps of [3, 5, 7, 10, 12]) {
      const g = seau();
      const { credites } = jouer(g, { n: cps * 20, cps, gigue: 25 });
      expect(credites, `${cps} clics/s`).toBe(cps * 20);
    }
  });

  it("laisse passer une rafale courte au-delà de la borne", () => {
    // Un double-clic, une accélération d'une demi-seconde: c'est humain, et la
    // réserve de rafale est là pour ça.
    const g = seau();
    const { credites } = jouer(g, { n: CREDIT_BURST, cps: 60 });
    expect(credites).toBe(CREDIT_BURST);
  });

  it("ramène une cadence soutenue à la borne", () => {
    for (const cps of [25, 50, 100, 1000]) {
      const g = seau();
      const secondes = 30;
      const { credites } = jouer(g, { n: cps * secondes, cps });
      const mesuree = credites / secondes;
      // La réserve de rafale se dépense une fois: on tolère son report.
      expect(mesuree, `${cps} clics/s → ${mesuree.toFixed(2)}`).toBeLessThanOrEqual(
        CREDIT_MAX_CPS + CREDIT_BURST / secondes + 0.01
      );
      expect(mesuree).toBeGreaterThan(CREDIT_MAX_CPS * 0.95);
    }
  });

  it("rend exactement ce que la simulation suppose", () => {
    // La simulation d'équilibrage suppose `creditedRate`. Si le seau et elle
    // divergeaient, tout l'équilibrage décrirait un autre jeu.
    for (const cps of [1, 5, 15, 50, 500]) {
      const g = seau();
      const secondes = 60;
      const { credites } = jouer(g, { n: Math.round(cps * secondes), cps });
      expect(credites / secondes).toBeCloseTo(creditedRate(cps), 0);
    }
  });

  it("ne punit pas une reprise après une pause", () => {
    // Onglet en arrière-plan, téléphone verrouillé, appel: au retour, la
    // réserve est pleine et les premiers clics passent tous.
    const g = seau();
    jouer(g, { n: 200, cps: 50 }); // le seau est vide
    const { credites } = jouer(g, { n: CREDIT_BURST, cps: 60, depart: 600_000 });
    expect(credites).toBe(CREDIT_BURST);
  });

  it("survit à une horloge qui recule", () => {
    const g = seau();
    jouer(g, { n: 20, cps: 5, depart: 1_000_000 });
    const r = g.enregistrer(0, {}); // l'horloge système a été reculée
    expect(typeof r.credite).toBe("boolean");
    expect(Number.isFinite(r.score)).toBe(true);
    expect(g.etat().jetons).toBeGreaterThanOrEqual(0);
  });

  it("ne crédite rien pendant une vérification, sans rien retirer", () => {
    const g = createGuard({ seuil: 1 });
    g.enregistrer(0, { hidden: true }); // déclenche tout de suite
    expect(g.etat().verification).toBe(true);
    const r = jouer(g, { n: 50, cps: 5, depart: 1000 });
    expect(r.credites).toBe(0);
    // Rien n'est retiré: le garde ne rend jamais de gain négatif.
    expect(r.dernier.credite).toBe(false);
    g.resoudre();
    expect(jouer(g, { n: 20, cps: 5, depart: 100_000 }).credites).toBe(20);
  });
});

describe("le score de suspicion observe la forme du geste", () => {
  it("laisse un joueur humain à zéro, même très actif, même longtemps", () => {
    // Douze clics par seconde pendant cinq minutes, avec une gigue humaine et
    // des pauses: aucun signal ne doit se déclencher.
    const g = createGuard();
    let t = 0;
    for (let rafale = 0; rafale < 20; rafale++) {
      jouer(g, { n: 12 * 15, cps: 12, gigue: 30, depart: t, graine: rafale + 1 });
      t += 15_000 + 4000; // quinze secondes de clic, quatre de pause
    }
    expect(g.etat().score, `signaux: ${g.etat().signaux}`).toBeLessThan(SEUIL_VERIFICATION);
    expect(g.etat().verification).toBe(false);
  });

  it("repère des intervalles identiques à la milliseconde", () => {
    const g = createGuard();
    jouer(g, { n: 40, cps: 10, gigue: 0 });
    expect(g.etat().signaux).toContain("regularite");
  });

  it("ne crie pas à la régularité sur une rafale courte", () => {
    // Vingt-cinq clics réguliers, c'est ce que produit un test — et un joueur
    // qui tapote en rythme. Trop peu pour conclure.
    const g = createGuard();
    jouer(g, { n: 25, cps: 5, gigue: 0 });
    expect(g.etat().signaux).not.toContain("regularite");
  });

  it("repère une cadence surhumaine soutenue", () => {
    const g = createGuard();
    jouer(g, { n: 200, cps: 60 });
    expect(g.etat().signaux).toContain("surhumain");
  });

  it("ne crie pas au surhumain sur une pointe d'une seconde", () => {
    const g = createGuard();
    jouer(g, { n: 20, cps: 40 });
    expect(g.etat().signaux).not.toContain("surhumain");
  });

  it("repère des clics reçus onglet caché", () => {
    const g = createGuard();
    jouer(g, { n: 5, cps: 5, contexte: { hidden: true } });
    expect(g.etat().signaux).toContain("ongletCache");
  });

  it("repère un nombre de doigts impossible", () => {
    const g = createGuard();
    g.enregistrer(0, { touches: 11 });
    expect(g.etat().signaux).toContain("multitouch");
  });

  it("repère dix minutes de clic sans la moindre pause", () => {
    const g = createGuard();
    jouer(g, { n: 12 * 700, cps: 12, gigue: 30 });
    expect(g.etat().signaux).toContain("sansPause");
  });

  it("ne compte l'événement synthétique que comme un appoint", () => {
    // Une extension d'accessibilité produit des événements non fiables. Seule,
    // cette caractéristique ne doit JAMAIS suffire à accuser quelqu'un, même
    // après une heure de jeu: c'est un état, pas un délit répété à chaque clic.
    const g = createGuard();
    jouer(g, { n: 4 * 3600, cps: 4, gigue: 40, contexte: { trusted: false } });
    expect(g.etat().signaux).toContain("synthetique");
    expect(g.etat().verification).toBe(false);
    // Compté par clic, il aurait dépassé le seuil des milliers de fois.
    expect(POIDS.synthetique * 4 * 3600).toBeGreaterThan(SEUIL_VERIFICATION * 100);
  });

  it("retombe tout seul quand le joueur redevient normal", () => {
    const g = createGuard();
    jouer(g, { n: 40, cps: 10, gigue: 0 }); // régularité détectée
    const avant = g.etat().score;
    expect(avant).toBeGreaterThan(0);
    g.enregistrer(avant * 1000 + 600_000, {}); // dix minutes plus tard
    expect(g.etat().score).toBe(0);
  });

  it("ne déclenche jamais une vérification sur la seule inactivité", () => {
    // Un joueur qui ne clique pas est un joueur légitime: le minage tourne pour
    // lui. « Êtes-vous toujours là ? » n'a rien à faire ici.
    const g = createGuard();
    jouer(g, { n: 30, cps: 5, gigue: 40 });
    for (const pause of [60_000, 3600_000, 86_400_000, 30 * 86_400_000]) {
      g.enregistrer(pause, {});
      expect(g.etat().verification, `après ${pause} ms`).toBe(false);
      expect(g.etat().score).toBe(0);
    }
  });

  it("ne déclenche jamais sur un seul signal isolé", () => {
    for (const contexte of [{ trusted: false }, { hidden: true }, { touches: 11 }]) {
      const g = createGuard();
      g.enregistrer(0, contexte);
      expect(g.etat().verification, JSON.stringify(contexte)).toBe(false);
    }
  });

  it("finit par demander une vérification à un autoclicker franc", () => {
    // Cinquante clics par seconde, à la milliseconde près, sans jamais une
    // pause. Plusieurs signaux se cumulent et le seuil finit par tomber.
    const g = createGuard();
    jouer(g, { n: 2000, cps: 50, gigue: 0 });
    expect(g.etat().verification).toBe(true);
    expect(g.etat().signaux.length).toBeGreaterThanOrEqual(2);
  });

  it("ne bannit jamais, ne retire jamais, ne touche jamais la sauvegarde", () => {
    // Le garde n'a aucun moyen d'agir sur la partie: son seul pouvoir est de
    // répondre « non crédité ». Sa surface d'API le garantit.
    const g = createGuard();
    jouer(g, { n: 5000, cps: 100, gigue: 0 });
    expect(Object.keys(g).sort()).toEqual(["enregistrer", "etat", "reset", "resoudre"]);
    const etat = g.etat();
    expect(etat.score).toBeGreaterThanOrEqual(0);
    expect("banni" in etat).toBe(false);
  });
});

describe("la vérification humaine", () => {
  it("pose une question lisible avec trois réponses distinctes", () => {
    for (let graine = 1; graine < 200; graine++) {
      const d = fabriquerDefi(graine);
      expect(d.options).toHaveLength(3);
      expect(new Set(d.options).size, `graine ${graine}: ${d.options}`).toBe(3);
      expect(d.reponse).toBeGreaterThanOrEqual(0);
      expect(d.reponse).toBeLessThan(3);
      expect(d.question).toContain(String(d.options[d.reponse]));
      expect(d.question.length).toBeGreaterThan(10);
    }
  });

  it("ne place pas toujours la bonne réponse au même endroit", () => {
    const positions = new Set();
    for (let graine = 1; graine < 30; graine++) positions.add(fabriquerDefi(graine).reponse);
    expect(positions.size).toBe(3);
  });

  it("rend la même question pour la même graine", () => {
    expect(fabriquerDefi(42)).toEqual(fabriquerDefi(42));
  });
});

// ============================================================================
// Ce que le joueur voit
// ============================================================================

describe("dans le jeu", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  const demarrer = async (mutate = () => {}) => {
    const s = createFreshState(0);
    s.ui.introSeen = true;
    mutate(s);
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    const r = render(<CookieCraze />);
    await act(async () => {});
    return r;
  };

  /** Pilonne le cookie à cadence parfaitement régulière, comme un autoclicker. */
  const pilonner = async (horlogeRef, { rafales = 6, parRafale = 32, pasMs = 20, entreRafales = 10_000 } = {}) => {
    const cookie = screen.getByRole("button", { name: /Cliquer le cookie/i });
    for (let r = 0; r < rafales; r++) {
      await act(async () => {
        for (let i = 0; i < parRafale; i++) {
          fireEvent.click(cookie);
          horlogeRef.t += pasMs;
        }
      });
      horlogeRef.t += entreRafales;
      if (screen.queryByTestId("verification")) return true;
    }
    return !!screen.queryByTestId("verification");
  };

  const horlogeFigee = () => {
    const ref = { t: Date.now() };
    vi.spyOn(Date, "now").mockImplementation(() => ref.t);
    return ref;
  };

  it("ne demande jamais de vérification à un joueur inactif", async () => {
    // Vingt-quatre heures sans toucher au cookie: c'est une façon légitime de
    // jouer, le minage tourne tout seul. « Êtes-vous toujours là ? » n'a aucune
    // raison d'apparaître.
    //
    // On avance l'HORLOGE de vingt-quatre heures, pas les minuteries: faire
    // tourner une journée de tics virtuels à dix hertz, c'est huit cent
    // soixante-quatre mille rappels, et la suite ne rend plus la main.
    await demarrer((x) => (x.items = { oven: 20 }));
    const h = horlogeFigee();
    for (const saut of [60_000, 3600_000, 86_400_000]) {
      h.t += saut;
      await act(async () => vi.advanceTimersByTime(1200));
      expect(screen.queryByTestId("verification"), `après ${saut} ms`).toBeNull();
    }
  });

  it("ne demande jamais de vérification à un joueur ordinaire", async () => {
    await demarrer((x) => (x.items = { oven: 20 }));
    const cookie = screen.getByRole("button", { name: /Cliquer le cookie/i });
    const h = horlogeFigee();
    await act(async () => {
      for (let i = 0; i < 60; i++) {
        fireEvent.click(cookie);
        h.t += 160 + (i % 7) * 21; // cadence humaine, irrégulière
      }
    });
    expect(screen.queryByTestId("verification")).toBeNull();
  });

  it("finit par demander une vérification à un pilonnage, sans jamais rien retirer", async () => {
    await demarrer((x) => {
      x.items = { oven: 50 };
      x.cookies = 5000;
    });
    const avant = JSON.parse(localStorage.getItem(SAVE_KEY));
    const h = horlogeFigee();
    expect(await pilonner(h)).toBe(true);

    const dialogue = screen.getByTestId("verification");
    expect(dialogue.textContent).toMatch(/minage continue/i);

    // Rien n'a été retiré, et le minage continue de tourner.
    const pendant = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(pendant.cookies).toBeGreaterThanOrEqual(avant.cookies);
    expect(pendant.items.oven).toBe(50);
    await act(async () => {
      h.t += 5000;
      vi.advanceTimersByTime(5000);
    });
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)).cookies).toBeGreaterThan(pendant.cookies);

    // Mauvaise réponse: la question se repose, rien n'est puni.
    const attendu = dialogue.querySelector("p").textContent.match(/(\d+)/)[1];
    const mauvais = [...dialogue.querySelectorAll("button")].find((b) => b.textContent !== attendu);
    await act(async () => fireEvent.click(mauvais));
    expect(screen.getByTestId("verification")).toBeTruthy();

    // Bonne réponse: on repart.
    const encore = screen.getByTestId("verification");
    const attendu2 = encore.querySelector("p").textContent.match(/(\d+)/)[1];
    const bon = [...encore.querySelectorAll("button")].find((b) => b.textContent === attendu2);
    await act(async () => fireEvent.click(bon));
    expect(screen.queryByTestId("verification")).toBeNull();
  });
});
