import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { markAllNotificationsRead } from "@/lib/notifications";

// GET /api/notifications — get user notifications
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userId = session.user.id!;
  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") || "20")));
  const offset = (page - 1) * perPage;
  const unreadOnly = searchParams.get("unread") === "true";

  const where = unreadOnly
    ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    : eq(notifications.userId, userId);

  const [userNotifications, [{ total }]] = await Promise.all([
    db.query.notifications.findMany({
      where,
      with: {
        ticket: { columns: { id: true, ticketNumber: true, title: true } },
      },
      orderBy: [desc(notifications.createdAt)],
      limit: perPage,
      offset,
    }),
    db.select({ total: count() }).from(notifications).where(where),
  ]);

  const [{ unread }] = await db
    .select({ unread: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return NextResponse.json({
    notifications: userNotifications,
    unreadCount: Number(unread),
    meta: {
      total: Number(total),
      page,
      perPage,
      pageCount: Math.ceil(Number(total) / perPage),
    },
  });
}

// POST /api/notifications — mark all as read
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userId = session.user.id!;
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  if (body.action === "mark_all_read") {
    await markAllNotificationsRead(userId);
    return NextResponse.json({ success: true });
  }

  return errorResponse("Invalid action", 400);
}
