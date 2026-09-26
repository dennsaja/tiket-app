import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, users, ticketMessages, attachments } from "@/lib/db/schema";
import { eq, asc, and, isNull } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createMessageSchema } from "@/lib/validations";

// Check if user has permission to access department chat for this ticket
async function canUserAccessDepartmentChat(
  userId: string,
  userRole: string,
  ticket: any
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (userRole !== "agent") return false;

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, departmentId: true },
  });

  const userDeptId = currentUser?.departmentId;

  // Allowed if agent belongs to same department, is assigned, or ticket/agent is general
  if (ticket.assigneeId === userId) return true;
  if (!ticket.departmentId || !userDeptId) return true;
  return ticket.departmentId === userDeptId;
}

// GET /api/chat/rooms/[ticketId] — Get all department chat messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { ticketId } = await params;
  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  if (userRole !== "admin" && userRole !== "agent") {
    return errorResponse("Forbidden: Only support staff can access department chats", 403);
  }

  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)),
    with: {
      department: { columns: { id: true, name: true, color: true } },
      assignee: { columns: { id: true, name: true } },
    },
  });

  if (!ticket) return errorResponse("Ticket not found", 404);

  const hasAccess = await canUserAccessDepartmentChat(userId, userRole, ticket);
  if (!hasAccess) {
    return errorResponse(
      "Forbidden: You do not have access to this department's chat room",
      403
    );
  }

  const messages = await db.query.ticketMessages.findMany({
    where: and(
      eq(ticketMessages.ticketId, ticketId),
      eq(ticketMessages.type, "internal_note"),
      isNull(ticketMessages.deletedAt)
    ),
    orderBy: [asc(ticketMessages.createdAt)],
    with: {
      author: {
        columns: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
      attachments: {
        where: eq(attachments.isDeleted, false),
      },
    },
  });

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      department: ticket.department,
      assignee: ticket.assignee,
    },
    messages,
  });
}

// POST /api/chat/rooms/[ticketId] — Post a new message to department chat
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { ticketId } = await params;
  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  if (userRole !== "admin" && userRole !== "agent") {
    return errorResponse("Forbidden: Only support staff can post in department chats", 403);
  }

  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)),
  });

  if (!ticket) return errorResponse("Ticket not found", 404);

  const hasAccess = await canUserAccessDepartmentChat(userId, userRole, ticket);
  if (!hasAccess) {
    return errorResponse(
      "Forbidden: You do not have access to post in this department's chat room",
      403
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = createMessageSchema.safeParse({
    content: body.content,
    type: "internal_note",
  });

  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const [message] = await db
    .insert(ticketMessages)
    .values({
      ticketId,
      authorId: userId,
      content: parsed.data.content.trim(),
      type: "internal_note",
    })
    .returning();

  // Update ticket timestamp
  await db
    .update(tickets)
    .set({ updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  const completeMessage = await db.query.ticketMessages.findFirst({
    where: eq(ticketMessages.id, message.id),
    with: {
      author: {
        columns: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
      attachments: true,
    },
  });

  return NextResponse.json(completeMessage, { status: 201 });
}
