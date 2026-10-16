import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api/helpers";
import {
  notificationBus,
  RealtimeNotificationPayload,
  RealtimeSystemEvent,
  TechnicianLocationPayload,
} from "@/lib/notifications/bus";
import { db } from "@/lib/db";
import { notifications, tickets } from "@/lib/db/schema";
import { and, desc, eq, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/sse — Server-Sent Events for instant real-time updates, notifications & live locations
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userId = session.user.id!;
  const userRole = (session.user as any).role;
  const canMonitorLocations = ["noc", "owner", "admin"].includes(userRole);
  const encoder = new TextEncoder();

  let lastCheckedTime = new Date();
  let lastTicketCheckTime = new Date();
  const deliveredIds = new Set<string>();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      // Unnamed SSE messages carrying { type, data } so EventSource.onmessage receives every event
      const send = (type: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      // Hint browser to reconnect quickly if the connection drops
      controller.enqueue(encoder.encode(`retry: 3000\n\n`));
      send("connected", { userId, timestamp: new Date().toISOString() });

      // Personal notifications (instant push)
      const unsubscribeNotif = notificationBus.subscribeUser(
        userId,
        (payload: RealtimeNotificationPayload) => {
          lastCheckedTime = new Date();
          send("notification", payload);
        }
      );

      // System-wide ticket & chat events (instant push for live UI updates)
      const unsubscribeSystem = notificationBus.subscribeSystemEvents(
        (payload: RealtimeSystemEvent) => {
          lastTicketCheckTime = new Date();
          send("system_event", payload);
        }
      );

      // Live technician locations (monitoring roles only)
      const unsubscribeLoc = canMonitorLocations
        ? notificationBus.subscribeLocations((payload: TechnicianLocationPayload) => {
            send("location", payload);
          })
        : () => {};

      // Fallback polling (e.g. notification or ticket update created by another process) + heartbeat
      const intervalId = setInterval(async () => {
        if (isClosed) {
          clearInterval(intervalId);
          unsubscribeNotif();
          unsubscribeSystem();
          unsubscribeLoc();
          return;
        }

        try {
          const since = lastCheckedTime;
          lastCheckedTime = new Date();
          const recentNotifs = await db.query.notifications.findMany({
            where: and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, false),
              gt(notifications.createdAt, since)
            ),
            orderBy: [desc(notifications.createdAt)],
            limit: 5,
          });

          for (const notif of recentNotifs) {
            if (deliveredIds.has(notif.id)) continue;
            deliveredIds.add(notif.id);
            send("notification", {
              id: notif.id,
              userId: notif.userId,
              type: notif.type,
              title: notif.title,
              message: notif.message,
              ticketId: notif.ticketId,
              data: notif.data,
              createdAt: notif.createdAt.toISOString(),
              fromPolling: true,
            });
          }

          // Check if any ticket was modified since lastTicketCheckTime (fallback if multi-worker)
          const ticketSince = lastTicketCheckTime;
          lastTicketCheckTime = new Date();
          const recentlyUpdatedTicket = await db.query.tickets.findFirst({
            where: gt(tickets.updatedAt, ticketSince),
            orderBy: [desc(tickets.updatedAt)],
            columns: { id: true, ticketNumber: true, status: true, updatedAt: true },
          });

          if (recentlyUpdatedTicket) {
            send("system_event", {
              action: "ticket_updated",
              ticketId: recentlyUpdatedTicket.id,
              ticketNumber: recentlyUpdatedTicket.ticketNumber,
              status: recentlyUpdatedTicket.status,
              timestamp: recentlyUpdatedTicket.updatedAt.toISOString(),
            });
          }
        } catch {
          // Suppress temporary DB errors during polling
        }

        send("heartbeat", { timestamp: new Date().toISOString() });
      }, 10000);

      req.signal.addEventListener("abort", () => {
        isClosed = true;
        clearInterval(intervalId);
        unsubscribeNotif();
        unsubscribeSystem();
        unsubscribeLoc();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx/proxy buffering for instant push
    },
  });
}
