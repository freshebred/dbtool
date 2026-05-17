/**
 * pwaDb Service Worker — Cache-first for static assets
 */
const CACHE = 'pwadb-v1';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/db.js',
  '/js/api.js',
  '/js/views/connections.js',
  '/js/views/databases.js',
  '/js/views/collections.js',
  '/js/views/documents.js',
  '/js/views/editor.js',
  '/js/components/theme.js',
  '/js/components/toast.js',
  '/js/components/modal.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache all static files
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static, network-first for /api/
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for API calls
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — server not reachable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
