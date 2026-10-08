import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api/helpers";
import {
  notificationBus,
  RealtimeNotificationPayload,
  TechnicianLocationPayload,
} from "@/lib/notifications/bus";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
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

      // Live technician locations (monitoring roles only)
      const unsubscribeLoc = canMonitorLocations
        ? notificationBus.subscribeLocations((payload: TechnicianLocationPayload) => {
            send("location", payload);
          })
        : () => {};

      // Fallback polling (e.g. notification created by another process) + heartbeat
      const intervalId = setInterval(async () => {
        if (isClosed) {
          clearInterval(intervalId);
          unsubscribeNotif();
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
        } catch {
          // Suppress temporary DB errors during polling
        }

        send("heartbeat", { timestamp: new Date().toISOString() });
      }, 15000);

      req.signal.addEventListener("abort", () => {
        isClosed = true;
        clearInterval(intervalId);
        unsubscribeNotif();
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
