/* Pro Tebe — Advanced Service Worker for PWA */

const CACHE_NAME = 'pro-tebe-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
];

// Queue for offline messages (using IndexedDB would be better, but for simplicity we use a simple array + sync)
let messageQueue = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Helper: Check if request is navigation
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Main fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never cache non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API calls — try network first, fallback to cache for some endpoints
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses for pair data and recent messages
          if (response.ok && (url.pathname.includes('/pair/') || url.pathname.includes('/messages/'))) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback for important data
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            
            // Return a friendly offline response for API calls
            return new Response(
              JSON.stringify({ error: 'offline', message: 'Jste offline. Zprávy se odešlou po obnovení připojení.' }),
              { 
                status: 503, 
                headers: { 'Content-Type': 'application/json' } 
              }
            );
          });
        })
    );
    return;
  }

  // Navigation requests → serve app shell when offline (SPA)
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkPromise;
    })
  );
});

// Background Sync for sending messages when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  // In a real implementation we would use IndexedDB to store the queue.
  // For now we just notify the client to retry sending.
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_MESSAGES' });
  });
}

// Push Notifications
self.addEventListener('push', (event) => {
  let data = {};
  
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Pro Tebe', body: event.data.text() };
  }

  const options = {
    body: data.body || 'Máte novou zprávu',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    data: {
      url: data.url || '/',
    },
    vibrate: [100, 50, 100],
    tag: 'pro-tebe-message',
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Pro Tebe', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data?.url || '/';
      
      // Focus existing window or open new one
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});