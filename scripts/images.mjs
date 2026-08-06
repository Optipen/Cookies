// === Fabrique des images servies ===
//
// Les sources vivent dans `assets-source/` en 1024×1024 et ne sont JAMAIS
// servies: un cookie de 1,5 Mo pour un rendu de 144 px sur téléphone, c'est
// dix fois le poids de tout le code du jeu. Ce script en tire les deux seules
// tailles que l'interface utilise vraiment, et c'est `public/` qui les reçoit.
//
//   · 768 px — le grand cookie (384 px de large au plus, écran retina compris)
//               et l'écran d'accueil;
//   · 128 px — les vignettes du panneau Apparences (64 px de large);
//   · 512 px — l'icône du manifeste (PWA, écran d'accueil du téléphone).
//
// PNG palettisé et non WebP: le grand cookie est peint dans un `<image>` SVG
// masqué (les morsures), où un format non supporté ne donne pas une image de
// repli mais un trou — et un cookie invisible, c'est un jeu injouable. Le PNG-8
// divise déjà le poids par dix et se lit partout.
//
// `sharp` n'est pas une dépendance du projet: c'est un outil lancé à la main,
// comme le harnais Playwright. Les images produites sont versionnées, il n'y a
// donc rien à installer pour construire ou déployer le jeu.
//
// Usage: npm i --no-save sharp && node scripts/images.mjs

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("sharp est absent. Lance: npm i --no-save sharp");
  process.exit(1);
}

const RACINE = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(RACINE, "assets-source");
const CIBLE = path.join(RACINE, "public");

// Palettisé, effort maximal: la qualité 90 garde les dégradés du cookie sans
// bande visible, pour un tiers du poids d'un PNG 24 bits.
const png = (image) => image.png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 });

const COOKIES = ["cookie", "cookie-caramel", "cookie-noir", "cookie-ice", "cookie-fire"];

const ko = (n) => `${(n / 1024).toFixed(0)} Ko`;

async function ecrire(image, destination) {
  await image.toFile(destination);
  return fs.statSync(destination).size;
}

let avant = 0;
let apres = 0;

for (const nom of COOKIES) {
  const src = path.join(SOURCE, `${nom}.png`);
  avant += fs.statSync(src).size;

  const grand = await ecrire(png(sharp(src).resize(768, 768)), path.join(CIBLE, `${nom}.png`));
  const vignette = await ecrire(png(sharp(src).resize(128, 128)), path.join(CIBLE, `${nom}-128.png`));
  apres += grand + vignette;

  console.log(`${nom.padEnd(16)} 768px ${ko(grand).padStart(8)}   128px ${ko(vignette).padStart(8)}`);
}

// L'icône du manifeste: 512 px suffit à tous les écrans d'accueil, et elle est
// posée sur un carré opaque — une icône « maskable » transparente se retrouve
// rognée sur un fond blanc chez certains lanceurs Android.
const icone = await ecrire(
  png(
    sharp(path.join(SOURCE, "cookie.png"))
      .resize(512, 512)
      .flatten({ background: "#0b0804" })
  ),
  path.join(CIBLE, "icon-512.png")
);
console.log(`${"icon-512".padEnd(16)} 512px ${ko(icone).padStart(8)}`);
apres += icone;

// L'image de partage: seuls les robots des réseaux sociaux la lisent, mais
// 416 Ko pour 1200×630 reste du gâchis.
const source = path.join(SOURCE, "og-image.png");
avant += fs.statSync(source).size;
const og = await ecrire(png(sharp(source).resize(1200, 630)), path.join(CIBLE, "og-image.png"));
apres += og;
console.log(`${"og-image".padEnd(16)} 1200px ${ko(og).padStart(7)}`);

console.log(`\nTotal servi : ${ko(avant)} → ${ko(apres)} (÷${(avant / apres).toFixed(1)})`);
