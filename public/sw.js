// Hand-rolled service worker (no build dependency). Makes the parent app
// installable and usable offline after the first visit: it caches the app
// shell and static assets, keeps the latest knowledge base for offline answers,
// and never caches the model endpoint (offline answering is handled in-app).
// Bump this when the cached shell (index.html, icons, manifest) changes so the
// activate handler evicts the old cache. Hashed JS/CSS get fresh keys on their own.
const VERSION = "cws-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POSTs (ask, requests) are handled in-app
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match("/")
            .then((r) => r || caches.match("/index.html"))
            .then(
              (r) =>
                r ||
                new Response("Offline", {
                  status: 503,
                  headers: { "content-type": "text/html; charset=utf-8" },
                }),
            ),
        ),
    );
    return;
  }

  // Knowledge base: network-first, but keep the last copy for offline answers.
  if (url.pathname === "/api/kb") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then(
              (r) =>
                r ||
                new Response("{}", {
                  status: 503,
                  headers: { "content-type": "application/json" },
                }),
            ),
        ),
    );
    return;
  }

  // Other API calls: network only; the app degrades gracefully offline.
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || new Response("", { status: 503 }));
      return cached || network;
    }),
  );
});
