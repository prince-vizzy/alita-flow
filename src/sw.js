/// <reference lib="webworker" />

// The app's own service worker. It was a generated Workbox file until the
// morning summary needed somewhere to land — a push event has to be handled
// here, in code that runs with no page open, so the worker is written by hand
// now and Workbox only injects the precache list into it.

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// registerType: 'autoUpdate' — a new build takes over as soon as it lands
// rather than waiting for every tab to close.
self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// The app is a single page behind client-side routing, so every navigation
// resolves to the shell — that is what makes /shop and /trolley open offline.
// Everything under /api is a real server route and must never be answered
// with the shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] })
);

/* ------------------------------ Morning summary --------------------------- */

// Sent by api/notify.js, once for the shop and once for the trolley:
// { title, body, tag, url }. The tag is per section, so a second morning's
// shop note replaces the first rather than stacking up a week of unread
// summaries on the lock screen.
const FALLBACK = {
  title: 'Alita Flow',
  body: 'Yesterday’s numbers are ready.',
  tag: 'alita-flow',
  url: '/dashboard',
};

self.addEventListener('push', (event) => {
  let payload = FALLBACK;
  if (event.data) {
    try {
      payload = { ...FALLBACK, ...event.data.json() };
    } catch {
      // A push with an unreadable body still means something happened, and a
      // generic nudge to open the dashboard beats swallowing it.
      payload = { ...FALLBACK, body: event.data.text() || FALLBACK.body };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: payload.url },
      // Yesterday's takings are not urgent enough to buzz a pocket at six in
      // the morning; the notification is there to be found, not to interrupt.
      silent: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';

  // Reuse the window that is already open where possible — a shopkeeper
  // tapping a summary should land on the dashboard, not on a third copy of
  // the app.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
