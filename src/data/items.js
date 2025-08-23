export const ITEMS = [
  // === Tiers CPS (production passive) ===
  { id: "oven",     mode: "cps",  name: "Four",           emoji: "🔥", base: 60,         growth: 1.13,  cps: 0.6,    desc: "Produit des cookies lentement.", synergy: "Se combine avec les améliorations Four pour doubler le gain." },
  { id: "bakery",   mode: "cps",  name: "Boulangerie",   emoji: "🥖", base: 500,        growth: 1.135, cps: 5,      desc: "Production régulière de cookies." },
  { id: "farm_cps", mode: "cps",  name: "Ferme",          emoji: "🌾", base: 5000,       growth: 1.14,  cps: 32,     desc: "Champs dédiés au blé sucré." },
  { id: "factory_cps", mode: "cps", name: "Usine",        emoji: "🏭", base: 60000,      growth: 1.145, cps: 180,    desc: "Ligne de production industrielle." },
  { id: "bank_cps", mode: "cps",  name: "Banque",         emoji: "🏦", base: 750000,     growth: 1.15,  cps: 900,    desc: "Intérêts en cookies composés." },
  { id: "temple",   mode: "cps",  name: "Temple",         emoji: "⛩️", base: 9000000,   growth: 1.155, cps: 4200,   desc: "Rituels d'efficacité sacrée." },
  { id: "lab",      mode: "cps",  name: "Laboratoire",    emoji: "🧪", base: 120000000,  growth: 1.16,  cps: 18000,  desc: "Science du cookie appliquée." },
  { id: "portal",   mode: "cps",  name: "Portail",        emoji: "🌀", base: 1800000000, growth: 1.165, cps: 75000,  desc: "Importe des cookies d'ailleurs." },

  // === Tiers Multiplicateur de clic (CPC) — contributions additivement, softcap côté calcul ===
  { id: "cursor",   mode: "mult", name: "Curseur",        emoji: "🖱️", base: 18,        growth: 1.15,  mult: 0.04,  desc: "Augmente la puissance des clics.", synergy: "Synergie avec Mamie et upgrades Curseur (x2, x4...)." },
  { id: "grandma",  mode: "mult", name: "Mamie",          emoji: "👵", base: 140,       growth: 1.155, mult: 0.14,  desc: "Recettes maison éprouvées." },
  { id: "farm",     mode: "mult", name: "Ferme (clic)",    emoji: "🌾", base: 1400,      growth: 1.16,  mult: 0.7,   desc: "Boost agricole pour les clics." },
  { id: "factory",  mode: "mult", name: "Usine (clic)",    emoji: "🏭", base: 18000,     growth: 1.165, mult: 2.8,   desc: "Assemblage de clics optimisé." },
  { id: "bank",     mode: "mult", name: "Banque (clic)",   emoji: "🏦", base: 220000,    growth: 1.17,  mult: 9.0,   desc: "Crédit de puissance de clic." },
  { id: "ai",       mode: "mult", name: "IA Boulangerie",  emoji: "🤖", base: 3000000,   growth: 1.175, mult: 27,    desc: "Optimisation ML de vos clics." },
  { id: "tm",       mode: "mult", name: "Machine à Temps", emoji: "⌛", base: 32000000,  growth: 1.18,  mult: 72,    desc: "Plie le temps pour cliquer plus fort." },
];
