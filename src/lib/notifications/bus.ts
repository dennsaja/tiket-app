import { EventEmitter } from "events";

export interface RealtimeNotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  ticketId?: string;
  data?: Record<string, any>;
  createdAt?: string;
}

class NotificationBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  emitNotification(payload: RealtimeNotificationPayload) {
    this.emit(`notify:${payload.userId}`, payload);
    this.emit("broadcast", payload);
  }

  subscribeUser(userId: string, callback: (payload: RealtimeNotificationPayload) => void) {
    const channel = `notify:${userId}`;
    this.on(channel, callback);
    return () => {
      this.off(channel, callback);
    };
  }
}

// Global singleton across serverless/Node lifecycle
const globalForNotification = globalThis as unknown as {
  notificationBus?: NotificationBus;
};

export const notificationBus =
  globalForNotification.notificationBus ?? new NotificationBus();

if (process.env.NODE_ENV !== "production") {
  globalForNotification.notificationBus = notificationBus;
}
