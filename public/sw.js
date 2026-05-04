// 따로또같이 — combined service worker
//   1. PWA shell cache for offline navigation
//   2. Firebase Cloud Messaging background handler

// === Firebase Messaging (background) ===
importScripts(
  "https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDu9PqrXsYioUsMDMsj9CkTXGqatDc3w8s",
  authDomain: "ttogachi.firebaseapp.com",
  projectId: "ttogachi",
  storageBucket: "ttogachi.firebasestorage.app",
  messagingSenderId: "553897117082",
  appId: "1:553897117082:web:78cc02b56d8287c6972623",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "따로또같이";
  const body = (payload.notification && payload.notification.body) || "";
  return self.registration.showNotification(title, {
    body,
    icon: "/icon.svg",
    tag: "ttogachi-fcm",
    data: payload.data,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      const url = (event.notification.data && event.notification.data.url) || "/";
      for (const c of cs) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// === PWA Shell ===
const CACHE_NAME = "ttogachi-shell-v2";
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
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/")));
});
