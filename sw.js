/* Bayou Lines service worker — offline play, update-safe.
   Strategy: navigation = network-first (always get the latest page when
   online, fall back to cache offline). Assets = stale-while-revalidate
   (instant from cache, refreshed in the background for next time). */
const VERSION = "bayou-v9";
const CORE = [
  "./", "./index.html", "./styles.css",
  "./data.js", "./fishart.js", "./campart.js", "./sceneryart.js", "./audio.js", "./game.js",
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
  const url = new URL(req.url);

  // App code (HTML/JS/CSS/manifest) = NETWORK-FIRST so updates land immediately
  // when online; fall back to cache only when offline. This prevents the
  // "new HTML, old JS" mismatch that strands buttons without their handlers.
  const isCode = req.mode === "navigate" || /\.(html|js|css|webmanifest)$/.test(url.pathname);
  if (isCode) {
    e.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(VERSION).then(cache => cache.put(req, c)); return r; })
        .catch(() => caches.match(req).then(m => m || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
    );
    return;
  }

  // Static assets (icons, images, fonts) = cache-first with background refresh
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req)
        .then(r => { if (r && (r.ok || r.type === "opaque")) { const c = r.clone(); caches.open(VERSION).then(cache => cache.put(req, c)); } return r; })
        .catch(() => cached);
      return cached || net;
    })
  );
});
