import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, ticketAssignees, users } from "@/lib/db/schema";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getMobileUserFromRequest } from "@/lib/auth/mobile";
import { parseCoordinates } from "@/lib/utils/geo";

export async function GET(req: NextRequest) {
  const session = await auth();
  const mobileUser = !session?.user ? await getMobileUserFromRequest(req) : null;
  const currentUser = session?.user || mobileUser;

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = currentUser.id!;
  const userRole = (currentUser as any).role;

  // Find all tickets where technician is primary assignee OR in ticketAssignees team
  const myAssignments = await db
    .select({ ticketId: ticketAssignees.ticketId, isLead: ticketAssignees.isLead })
    .from(ticketAssignees)
    .where(eq(ticketAssignees.userId, userId))
    .catch(() => [] as { ticketId: string; isLead: boolean }[]);

  const assignedMap = new Map(myAssignments.map((a) => [a.ticketId, a.isLead]));
  const assignedIds = Array.from(assignedMap.keys());

  const conditions: any[] = [isNull(tickets.deletedAt)];

  if (userRole === "agent") {
    if (assignedIds.length > 0) {
      conditions.push(or(eq(tickets.assigneeId, userId), inArray(tickets.id, assignedIds)));
    } else {
      conditions.push(eq(tickets.assigneeId, userId));
    }
  }

  const ticketRows = await db.query.tickets.findMany({
    where: and(...conditions),
    columns: {
      id: true,
      ticketNumber: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      ticketType: true,
      reporterName: true,
      reporterPhone: true,
      reporterAddress: true,
      reporterMapUrl: true,
      assigneeId: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      assignee: {
        columns: { id: true, name: true, phone: true },
      },
      assignees: {
        columns: { userId: true, isLead: true },
        with: {
          user: { columns: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: [
      sql`CASE ${tickets.status}
        WHEN 'on_site' THEN 0
        WHEN 'in_progress' THEN 1
        WHEN 'accepted' THEN 2
        WHEN 'assigned' THEN 3
        WHEN 'open' THEN 4
        WHEN 'resolved' THEN 5
        ELSE 6 END`,
      desc(tickets.updatedAt),
    ],
    limit: 100,
  });

  const formatted = ticketRows.map((t) => {
    const coords = parseCoordinates(t.reporterMapUrl) || parseCoordinates(t.reporterAddress);
    const isLead = assignedMap.get(t.id) ?? (t.assigneeId === userId);

    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      ticketType: t.ticketType,
      reporterName: t.reporterName,
      reporterPhone: t.reporterPhone,
      reporterAddress: t.reporterAddress,
      reporterMapUrl: t.reporterMapUrl,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      isLead,
      assignees: t.assignees?.map((a) => ({
        id: a.user?.id,
        name: a.user?.name,
        phone: a.user?.phone,
        isLead: a.isLead,
      })) || [],
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    success: true,
    tickets: formatted,
    total: formatted.length,
  });
}
