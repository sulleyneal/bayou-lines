/* Bayou Lines service worker — offline play, update-safe.
   Strategy: navigation = network-first (always get the latest page when
   online, fall back to cache offline). Assets = stale-while-revalidate
   (instant from cache, refreshed in the background for next time). */
const VERSION = "bayou-v1";
const CORE = [
  "./", "./index.html", "./styles.css",
  "./data.js", "./audio.js", "./game.js",
  "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-180.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(VERSION).then(cache => cache.put(req, c)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req)
        .then(r => { if (r && (r.ok || r.type === "opaque")) { const c = r.clone(); caches.open(VERSION).then(cache => cache.put(req, c)); } return r; })
        .catch(() => cached);
      return cached || net;
    })
  );
});
