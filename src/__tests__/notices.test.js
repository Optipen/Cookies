import { describe, it, expect } from "vitest";
import {
  createNoticeQueue,
  QUIET_MS,
  MAJOR_MIN_GAP_MS,
  MAJOR_PER_MINUTE,
  DEDUPE_MS,
  MAX_QUEUE,
} from "../utils/notices.js";

/** Joue une file pendant `dureeMs` et rend tout ce qui a été affiché. */
function derouler(file, evenements, dureeMs, pasMs = 100) {
  const vus = [];
  const restants = [...evenements].sort((a, b) => a.t - b.t);
  let i = 0;
  for (let t = 0; t <= dureeMs; t += pasMs) {
    while (i < restants.length && restants[i].t <= t) {
      const e = restants[i++];
      file.push(e.level, e.msg, { tone: e.tone, group: e.group, now: t });
    }
    const n = file.tick(t);
    if (n) vus.push({ t, ...n });
  }
  return vus;
}

const parMinute = (vus, dureeMs) => (vus.length / dureeMs) * 60_000;

describe("une file d'attente, pas une trappe", () => {
  it("finit par montrer ce qui est arrivé trop tôt", () => {
    // L'ancienne version écartait purement et simplement ce qui arrivait
    // pendant le silence: un joueur qui décrochait trois succès d'affilée n'en
    // voyait qu'un, et les deux autres n'existaient plus.
    const file = createNoticeQueue();
    const vus = derouler(
      file,
      [
        { t: 0, level: "banner", msg: "un" },
        { t: 100, level: "banner", msg: "deux" },
        { t: 200, level: "banner", msg: "trois" },
      ],
      60_000
    );
    expect(vus.map((v) => v.msg)).toEqual(["un", "deux", "trois"]);
  });

  it("espace les bandeaux ordinaires d'au moins dix secondes", () => {
    const file = createNoticeQueue();
    const vus = derouler(
      file,
      Array.from({ length: 20 }, (_, i) => ({ t: i * 200, level: "banner", msg: `n${i}` })),
      120_000
    );
    for (let i = 1; i < vus.length; i++) {
      expect(vus[i].t - vus[i - 1].t, `entre « ${vus[i - 1].msg} » et « ${vus[i].msg} »`).toBeGreaterThanOrEqual(QUIET_MS);
    }
  });

  it("ne garde pas une file sans fin: au-delà, le plus ancien ordinaire saute", () => {
    // Une file qui grandit sans limite ne supprime pas l'avalanche, elle la
    // reporte — et le joueur reçoit vingt minutes plus tard une nouvelle sans
    // rapport avec ce qu'il fait.
    const file = createNoticeQueue();
    for (let i = 0; i < MAX_QUEUE * 4; i++) file.push("banner", `n${i}`, { now: i });
    expect(file.taille()).toBeLessThanOrEqual(MAX_QUEUE);
  });

  it("laisse tomber ce qui a trop attendu plutôt que de le sortir hors sujet", () => {
    const file = createNoticeQueue();
    file.push("banner", "périmé", { now: 0 });
    file.push("banner", "frais", { now: 0 });
    // On saute très loin dans le temps: le premier message n'a plus de sens.
    const n = file.tick(10 * 60_000);
    expect(n).toBeNull();
    expect(file.taille()).toBe(0);
  });
});

describe("déduplication et regroupement", () => {
  it("n'affiche pas deux fois le même message coup sur coup", () => {
    const file = createNoticeQueue();
    const vus = derouler(
      file,
      Array.from({ length: 10 }, (_, i) => ({ t: i * 500, level: "banner", msg: "même chose" })),
      120_000
    );
    expect(vus).toHaveLength(1);
  });

  it("le réaffiche une fois le délai de déduplication passé", () => {
    const file = createNoticeQueue();
    const vus = derouler(
      file,
      [
        { t: 0, level: "banner", msg: "revient" },
        { t: DEDUPE_MS + 1000, level: "banner", msg: "revient" },
      ],
      120_000
    );
    expect(vus).toHaveLength(2);
  });

  it("regroupe ce qui appartient à la même famille au lieu de l'enfiler", () => {
    // Dix succès simultanés doivent faire une ligne, pas dix.
    const file = createNoticeQueue();
    const vus = derouler(
      file,
      Array.from({ length: 10 }, (_, i) => ({ t: i * 50, level: "event", msg: `succès ${i}`, group: "succes" })),
      120_000
    );
    expect(vus).toHaveLength(1);
    expect(vus[0].count).toBe(10);
  });

  it("garde le dernier message d'un groupe, pas le premier", () => {
    const file = createNoticeQueue();
    file.push("event", "premier", { group: "g", now: 0 });
    file.push("event", "dernier", { group: "g", now: 100 });
    // Après la fenêtre de regroupement: c'est le dernier arrivé qui parle.
    expect(file.tick(1200).msg).toBe("dernier");
  });
});

describe("les événements majeurs passent devant, mais pas n'importe comment", () => {
  it("ne sont pas retardés par le silence des bandeaux", () => {
    const file = createNoticeQueue();
    const vus = derouler(
      file,
      [
        { t: 0, level: "banner", msg: "ordinaire" },
        { t: 1000, level: "major", msg: "RENAISSANCE" },
      ],
      60_000
    );
    expect(vus[0].msg).toBe("ordinaire");
    expect(vus[1].msg).toBe("RENAISSANCE");
    expect(vus[1].t).toBeLessThan(QUIET_MS);
  });

  it("restent bornés même si un bug en déclenche soixante par minute", () => {
    // C'est la protection que le cahier des charges demande explicitement: même
    // un événement majeur ne doit pas pouvoir saturer l'écran. On mesure sur
    // cinq minutes: sur une seule, l'entrée de bordure fausse la moyenne.
    const file = createNoticeQueue();
    const vus = derouler(
      file,
      Array.from({ length: 3000 }, (_, i) => ({ t: i * 100, level: "major", msg: `boum ${i}` })),
      300_000
    );
    // La bonne mesure est la fenêtre GLISSANTE: compter sur un intervalle fermé
    // ramasse l'entrée de bordure et fait dire 6,2 là où la règle est tenue.
    for (const v of vus) {
      const dansLaFenetre = vus.filter((x) => x.t > v.t - 60_000 && x.t <= v.t).length;
      expect(dansLaFenetre, `à ${v.t} ms`).toBeLessThanOrEqual(MAJOR_PER_MINUTE);
    }
    expect(vus.length, "et les majeurs passent quand même").toBeGreaterThan(5);
  });

  it("gardent un écart minimal entre deux, même bornés", () => {
    const file = createNoticeQueue();
    const vus = derouler(
      file,
      Array.from({ length: 20 }, (_, i) => ({ t: i * 100, level: "major", msg: `m${i}` })),
      60_000
    );
    for (let i = 1; i < vus.length; i++) {
      expect(vus[i].t - vus[i - 1].t).toBeGreaterThanOrEqual(MAJOR_MIN_GAP_MS);
    }
  });
});

describe("ce que voit une vraie session", () => {
  // Le mélange qu'un joueur produit réellement: quelques succès, des quêtes,
  // un doré de temps en temps, une renaissance.
  const session = (dureeMs) => {
    const e = [];
    for (let t = 0; t < dureeMs; t += 45_000) e.push({ t, level: "event", msg: `quête ${t}`, group: "quete" });
    for (let t = 0; t < dureeMs; t += 90_000) e.push({ t, level: "banner", msg: `succès ${t}`, group: "succes" });
    for (let t = 0; t < dureeMs; t += 70_000) e.push({ t, level: "event", msg: `doré ${t}`, group: "dore" });
    for (let t = 1_800_000; t < dureeMs; t += 1_800_000) e.push({ t, level: "major", msg: `renaissance ${t}` });
    return e;
  };

  it("reste sous six notifications par minute sur le premier quart d'heure", () => {
    const file = createNoticeQueue();
    const vus = derouler(file, session(900_000), 900_000, 250);
    const cadence = parMinute(vus, 900_000);
    expect(cadence, `${cadence.toFixed(2)} par minute`).toBeLessThanOrEqual(6);
    expect(vus.length, "et il s'en passe quand même quelque chose").toBeGreaterThan(3);
  });

  it("reste sous six notifications par minute sur une heure", () => {
    const file = createNoticeQueue();
    const vus = derouler(file, session(3_600_000), 3_600_000, 250);
    const cadence = parMinute(vus, 3_600_000);
    expect(cadence, `${cadence.toFixed(2)} par minute`).toBeLessThanOrEqual(6);
  });

  it("ne fait jamais réapparaître deux fois le même identifiant", () => {
    const file = createNoticeQueue();
    const vus = derouler(file, session(3_600_000), 3_600_000, 250);
    const ids = vus.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("robustesse", () => {
  it("survit à une horloge qui recule", () => {
    const file = createNoticeQueue();
    file.push("banner", "avant", { now: 1_000_000 });
    expect(file.tick(1_000_100)).toBeTruthy();
    file.push("banner", "après", { now: 0 });
    expect(() => file.tick(100)).not.toThrow();
    expect(file.taille()).toBeGreaterThanOrEqual(0);
  });

  it("écarte un message vide ou absurde sans planter", () => {
    const file = createNoticeQueue();
    for (const mauvais of [null, undefined, "", "   ", 42, {}]) {
      expect(() => file.push("banner", mauvais, { now: 0 })).not.toThrow();
    }
    expect(file.taille()).toBe(0);
  });

  it("traite un niveau inconnu comme un bandeau ordinaire", () => {
    const file = createNoticeQueue();
    file.push("inconnu", "salut", { now: 0 });
    const n = file.tick(0);
    expect(n.level).toBe("banner");
  });

  it("se vide proprement", () => {
    const file = createNoticeQueue();
    for (let i = 0; i < 5; i++) file.push("banner", `n${i}`, { now: i });
    file.reset();
    expect(file.taille()).toBe(0);
    expect(file.tick(0)).toBeNull();
  });
});
