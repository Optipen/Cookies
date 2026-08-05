// Service worker de Crumbora
//
// Objectif: le jeu doit se lancer instantanément aux visites suivantes et
// rester jouable hors connexion. Toute la logique tourne côté client et la
// sauvegarde vit dans localStorage, donc rien d'autre n'est nécessaire — c'est
// aussi ce qui permet au jeu d'encaisser n'importe quel nombre de joueurs:
// chaque partie est locale, l'hébergement ne sert que des fichiers statiques.
//
// Les caches portent le nouveau nom: l'activation supprime tout cache absent
// de la liste courante, ceux de l'ancien nom disparaissent donc seuls à la
// première visite après le renommage. La sauvegarde, elle, vit dans
// localStorage et ne bouge pas.

const VERSION = "v2";
const SHELL_CACHE = `crumbora-shell-${VERSION}`;
const ASSET_CACHE = `crumbora-assets-${VERSION}`;

// Ressources indispensables au premier écran
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/cookie.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `addAll` échoue en bloc si une seule requête rate: on tolère les absences
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: on privilégie le réseau pour récupérer les mises à jour,
  // avec repli sur le cache si la connexion est absente.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html").then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Assets versionnés par Vite (hash dans le nom) et médias: cache d'abord.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
