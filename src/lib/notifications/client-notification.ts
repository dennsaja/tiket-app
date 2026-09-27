"use client";

import { playNotificationSound, vibrateDevice, unlockAudioContext } from "@/lib/utils/sound";

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register Service Worker for Android / PWA push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    swRegistration = reg;
    return reg;
  } catch (err) {
    console.warn("[SW] Registration error:", err);
    return null;
  }
}

/**
 * Get current browser notification permission state
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  // Also unlock audio context on this user click gesture
  unlockAudioContext();

  try {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      // Register service worker immediately
      await registerServiceWorker();
      // Play a short chime to test & confirm audio is unlocked
      playNotificationSound("success");
    }
    return perm;
  } catch {
    return Notification.permission;
  }
}

export interface PushNotificationInput {
  title: string;
  message: string;
  ticketId?: string;
  ticketNumber?: number;
  ticketType?: string;
  priority?: string;
  playSound?: boolean;
}

/**
 * Trigger native browser / Android push notification + sound + vibration
 */
export async function triggerClientNotification(input: PushNotificationInput): Promise<void> {
  if (typeof window === "undefined") return;

  const { title, message, ticketId, playSound = true } = input;

  // 1. Play sound chime
  if (playSound) {
    playNotificationSound("ticket_assigned");
  }

  // 2. Vibrate mobile device
  vibrateDevice([300, 150, 300, 150, 450]);

  // 3. Trigger Browser / Android Native Notification if granted
  if ("Notification" in window && Notification.permission === "granted") {
    const options: any = {
      body: message,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: ticketId ? `ticket-${ticketId}` : `notif-${Date.now()}`,
      data: {
        url: ticketId ? `/tickets/${ticketId}` : "/tickets",
        ticketId,
      },
      vibrate: [300, 150, 300, 150, 450],
      requireInteraction: true,
    };

    try {
      // Prefer ServiceWorker showNotification (vital for Android mobile notifications)
      if (swRegistration?.showNotification) {
        await swRegistration.showNotification(title, options);
      } else if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_NOTIFICATION",
          title,
          options,
        });
      } else {
        // Fallback to standard window.Notification
        const n = new Notification(title, options);
        n.onclick = () => {
          window.focus();
          if (ticketId) {
            window.location.href = `/tickets/${ticketId}`;
          }
        };
      }
    } catch (err) {
      console.warn("[Push] Error showing native notification:", err);
    }
  }
}
