import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tickets,
  ticketStatusHistory,
  ticketAssignmentHistory,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { updateTicketSchema, changeStatusSchema, assignTicketSchema } from "@/lib/validations";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { notifyTicketAssigned, notifyStatusChange } from "@/lib/notifications";
import { applySlaPolicyToTicket } from "@/lib/sla";
import { canAccessTicket, canModifyTicket } from "@/lib/auth/helpers";

// GET /api/tickets/[id] — get ticket detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  try {
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
      with: {
        requester: {
          columns: {
            id: true, name: true, email: true, avatarUrl: true, role: true,
            phone: true, createdAt: true,
          },
        },
        assignee: {
          columns: { id: true, name: true, email: true, avatarUrl: true },
        },
        department: true,
        category: true,
        subcategory: true,
        slaPolicy: true,
        tags: { with: { tag: true } },
        messages: {
          where: (msg, { eq, or, and }) =>
            userRole === "user"
              ? eq(msg.type, "public")
              : undefined,
          with: {
            author: {
              columns: { id: true, name: true, email: true, avatarUrl: true, role: true },
            },
            attachments: {
              where: (att, { eq }) => eq(att.isDeleted, false),
            },
          },
          orderBy: (msg, { asc }) => [asc(msg.createdAt)],
        },
        attachments: {
          where: (att, { eq }) => eq(att.isDeleted, false),
        },
        statusHistory: {
          with: {
            changedBy: {
              columns: { id: true, name: true, email: true },
            },
          },
          orderBy: (h, { desc }) => [desc(h.createdAt)],
        },
        assignmentHistory: {
          with: {
            fromAgent: { columns: { id: true, name: true, email: true } },
            toAgent: { columns: { id: true, name: true, email: true } },
            assignedBy: { columns: { id: true, name: true, email: true } },
          },
          orderBy: (h, { desc }) => [desc(h.createdAt)],
        },
      },
    });

    if (!ticket) return errorResponse("Ticket not found", 404);
    if (ticket.deletedAt) return errorResponse("Ticket not found", 404);

    // Authorization check
    if (
      !canAccessTicket(userRole, userId, ticket.requesterId, ticket.assigneeId)
    ) {
      return errorResponse("Forbidden", 403);
    }

    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error(`[GET /api/tickets/${id}] Error:`, error);
    return errorResponse(error.message || "Failed to load ticket details", 500);
  }
}

// PATCH /api/tickets/[id] — update ticket
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, id),
  });

  if (!ticket || ticket.deletedAt) return errorResponse("Ticket not found", 404);

  // Authorization
  if (!canModifyTicket(userRole, userId, ticket.requesterId, ticket.assigneeId)) {
    return errorResponse("Forbidden", 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const data = parsed.data;
  const updates: Record<string, any> = { updatedAt: new Date() };

  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.departmentId !== undefined) updates.departmentId = data.departmentId;
  if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
  if (data.subcategoryId !== undefined) updates.subcategoryId = data.subcategoryId;
  if (data.reporterName !== undefined) updates.reporterName = data.reporterName?.trim() || null;
  if (data.reporterAddress !== undefined) updates.reporterAddress = data.reporterAddress?.trim() || null;
  if (data.reporterMapUrl !== undefined) updates.reporterMapUrl = data.reporterMapUrl?.trim() || null;

  // Handle assignment
  if (data.assigneeId !== undefined) {
    const prevAssigneeId = ticket.assigneeId;
    updates.assigneeId = data.assigneeId;

    if (data.assigneeId !== prevAssigneeId) {
      // Auto-set status to assigned
      if (data.assigneeId && ticket.status === "open") {
        updates.status = "assigned";
      }

      await db.insert(ticketAssignmentHistory).values({
        ticketId: id,
        fromAgentId: prevAssigneeId,
        toAgentId: data.assigneeId,
        assignedById: userId,
        reason: data.reason,
      });

      // Notify new assignee
      if (data.assigneeId) {
        await notifyTicketAssigned(
          id,
          ticket.ticketNumber,
          ticket.title,
          data.assigneeId
        );
      }

      await createAuditLog({
        actorId: userId,
        actorEmail: session.user.email,
        action: prevAssigneeId ? "ticket_reassigned" : "ticket_assigned",
        targetType: "ticket",
        targetId: id,
        metadata: { fromAgentId: prevAssigneeId, toAgentId: data.assigneeId },
        ipAddress: getClientIp(req),
      });
    }
  }

  // Handle status change
  if (data.status !== undefined && data.status !== ticket.status) {
    updates.status = data.status;

    if (data.status === "resolved") {
      updates.resolvedAt = new Date();
      updates.slaResolvedAt = new Date();
      if (data.resolution) updates.resolution = data.resolution;
    }
    if (data.status === "closed") {
      updates.closedAt = new Date();
    }

    await db.insert(ticketStatusHistory).values({
      ticketId: id,
      fromStatus: ticket.status,
      toStatus: data.status,
      changedById: userId,
      reason: data.reason,
    });

    // Notify requester of status change
    await notifyStatusChange(
      id,
      ticket.ticketNumber,
      ticket.title,
      data.status,
      ticket.requesterId,
      session.user.name || "Agent"
    );

    await createAuditLog({
      actorId: userId,
      actorEmail: session.user.email,
      action: "ticket_status_changed",
      targetType: "ticket",
      targetId: id,
      metadata: { from: ticket.status, to: data.status, reason: data.reason },
      ipAddress: getClientIp(req),
    });
  }

  // Handle priority change
  if (data.priority !== undefined && data.priority !== ticket.priority) {
    // Re-apply SLA for new priority
    await applySlaPolicyToTicket(id, data.priority, updates.departmentId ?? ticket.departmentId, ticket.createdAt);

    await createAuditLog({
      actorId: userId,
      actorEmail: session.user.email,
      action: "ticket_priority_changed",
      targetType: "ticket",
      targetId: id,
      metadata: { from: ticket.priority, to: data.priority },
      ipAddress: getClientIp(req),
    });
  }

  const [updated] = await db
    .update(tickets)
    .set(updates)
    .where(eq(tickets.id, id))
    .returning();

  await createAuditLog({
    actorId: userId,
    actorEmail: session.user.email,
    action: "ticket_updated",
    targetType: "ticket",
    targetId: id,
    metadata: { changes: Object.keys(data) },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(updated);
}

// DELETE /api/tickets/[id] — soft delete (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc" && userRole !== "owner" && userRole !== "admin") {
    return errorResponse("Forbidden", 403);
  }

  const { id } = await params;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, id),
  });

  if (!ticket || ticket.deletedAt) return errorResponse("Ticket not found", 404);

  await db
    .update(tickets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tickets.id, id));

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "ticket_updated",
    targetType: "ticket",
    targetId: id,
    metadata: { action: "soft_delete" },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
