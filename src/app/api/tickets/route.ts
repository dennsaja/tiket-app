import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tickets,
  ticketAssignees,
  ticketWorkReports,
  ticketStatusHistory,
  ticketAssignmentHistory,
  ticketTags,
  auditLogs,
} from "@/lib/db/schema";
import { eq, desc, asc, and, or, ilike, inArray, count, sql, isNull } from "drizzle-orm";
import { createTicketSchema, ticketFiltersSchema } from "@/lib/validations";
import { errorResponse, successResponse, paginatedResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { applySlaPolicyToTicket } from "@/lib/sla";
import { notifyTicketAssigned } from "@/lib/notifications";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// GET /api/tickets — list tickets with filtering
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const searchParams = req.nextUrl.searchParams;
  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  // Parse filters
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25")));
  const offset = (page - 1) * perPage;
  const search = searchParams.get("search") || undefined;
  const sortBy = (searchParams.get("sortBy") || "createdAt") as string;
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  const isMine = searchParams.get("mine") === "true";

  // Build WHERE conditions
  const conditions: any[] = [isNull(tickets.deletedAt)];

  // Role-based filtering: regular users only see their own tickets
  if (userRole === "user") {
    conditions.push(eq(tickets.requesterId, userId));
  } else if (isMine && userRole === "agent") {
    // For technician "Tiket Saya": find where they are primary assignee OR in ticket_assignees
    const myAssignments = await db
      .select({ ticketId: ticketAssignees.ticketId })
      .from(ticketAssignees)
      .where(eq(ticketAssignees.userId, userId));
    const assignedIds = myAssignments.map((a) => a.ticketId);

    if (assignedIds.length > 0) {
      conditions.push(
        or(
          eq(tickets.assigneeId, userId),
          inArray(tickets.id, assignedIds)
        )
      );
    } else {
      conditions.push(eq(tickets.assigneeId, userId));
    }
  }

  // Ticket type filter
  const typeFilter = searchParams.getAll("ticketType");
  if (typeFilter.length > 0) {
    conditions.push(inArray(tickets.ticketType, typeFilter as any[]));
  }

  // Status filter
  const statusFilter = searchParams.getAll("status");
  if (statusFilter.length > 0) {
    conditions.push(inArray(tickets.status, statusFilter as any[]));
  }

  // Priority filter
  const priorityFilter = searchParams.getAll("priority");
  if (priorityFilter.length > 0) {
    conditions.push(inArray(tickets.priority, priorityFilter as any[]));
  }

  // Assignee filter
  const assigneeId = searchParams.get("assigneeId");
  if (assigneeId) {
    if (assigneeId === "unassigned") {
      conditions.push(isNull(tickets.assigneeId));
    } else {
      // Check primary or assigned team
      const teamAssigned = await db
        .select({ ticketId: ticketAssignees.ticketId })
        .from(ticketAssignees)
        .where(eq(ticketAssignees.userId, assigneeId));
      const teamIds = teamAssigned.map((a) => a.ticketId);

      if (teamIds.length > 0) {
        conditions.push(
          or(
            eq(tickets.assigneeId, assigneeId),
            inArray(tickets.id, teamIds)
          )
        );
      } else {
        conditions.push(eq(tickets.assigneeId, assigneeId));
      }
    }
  }

  // Department filter
  const departmentId = searchParams.get("departmentId");
  if (departmentId) {
    conditions.push(eq(tickets.departmentId, departmentId));
  }

  // Category filter
  const categoryId = searchParams.get("categoryId");
  if (categoryId) {
    conditions.push(eq(tickets.categoryId, categoryId));
  }

  // Search
  if (search) {
    conditions.push(
      or(
        ilike(tickets.title, `%${search}%`),
        ilike(tickets.description, `%${search}%`),
        ilike(tickets.reporterName, `%${search}%`),
        ilike(tickets.reporterPhone, `%${search}%`),
        sql`${tickets.ticketNumber}::text ILIKE ${`%${search}%`}`
      )
    );
  }

  // Build sort
  const sortColumn: Record<string, any> = {
    createdAt: tickets.createdAt,
    updatedAt: tickets.updatedAt,
    priority: tickets.priority,
    status: tickets.status,
    ticketNumber: tickets.ticketNumber,
    ticketType: tickets.ticketType,
  };
  const orderBy = sortOrder === "asc"
    ? asc(sortColumn[sortBy] || tickets.createdAt)
    : desc(sortColumn[sortBy] || tickets.createdAt);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(tickets)
    .where(where);

  // Get tickets with relations
  const results = await db.query.tickets.findMany({
    where,
    limit: perPage,
    offset,
    orderBy: [orderBy],
    with: {
      requester: {
        columns: { id: true, name: true, email: true, avatarUrl: true },
      },
      assignee: {
        columns: { id: true, name: true, email: true, avatarUrl: true },
      },
      assignees: {
        with: {
          user: {
            columns: { id: true, name: true, email: true, avatarUrl: true, role: true },
          },
        },
      },
      workReports: {
        with: {
          technician: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
      },
      department: { columns: { id: true, name: true, color: true } },
      category: { columns: { id: true, name: true } },
      tags: { with: { tag: true } },
    },
  });

  return paginatedResponse(results, Number(total), page, perPage);
}

// POST /api/tickets — create a new ticket (Strictly NOC, Owner, Admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  // 1. Permission check: Strictly NOC, Owner, and Admin
  if (!["noc", "owner", "admin"].includes(userRole)) {
    return errorResponse(
      "Forbidden: Pembuatan tiket hanya dapat dilakukan oleh NOC, Owner, atau Admin (1 arah). Teknisi bertugas menerima dan mengerjakan tiket.",
      403
    );
  }

  // Rate limit: 20 tickets per minute for staff
  const limitResult = rateLimit(`ticket_create:${userId}`, {
    windowMs: 60000,
    max: 20,
  });
  if (!limitResult.success) {
    return rateLimitResponse(limitResult.reset);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    return errorResponse(`Validation error: ${errorMessage}`, 422);
  }

  const data = parsed.data;

  // Determine primary assignee and assigned team
  const rawAssignees = Array.isArray(data.assigneeIds) ? data.assigneeIds.filter(Boolean) : [];
  const primaryAssigneeId = data.leadAssigneeId || (rawAssignees.length > 0 ? rawAssignees[0] : null);
  const initialStatus = primaryAssigneeId || rawAssignees.length > 0 ? "assigned" : "open";

  // Create the ticket
  const [ticket] = await db
    .insert(tickets)
    .values({
      ticketType: data.ticketType || "psb",
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: initialStatus,
      requesterId: userId,
      assigneeId: primaryAssigneeId,
      departmentId: data.departmentId || null,
      categoryId: data.categoryId || null,
      subcategoryId: data.subcategoryId || null,
      specData: data.specData || null,
      reporterName: data.reporterName?.trim() || null,
      reporterPhone: data.reporterPhone?.trim() || null,
      reporterAddress: data.reporterAddress?.trim() || null,
      reporterMapUrl: data.reporterMapUrl?.trim() || null,
    })
    .returning();

  // Multi-technician assignment
  if (rawAssignees.length > 0) {
    const assigneeRows = rawAssignees.map((techId) => ({
      ticketId: ticket.id,
      userId: techId,
      isLead: techId === primaryAssigneeId,
    }));

    await db.insert(ticketAssignees).values(assigneeRows).catch((e) => {
      console.warn("[TicketAssignees] Insert error:", e);
    });

    // Record assignment history
    await db.insert(ticketAssignmentHistory).values({
      ticketId: ticket.id,
      fromAgentId: null,
      toAgentId: primaryAssigneeId,
      assignedById: userId,
      reason: "Initial assignment at ticket creation",
    });

    // Notify all assigned technicians
    for (const techId of rawAssignees) {
      notifyTicketAssigned(
        ticket.id,
        ticket.ticketNumber,
        ticket.title,
        techId
      ).catch(() => {});
    }
  }

  // Add tags if provided
  if (data.tagIds && data.tagIds.length > 0) {
    await db.insert(ticketTags).values(
      data.tagIds.map((tagId) => ({ ticketId: ticket.id, tagId }))
    );
  }

  // Record initial status in history
  await db.insert(ticketStatusHistory).values({
    ticketId: ticket.id,
    fromStatus: null,
    toStatus: initialStatus,
    changedById: userId,
    reason: initialStatus === "assigned" ? "Ticket created with assigned technicians" : "Ticket created",
  });

  // Apply SLA policy
  await applySlaPolicyToTicket(
    ticket.id,
    ticket.priority,
    ticket.departmentId,
    ticket.createdAt
  );

  // Audit log
  await createAuditLog({
    actorId: userId,
    actorEmail: session.user.email,
    action: "ticket_created",
    targetType: "ticket",
    targetId: ticket.id,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      ticketType: ticket.ticketType,
      title: ticket.title,
      priority: ticket.priority,
      assigneeCount: rawAssignees.length,
    },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent") || undefined,
  });

  // Fetch created ticket with complete relations
  const completeTicket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticket.id),
    with: {
      requester: { columns: { id: true, name: true, email: true, avatarUrl: true } },
      assignee: { columns: { id: true, name: true, email: true, avatarUrl: true } },
      assignees: {
        with: {
          user: { columns: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        },
      },
      department: true,
      category: true,
    },
  });

  return NextResponse.json(completeTicket || ticket, { status: 201 });
}

