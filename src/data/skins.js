export const SKINS = {
  default: { id: "default", name: "Choco", price: 0, src: "/cookie.png", description: "Le classique indémodable." },
  starter: {
    id: "starter",
    name: "Starter",
    price: 1_000,
    src: "/cookie-caramel.png",
    className: "saturate-[1.1] hue-rotate-[12deg] brightness-110",
    description: "Ton premier skin personnalisé.",
  },
  early: {
    id: "early",
    name: "Early",
    price: 10_000,
    src: "/cookie-noir.png",
    className: "contrast-[1.08] sepia-[0.15] saturate-[1.1]",
    description: "Pour les joueurs ambitieux.",
  },
  caramel: {
    id: "caramel",
    name: "Caramel",
    price: 50_000,
    src: "/cookie-caramel.png",
    className: "saturate-[1.25] hue-rotate-[18deg]",
    description: "Douceur caramélisée.",
  },
  noir: {
    id: "noir",
    name: "Noir",
    price: 200_000,
    src: "/cookie-noir.png",
    className: "contrast-[1.1] saturate-[0.9]",
    description: "Élégance sombre.",
  },
  // Les deux dernières apparences ne s'achètent pas en cookies mais en CRMB.
  // Une monnaie de récompense doit avoir quelque chose de désirable à acheter,
  // sinon elle s'accumule sans que personne ne la regarde. Dix CRMB, c'est
  // environ deux heures et demie de quêtes: un objectif de plusieurs sessions.
  ice: { id: "ice", name: "Ice", price: 0, crmb: 10, src: "/cookie-ice.png", description: "Fraîcheur glaciale. Payable en CRMB." },
  fire: { id: "fire", name: "Lava", price: 0, crmb: 25, src: "/cookie-fire.png", description: "Puissance volcanique. Payable en CRMB." },
};

export const SKIN_LIST = Object.values(SKINS);
