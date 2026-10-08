import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { tickets, ticketMessages, attachments } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { createMessageSchema } from "@/lib/validations";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { notifyNewMessage } from "@/lib/notifications";
import { canAccessTicket, canReplyToTicket, canWriteInternalNotes } from "@/lib/auth/helpers";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// GET /api/tickets/[id]/messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = currentUser.role;
  const userId = currentUser.id;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, id),
  });

  if (!ticket || ticket.deletedAt) return errorResponse("Ticket not found", 404);

  if (!canAccessTicket(userRole, userId, ticket.requesterId, ticket.assigneeId)) {
    return errorResponse("Forbidden", 403);
  }

  const messages = await db.query.ticketMessages.findMany({
    where: (msg, { eq, and, isNull }) =>
      and(
        eq(msg.ticketId, id),
        isNull(msg.deletedAt),
        // Users only see public messages
        userRole === "user" ? eq(msg.type, "public") : undefined
      ),
    with: {
      author: {
        columns: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
      attachments: {
        where: (att, { eq }) => eq(att.isDeleted, false),
      },
    },
    orderBy: (msg, { asc }) => [asc(msg.createdAt)],
  });

  return NextResponse.json(messages);
}

// POST /api/tickets/[id]/messages — add a reply or internal note
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  // Rate limit: 30 messages per minute
  const limitResult = rateLimit(`message_create:${currentUser.id}`, {
    windowMs: 60000,
    max: 30,
  });
  if (!limitResult.success) return rateLimitResponse(limitResult.reset);

  const { id } = await params;
  const userRole = currentUser.role;
  const userId = currentUser.id;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, id),
  });

  if (!ticket || ticket.deletedAt) return errorResponse("Ticket not found", 404);
  if (ticket.status === "closed" || ticket.status === "cancelled") {
    return errorResponse("Cannot reply to a closed or cancelled ticket", 400);
  }

  if (!canReplyToTicket(userRole, userId, ticket.requesterId, ticket.assigneeId)) {
    return errorResponse("Forbidden: Only the requester or support staff can reply to this ticket", 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = createMessageSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const { content, type } = parsed.data;

  // Only agents/admins can write internal notes
  if (type === "internal_note" && !canWriteInternalNotes(userRole)) {
    return errorResponse("Forbidden: Cannot write internal notes", 403);
  }

  // Check if this is the first response
  const existingMessages = await db.query.ticketMessages.findMany({
    where: (msg, { eq, and }) =>
      and(eq(msg.ticketId, id), eq(msg.type, "public")),
  });
  const isFirstResponse =
    existingMessages.length === 0 && type === "public" && userRole !== "user";

  const [message] = await db
    .insert(ticketMessages)
    .values({
      ticketId: id,
      authorId: userId,
      content,
      type,
      isFirstResponse,
    })
    .returning();

  // Record SLA first response time
  if (isFirstResponse && !ticket.slaFirstResponseAt) {
    await db
      .update(tickets)
      .set({ slaFirstResponseAt: new Date(), updatedAt: new Date() })
      .where(eq(tickets.id, id));
  }

  // Auto-set to in_progress when agent replies
  if (type === "public" && userRole !== "user" && ticket.status === "assigned") {
    await db
      .update(tickets)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(tickets.id, id));
  }

  // Update ticket timestamp
  await db
    .update(tickets)
    .set({ updatedAt: new Date() })
    .where(eq(tickets.id, id));

  // Determine notification recipients
  const recipientIds = new Set<string>();

  if (type === "public") {
    // Notify requester if agent replied
    if (userId !== ticket.requesterId) {
      recipientIds.add(ticket.requesterId);
    }
    // Notify assignee if user replied
    if (ticket.assigneeId && userId !== ticket.assigneeId) {
      recipientIds.add(ticket.assigneeId);
    }
  } else {
    // Internal notes: notify assignee if not the author
    if (ticket.assigneeId && userId !== ticket.assigneeId) {
      recipientIds.add(ticket.assigneeId);
    }
  }

  if (recipientIds.size > 0) {
    await notifyNewMessage(
      id,
      ticket.ticketNumber,
      ticket.title,
      currentUser.name || "User",
      Array.from(recipientIds),
      type === "internal_note"
    );
  }

  await createAuditLog({
    actorId: userId,
    actorEmail: currentUser.email,
    action: type === "internal_note" ? "internal_note_created" : "message_created",
    targetType: "ticket",
    targetId: id,
    metadata: { messageId: message.id, type },
    ipAddress: getClientIp(req),
  });

  // Return message with author info
  const messageWithAuthor = await db.query.ticketMessages.findFirst({
    where: eq(ticketMessages.id, message.id),
    with: {
      author: {
        columns: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
    },
  });

  return NextResponse.json(messageWithAuthor, { status: 201 });
}
