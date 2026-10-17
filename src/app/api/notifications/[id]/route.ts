import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { markNotificationRead } from "@/lib/notifications";

// PATCH /api/notifications/[id] — mark notification as read (supports Web Session & Android Bearer Token)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userId = currentUser.id;

  const notification = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, id), eq(notifications.userId, userId)),
  });

  if (!notification) return errorResponse("Notification not found", 404);

  await markNotificationRead(id, userId);
  return NextResponse.json({ success: true });
}
