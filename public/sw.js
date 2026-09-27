// Service Worker for HelpDesk Real-time Android & Web Push Notifications
const CACHE_NAME = "helpdesk-notifications-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle custom messages from client pages to trigger background/foreground notification
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      vibrate: [300, 150, 300, 150, 450],
      requireInteraction: true,
      renotify: true,
      ...options,
    });
  }
});

// Handle Web Push event (standard protocol)
self.addEventListener("push", (event) => {
  let data = { title: "HelpDesk Notification", body: "Ada tiket baru untuk Anda." };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const title = data.title || "🚨 Penugasan Tiket Baru";
  const options = {
    body: data.body || data.message || "Tiket baru telah ditugaskan kepada Anda.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.ticketId ? `ticket-${data.ticketId}` : "general-notification",
    data: {
      url: data.ticketId ? `/tickets/${data.ticketId}` : "/tickets",
      ticketId: data.ticketId,
    },
    vibrate: [300, 150, 300, 150, 450],
    requireInteraction: true,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click on desktop / Android
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/tickets";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a tab with the app is already open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
