import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { markNotificationRead } from "@/lib/notifications";

// PATCH /api/notifications/[id] — mark notification as read
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userId = session.user.id!;

  const notification = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, id), eq(notifications.userId, userId)),
  });

  if (!notification) return errorResponse("Notification not found", 404);

  await markNotificationRead(id, userId);
  return NextResponse.json({ success: true });
}
