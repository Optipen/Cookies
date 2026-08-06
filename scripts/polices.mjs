// === Auto-hébergement des polices ===
//
// Sora et Marcellus arrivaient de `fonts.googleapis.com` par un
// `<link rel="stylesheet">` posé dans le `<head>`. Deux problèmes, et le second
// est le vrai:
//
//   · le premier écran ATTENDAIT un serveur qui n'est pas le nôtre — une
//     feuille de style externe bloque le rendu, et le jeu est censé démarrer
//     vite sur un clic venu d'un réseau social;
//   · l'adresse IP de chaque joueur partait chez Google avant qu'il ait vu
//     quoi que ce soit. Pour un jeu francophone, c'est un sujet RGPD.
//
// Ce script récupère la feuille de Google, ne garde que les sous-ensembles
// latin et latin-étendu (le jeu ne s'écrit dans aucun autre alphabet),
// télécharge les woff2 et réécrit les URL vers `/fonts/`. Les fichiers
// produits sont versionnés: il n'y a rien à lancer pour construire le jeu.
//
// Usage: node scripts/polices.mjs

import fs from "node:fs";
import path from "node:path";

const REQUETE =
  "https://fonts.googleapis.com/css2?family=Marcellus&family=Sora:wght@400;600;700;800&display=swap";

// Sans un agent moderne, Google renvoie du woff (ancien) au lieu du woff2.
const AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SOUS_ENSEMBLES = new Set(["latin", "latin-ext"]);
const DOSSIER = path.join(path.resolve(import.meta.dirname, ".."), "public", "fonts");

const ENTETE = `/* === Polices auto-hébergées ===
 *
 * Produit par \`node scripts/polices.mjs\` — ne pas éditer à la main.
 *
 * Elles arrivaient de \`fonts.googleapis.com\` par un \`<link rel=stylesheet>\`
 * dans le \`<head>\`: une requête TIERCE et BLOQUANTE sur le chemin critique, et
 * l'adresse IP de chaque joueur partait chez Google avant même qu'il ait vu le
 * premier écran. Pour un jeu francophone, c'est un sujet RGPD.
 *
 * Seuls les sous-ensembles latin et latin-étendu sont embarqués. Sora est une
 * police VARIABLE: un seul fichier porte les quatre graisses, d'où plusieurs
 * blocs qui pointent vers la même URL — le navigateur ne la télécharge qu'une
 * fois. \`font-display: swap\` conserve le comportement d'origine: le texte
 * s'affiche tout de suite dans la pile système, puis se substitue.
 */

`;

const css = await fetch(REQUETE, { headers: { "User-Agent": AGENT } }).then((r) => {
  if (!r.ok) throw new Error(`Google Fonts a répondu ${r.status}`);
  return r.text();
});

fs.mkdirSync(DOSSIER, { recursive: true });
// On repart d'un dossier propre: une police retirée de la requête ne doit pas
// rester à traîner dans `public/`.
for (const f of fs.readdirSync(DOSSIER)) fs.unlinkSync(path.join(DOSSIER, f));

const blocs = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*(@font-face \{[^}]*\})/g)];
const parUrl = new Map();
const sortie = [];

for (const [, sousEnsemble, bloc] of blocs) {
  if (!SOUS_ENSEMBLES.has(sousEnsemble)) continue;
  const url = bloc.match(/url\((https:\/\/[^)]+)\)/)?.[1];
  const famille = bloc.match(/font-family: '([^']+)'/)?.[1];
  if (!url || !famille) continue;

  if (!parUrl.has(url)) {
    // Le nom ne porte PAS la graisse: une police variable en couvre plusieurs,
    // et `sora-400.woff2` mentirait sur ce que le fichier contient.
    const fichier = `${famille.toLowerCase()}-${sousEnsemble}.woff2`;
    const octets = Buffer.from(await fetch(url, { headers: { "User-Agent": AGENT } }).then((r) => r.arrayBuffer()));
    fs.writeFileSync(path.join(DOSSIER, fichier), octets);
    parUrl.set(url, fichier);
    console.log(`${fichier.padEnd(30)} ${(octets.length / 1024).toFixed(0)} Ko`);
  }
  sortie.push(bloc.replace(url, `/fonts/${parUrl.get(url)}`));
}

if (!sortie.length) throw new Error("aucun bloc @font-face retenu — la réponse de Google a changé de forme");

fs.writeFileSync(path.join(DOSSIER, "polices.css"), ENTETE + sortie.join("\n\n") + "\n");
const total = fs.readdirSync(DOSSIER).reduce((n, f) => n + fs.statSync(path.join(DOSSIER, f)).size, 0);
console.log(`\n${sortie.length} blocs, ${parUrl.size} fichiers, ${(total / 1024).toFixed(0)} Ko au total`);
