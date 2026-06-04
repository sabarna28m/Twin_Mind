/**
 * TwinMind Service Worker
 * Strategy:
 *   - Static assets (JS/CSS/fonts/icons): Cache-first (versioned filenames handle busting)
 *   - API calls (/api/v1/*):              Network-first, no cache (always fresh data)
 *   - Navigation (HTML):                  Network-first with offline fallback
 */

const CACHE_NAME = 'twinmind-v1';
const OFFLINE_URL = '/';

const STATIC_EXTENSIONS = ['.js', '.css', '.woff2', '.woff', '.ttf', '.png', '.svg', '.ico'];

// ── Install: cache the app shell ─────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL])
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing logic ──────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls — always network, never cache
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets — cache-first
  const ext = url.pathname.slice(url.pathname.lastIndexOf('.'));
  if (STATIC_EXTENSIONS.includes(ext)) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached ?? fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Navigation — network-first, fallback to cached index
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached ?? new Response('Offline', { status: 503 }))
    )
  );
});

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'TwinMind', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'TwinMind', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
