// === CRUMBORA ===
//
// Le jeu s'appelle Crumbora (CRUMBORA dans le logo et les grands titres).
// Cookie Craze est l'ancien nom: il ne doit plus apparaître dans l'interface,
// dans les métadonnées ni dans les fichiers servis.
//
// Ce qui a le DROIT de garder l'ancien nom, et pourquoi:
// - les clés de stockage `cookieCrazeSaveV1…V6` et `cookieCrazePendingReset`:
//   les renommer déconnecterait chaque joueur de sa partie — la continuité
//   des sauvegardes prime sur la cohérence du nom;
// - le littéral `"cookie-craze"` dans l'IMPORT de `state.js`: les fichiers
//   exportés avant le renommage portent cette étiquette et doivent rester
//   importables pour toujours (l'export, lui, écrit `"crumbora"`);
// - l'identifiant interne `CookieCraze` (composant et nom de fichier): un
//   identifiant technique sans surface visible, du même statut que le dépôt
//   `Optipen/Cookies` qu'on ne renomme pas non plus;
// - les rapports QA et l'historique Git: des preuves datées, pas l'interface.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import CookieCraze from "../components/CookieCraze.jsx";
import { SAVE_KEY, LEGACY_KEYS, createFreshState, exportSave, importSave } from "../utils/state.js";

const RACINE = path.resolve(import.meta.dirname, "../..");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.confirm = vi.fn(() => true);
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const demarrer = async (mutate = () => {}) => {
  const save = createFreshState();
  save.ui.introSeen = true;
  save.ui.sounds = false;
  mutate(save);
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  render(<CookieCraze />);
  await act(async () => {});
};

describe("l'interface dit Crumbora, jamais l'ancien nom", () => {
  it("accueille avec CRUMBORA en grand titre", async () => {
    render(<CookieCraze />);
    await act(async () => {});
    expect(screen.getByText("CRUMBORA")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/cookie[ \-_]?craze/i);
  });

  it("porte CRUMBORA en logo d'en-tête pendant la partie", async () => {
    await demarrer();
    expect(screen.getByRole("heading", { name: "CRUMBORA" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/cookie[ \-_]?craze/i);
  });
});

describe("les métadonnées servies disent Crumbora", () => {
  it("index.html: titre, description, Open Graph, Twitter", () => {
    const html = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");
    expect(html).toContain("<title>Crumbora</title>");
    expect(html).toMatch(/og:title" content="Crumbora"/);
    expect(html).toMatch(/twitter:title" content="Crumbora"/);
    expect(html).not.toMatch(/cookie[ \-_]?craze/i);
  });

  it("manifeste PWA: nom d'installation Crumbora", () => {
    const m = JSON.parse(fs.readFileSync(path.join(RACINE, "public/manifest.webmanifest"), "utf8"));
    expect(m.name).toBe("Crumbora");
    expect(m.short_name).toBe("Crumbora");
  });
});

describe("une partie Cookie Craze s'ouvre telle quelle dans Crumbora", () => {
  it("garde le préfixe de stockage historique, quelle que soit la version", () => {
    // Le renommage ne touche PAS au stockage: c'est la garantie de continuité.
    // Le NUMÉRO, lui, suit le schéma de sauvegarde — figer « V6 » ici faisait
    // échouer ce test à chaque évolution du schéma, alors que ce qu'il protège
    // est le préfixe: c'est lui qui relie un joueur à sa partie.
    expect(SAVE_KEY).toMatch(/^cookieCrazeSaveV\d+$/);
    // Et toutes les clés précédentes restent lues, la plus récente en premier.
    // La plus récente se DÉDUIT de la clé courante: nommer « V6 » ici faisait
    // échouer ce test à chaque version du schéma, pour une raison qui n'avait
    // rien à voir avec ce qu'il protège.
    const version = Number(SAVE_KEY.match(/\d+$/)[0]);
    expect(LEGACY_KEYS[0]).toBe(`cookieCrazeSaveV${version - 1}`);
    expect(LEGACY_KEYS).toContain("cookieCrazeSaveV1");
  });

  it("recharge la progression depuis la clé historique sans rien perdre", async () => {
    await demarrer((s) => {
      s.cookies = 123456;
      s.items = { oven: 14, cursor: 16 };
      s.crypto.balance = 42.5;
      s.crypto.ledger = 3;
    });
    // La partie chargée est bien celle du joueur, sous la marque Crumbora.
    expect(screen.getByRole("heading", { name: "CRUMBORA" })).toBeTruthy();
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(s.cookies).toBeGreaterThanOrEqual(123456);
    expect(s.crypto.balance).toBe(42.5);
    expect(s.crypto.ledger).toBe(3);
  });

  it("exporte sous l'étiquette crumbora, importe les DEUX étiquettes", () => {
    const etat = createFreshState(0);
    etat.ui.introSeen = true;
    etat.cookies = 777;

    const neuf = exportSave(etat);
    expect(JSON.parse(neuf).game).toBe("crumbora");

    // Un fichier exporté APRÈS renommage revient intact.
    expect(importSave(neuf).cookies).toBe(777);

    // Un fichier exporté AVANT renommage (étiquette cookie-craze) aussi:
    // c'est la promesse faite aux joueurs de la première heure.
    const ancien = JSON.stringify({ game: "cookie-craze", version: 6, exportedAt: 0, state: etat });
    expect(importSave(ancien).cookies).toBe(777);

    // Et l'aller-retour est idempotent.
    expect(importSave(exportSave(importSave(neuf))).cookies).toBe(777);
  });
});

describe("plus aucune occurrence non justifiée dans les sources", () => {
  it("balaie src/, public/, index.html, package.json et README", () => {
    const fichiers = [];
    const marcher = (dossier) => {
      for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
        const p = path.join(dossier, e.name);
        if (e.isDirectory()) marcher(p);
        else if (/\.(jsx?|css|json|html|webmanifest|md)$/.test(e.name)) fichiers.push(p);
      }
    };
    marcher(path.join(RACINE, "src"));
    marcher(path.join(RACINE, "public"));
    fichiers.push(path.join(RACINE, "index.html"), path.join(RACINE, "package.json"), path.join(RACINE, "README.md"));

    const CE_TEST = path.join(RACINE, "src/__tests__/rebranding.test.jsx");
    const restes = [];
    for (const f of fichiers) {
      if (f === CE_TEST) continue; // ce fichier NOMME les motifs qu'il traque
      const texte = fs.readFileSync(f, "utf8");
      const rel = path.relative(RACINE, f);
      for (const m of texte.matchAll(/cookie[ \-_]?craze/gi)) {
        const brut = m[0];
        const autour = texte.slice(Math.max(0, m.index - 24), m.index + brut.length + 24);
        // Clés de stockage: la continuité des sauvegardes les fige.
        if (/cookieCrazeSave/.test(autour) || /cookieCrazePendingReset/.test(autour)) continue;
        // Identifiant interne du composant (import, JSX, nom de fonction).
        if (brut === "CookieCraze") continue;
        // Compat d'import des anciens fichiers exportés, dans state.js seulement.
        if (rel === path.join("src", "utils", "state.js") && /game === "cookie-craze"/.test(autour)) continue;
        // L'explication historique du préfixe des clés, dans le README seulement.
        if (rel === "README.md" && /s'appelait Cookie Craze/.test(autour)) continue;
        restes.push(`${rel}: « …${autour.replace(/\s+/g, " ")}… »`);
      }
    }
    expect(restes, restes.join("\n")).toEqual([]);
  });
});
