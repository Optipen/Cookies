// Service worker de Cookie Craze
//
// Objectif: le jeu doit se lancer instantanément aux visites suivantes et
// rester jouable hors connexion. Toute la logique tourne côté client et la
// sauvegarde vit dans localStorage, donc rien d'autre n'est nécessaire — c'est
// aussi ce qui permet au jeu d'encaisser n'importe quel nombre de joueurs:
// chaque partie est locale, l'hébergement ne sert que des fichiers statiques.

const VERSION = "v1";
const SHELL_CACHE = `cookiecraze-shell-${VERSION}`;
const ASSET_CACHE = `cookiecraze-assets-${VERSION}`;

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
