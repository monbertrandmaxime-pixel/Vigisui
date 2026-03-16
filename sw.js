// VigiSuivi — Service Worker PWA
// Cache hors ligne + notifications en arrière-plan

const CACHE_NAME = 'vigisui-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// ── Installation : mise en cache des assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activation : nettoyage des anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : réponse hors ligne ──
self.addEventListener('fetch', event => {
  // Ne pas intercepter les appels API Anthropic
  if (event.request.url.includes('api.anthropic.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('accounts.google.com')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Mettre en cache les nouvelles ressources
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Hors ligne : retourner l'app principale
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── Notifications push en arrière-plan ──
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  const title = data.title || '📅 VigiSuivi — Rappel RDV';
  const options = {
    body: data.body || 'Vous avez un rendez-vous prévu.',
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'vigisui-rdv',
    data: { url: data.url || './' },
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic sur notification : ouvrir l'app ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(clientList => {
      // Si l'app est déjà ouverte, la mettre au premier plan
      for (const client of clientList) {
        if (client.url.includes('vigisui') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Sync en arrière-plan (sauvegarde auto) ──
self.addEventListener('sync', event => {
  if (event.tag === 'vigisui-backup') {
    event.waitUntil(
      // Notifier le client pour déclencher la sauvegarde
      clients.matchAll().then(clientList => {
        clientList.forEach(client => {
          client.postMessage({type:'SYNC_BACKUP'});
        });
      })
    );
  }
});

console.log('VigiSuivi Service Worker chargé ✅');
