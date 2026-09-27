import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api/helpers";
import { notificationBus, RealtimeNotificationPayload } from "@/lib/notifications/bus";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, desc, eq, gt } from "drizzle-orm";

// GET /api/sse — Server-Sent Events for instant real-time updates & notifications
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userId = session.user.id!;
  const encoder = new TextEncoder();

  let lastCheckedTime = new Date(Date.now() - 10000); // 10s ago

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          isClosed = true;
        }
      };

      // Send initial connection confirmation
      sendEvent("connected", { userId, timestamp: new Date().toISOString() });

      // Subscribe to real-time notification bus
      const unsubscribe = notificationBus.subscribeUser(userId, (payload: RealtimeNotificationPayload) => {
        sendEvent("notification", payload);
      });

      // Periodic check as fallback and heartbeat every 6 seconds
      const intervalId = setInterval(async () => {
        if (isClosed) {
          clearInterval(intervalId);
          unsubscribe();
          return;
        }

        try {
          // Check for any new unread notifications that may have been missed
          const recentNotifs = await db.query.notifications.findMany({
            where: and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, false),
              gt(notifications.createdAt, lastCheckedTime)
            ),
            orderBy: [desc(notifications.createdAt)],
            limit: 5,
          });

          if (recentNotifs.length > 0) {
            lastCheckedTime = new Date();
            for (const notif of recentNotifs) {
              sendEvent("notification", {
                id: notif.id,
                userId: notif.userId,
                type: notif.type,
                title: notif.title,
                message: notif.message,
                ticketId: notif.ticketId,
                data: notif.data,
                createdAt: notif.createdAt.toISOString(),
              });
            }
          }

          // Send heartbeat
          sendEvent("heartbeat", { timestamp: new Date().toISOString() });
        } catch {
          // Suppress DB temporary errors during polling
        }
      }, 6000);

      // Clean up on disconnect
      req.signal.addEventListener("abort", () => {
        isClosed = true;
        clearInterval(intervalId);
        unsubscribe();
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
      "X-Accel-Buffering": "no", // Disable Nginx buffering for instant push
    },
  });
}
