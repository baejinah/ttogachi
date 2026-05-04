// 따로또같이 — minimal service worker for PWA installability
// MVP scope: cache app shell for offline navigation; no data caching
// (Firestore handles its own offline persistence).

const CACHE_NAME = "ttogachi-shell-v1";
const SHELL_ASSETS = ["/", "/icon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch((err) => console.warn("SW: shell precache failed", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only intercept top-level navigations; let everything else hit network
  // directly so Firestore long-polling and Next.js HMR are not affected.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match("/"))
  );
});
