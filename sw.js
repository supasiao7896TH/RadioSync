'use strict';

// Firebase Messaging compat — required for background FCM push delivery
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBr56MeNH5Md7Xan0bBXu1HzbErWTPKbro',
  authDomain:        'radiosync-6662c.firebaseapp.com',
  projectId:         'radiosync-6662c',
  storageBucket:     'radiosync-6662c.firebasestorage.app',
  messagingSenderId: '605359206228',
  appId:             '1:605359206228:web:bfbc3514675887d666e2c1',
});

const _fcm = firebase.messaging();

// Handle FCM push when app is in background / closed
_fcm.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'RadioSync';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon:  './icon-192.png',
    badge: './icon-192.png',
    tag:   'radiosync-push',
    renotify: true,
    data: { url: 'https://supasiao7896th.github.io/RadioSync/' },
  });
});

// Open / focus the app when admin taps the notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://supasiao7896th.github.io/RadioSync/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('RadioSync') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// ─── App-shell cache ──────────────────────────────────────────────────────────

const CACHE_NAME   = 'radiosync-v8';
const STATIC_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-only for Firebase, CDN — never cache these
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('jsdelivr.net')
  ) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first for local app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
