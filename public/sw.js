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

const VERSION = "v3";
const SHELL_CACHE = `crumbora-shell-${VERSION}`;
const ASSET_CACHE = `crumbora-assets-${VERSION}`;

// Le SQUELETTE, et rien d'autre: le document et ses métadonnées.
//
// Les images n'y sont plus, et c'est structurel. `caches.match` interroge les
// caches dans leur ordre de création: une image précachée ici gagnait TOUJOURS,
// et le rafraîchissement en arrière-plan — qui écrit dans le cache des assets —
// n'était jamais servi. Un cookie retouché n'atteignait donc jamais un joueur
// déjà venu, exactement le défaut qu'on voulait corriger.
//
// Rien n'est perdu: la première visite en ligne remplit `ASSET_CACHE`, et le
// jeu reste jouable hors connexion à partir de là.
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.ico"];

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

  // Deux régimes, et la différence tient à UNE chose: le nom du fichier
  // change-t-il quand son contenu change ?
  //
  //   · `/assets/…` — Vite y met un hash: un contenu différent a forcément une
  //     autre URL. Le cache ne peut donc jamais être périmé: on sert, point.
  //   · tout le reste — images, sons, manifeste — garde son nom d'une version
  //     à l'autre. En cache d'abord SANS revalidation, un joueur déjà venu ne
  //     recevait JAMAIS un cookie retouché: il gardait l'ancien pour toujours.
  //     On sert donc le cache tout de suite (rapide, et hors ligne ça marche)
  //     et on rafraîchit en arrière-plan pour la visite suivante.
  const versionne = url.pathname.startsWith("/assets/");

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      // On interroge le cache des assets NOMMÉMENT, et pas `caches.match`, qui
      // balaie tous les caches dans leur ordre de création: la lecture et
      // l'écriture doivent porter sur le même cache, sinon un rafraîchissement
      // écrit quelque part que la lecture ne regarde jamais.
      const cached = await cache.match(request);
      if (cached && versionne) return cached;

      const reseau = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        })
        // Hors connexion: le cache des assets d'abord, puis le squelette en
        // dernier recours — il porte le document et le manifeste.
        .catch(async () => cached || (await caches.match(request)));

      // `waitUntil` garde le service worker en vie le temps du rafraîchissement:
      // sans lui, le navigateur peut l'arrêter dès la réponse servie et la mise
      // à jour n'arriverait jamais dans le cache.
      if (cached) {
        event.waitUntil(reseau);
        return cached;
      }
      return (await reseau) || (await caches.match(request));
    })
  );
});
