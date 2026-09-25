// Minimal service worker: cache-first for the app's static assets,
// always network for the API (data must be fresh).
const CACHE = 'terminal-v25';
const APP_SHELL = ['/terminal/', '/terminal/manifest.webmanifest', '/terminal/icon.svg', '/terminal/icon-192.png', '/terminal/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isAppAsset = url.pathname.startsWith('/terminal/');
    if (event.request.method !== 'GET' || !isAppAsset) {
        return; // API calls and writes always hit the network
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);
            return cached || fetched;
        })
    );
});
