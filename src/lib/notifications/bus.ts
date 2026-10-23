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

export interface TechnicianLocationPayload {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  battery?: number | null;
  isTracking: boolean;
  activeTicketId?: string | null;
  updatedAt: string;
}

export interface RealtimeSystemEvent {
  action:
    | "ticket_created"
    | "ticket_updated"
    | "ticket_deleted"
    | "message_created"
    | "work_report_submitted";
  ticketId: string;
  ticketNumber?: number;
  status?: string;
  actorId?: string;
  actorName?: string;
  message?: any;
  timestamp: string;
}

class NotificationBus extends EventEmitter {
  emitMobileConfig(version: number) { this.emit("mobile_config", version); }

  subscribeMobileConfig(callback: (version: number) => void) {
    this.on("mobile_config", callback);
    return () => { this.off("mobile_config", callback); };
  }

  constructor() {
    super();
    this.setMaxListeners(500);
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

  emitLocation(payload: TechnicianLocationPayload) {
    this.emit("location", payload);
  }

  subscribeLocations(callback: (payload: TechnicianLocationPayload) => void) {
    this.on("location", callback);
    return () => {
      this.off("location", callback);
    };
  }

  emitSystemEvent(payload: RealtimeSystemEvent) {
    this.emit("system_event", payload);
  }

  subscribeSystemEvents(callback: (payload: RealtimeSystemEvent) => void) {
    this.on("system_event", callback);
    return () => {
      this.off("system_event", callback);
    };
  }
}

// Global singleton across serverless/Node lifecycle
const globalForNotification = globalThis as unknown as {
  notificationBus?: NotificationBus;
};

export const notificationBus =
  globalForNotification.notificationBus ?? new NotificationBus();

// Pin to globalThis in all environments so separate route bundles share one emitter
globalForNotification.notificationBus = notificationBus;

