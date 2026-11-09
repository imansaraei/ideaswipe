// Service Worker for IdeaSwipe Background FCM Notifications & Deep-linking
/* eslint-disable no-undef */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (err) {
      payload = {
        notification: {
          title: 'IdeaSwipe',
          body: event.data.text(),
        },
      };
    }
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'IdeaSwipe';
  const options = {
    body: notification.body || data.body || 'New batch of ideas ready to swipe!',
    icon: notification.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'ideaswipe-daily-shuffle',
    renotify: true,
    data: {
      url: data.url || notification.click_action || '/',
      ...data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Try to find an existing client matching the url or open window
        for (const client of windowClients) {
          if ('focus' in client) {
            if (client.url.includes(targetUrl) || targetUrl === '/') {
              return client.focus();
            }
          }
        }
        // If no matching open window, open a new window to the target URL
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
