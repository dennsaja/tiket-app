import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, users, departments, ticketMessages } from "@/lib/db/schema";
import { eq, desc, and, or, isNull, sql, inArray } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";

// GET /api/chat/rooms — List all ticket chat channels for Admin and matching Department Agents
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  // Only NOC, Owner, Admin and Agents can access department chats
  if (!["noc", "owner", "admin", "agent"].includes(userRole)) {
    return errorResponse("Forbidden: Only support staff can access department chats", 403);
  }

  // Get agent's department
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, departmentId: true, role: true },
  });

  const userDeptId = currentUser?.departmentId;

  // Build query conditions
  const conditions: any[] = [isNull(tickets.deletedAt)];

  // If Agent (not Admin/NOC/Owner), strictly restrict to tickets they are assigned to
  if (userRole === "agent") {
    const { ticketAssignees } = await import("@/lib/db/schema");
    const myAssignments = await db
      .select({ ticketId: ticketAssignees.ticketId })
      .from(ticketAssignees)
      .where(eq(ticketAssignees.userId, userId));
    const assignedTicketIds = myAssignments.map((a) => a.ticketId);

    if (assignedTicketIds.length > 0) {
      conditions.push(
        or(
          eq(tickets.assigneeId, userId),
          inArray(tickets.id, assignedTicketIds)
        )
      );
    } else {
      conditions.push(eq(tickets.assigneeId, userId));
    }
  }

  const roomTickets = await db.query.tickets.findMany({
    where: and(...conditions),
    orderBy: [desc(tickets.updatedAt)],
    limit: 50,
    with: {
      department: { columns: { id: true, name: true, color: true } },
      assignee: { columns: { id: true, name: true, avatarUrl: true } },
      requester: { columns: { id: true, name: true, avatarUrl: true } },
      messages: {
        where: (msg, { eq, isNull, and }) =>
          and(eq(msg.type, "internal_note"), isNull(msg.deletedAt)),
        orderBy: (msg, { desc }) => [desc(msg.createdAt)],
        limit: 1,
        with: {
          author: { columns: { id: true, name: true, role: true } },
        },
      },
    },
  });

  const formattedRooms = roomTickets.map((t) => {
    const lastInternalMessage = t.messages?.[0];
    return {
      ticketId: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
      department: t.department || { name: "General", color: "#6366f1" },
      assignee: t.assignee,
      requester: t.requester,
      reporterName: t.reporterName,
      lastMessage: lastInternalMessage
        ? {
            content: lastInternalMessage.content,
            authorName: lastInternalMessage.author?.name || "Staff",
            authorRole: lastInternalMessage.author?.role || "agent",
            createdAt: lastInternalMessage.createdAt,
          }
        : null,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
    };
  });

  return NextResponse.json(formattedRooms);
}
