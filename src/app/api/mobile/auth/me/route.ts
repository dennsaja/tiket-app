import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, tickets, ticketAssignees } from "@/lib/db/schema";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getMobileUserFromRequest } from "@/lib/auth/mobile";

export async function GET(req: NextRequest) {
  const mobileUser = await getMobileUserFromRequest(req);
  if (!mobileUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, mobileUser.id),
  });

  if (!user || !user.isActive || user.deletedAt) {
    return NextResponse.json({ error: "User tidak aktif atau tidak ditemukan" }, { status: 403 });
  }

  // Count active tickets
  const myAssignments = await db
    .select({ ticketId: ticketAssignees.ticketId })
    .from(ticketAssignees)
    .where(eq(ticketAssignees.userId, user.id))
    .catch(() => [] as { ticketId: string }[]);
  const assignedIds = myAssignments.map((a) => a.ticketId);

  const activeTickets = await db.query.tickets.findMany({
    where: and(
      isNull(tickets.deletedAt),
      inArray(tickets.status, ["assigned", "accepted", "on_site", "in_progress"] as any),
      assignedIds.length > 0
        ? or(eq(tickets.assigneeId, user.id), inArray(tickets.id, assignedIds))
        : eq(tickets.assigneeId, user.id)
    ),
    columns: { id: true },
  });

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      activeTicketsCount: activeTickets.length,
    },
  });
}
