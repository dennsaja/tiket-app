import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, ticketStatusHistory, ticketTags, auditLogs } from "@/lib/db/schema";
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

  // Build WHERE conditions
  const conditions: any[] = [isNull(tickets.deletedAt)];

  // Role-based filtering: users only see their own tickets
  if (userRole === "user") {
    conditions.push(eq(tickets.requesterId, userId));
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
      conditions.push(eq(tickets.assigneeId, assigneeId));
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
      department: { columns: { id: true, name: true } },
      category: { columns: { id: true, name: true } },
      tags: { with: { tag: true } },
    },
  });

  return paginatedResponse(results, Number(total), page, perPage);
}

// POST /api/tickets — create a new ticket
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  // Rate limit: 10 tickets per minute
  const limitResult = rateLimit(`ticket_create:${session.user.id}`, {
    windowMs: 60000,
    max: 10,
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
  const userId = session.user.id!;

  // Create the ticket
  const [ticket] = await db
    .insert(tickets)
    .values({
      title: data.title,
      description: data.description,
      priority: data.priority,
      requesterId: userId,
      departmentId: data.departmentId || null,
      categoryId: data.categoryId || null,
      subcategoryId: data.subcategoryId || null,
      reporterName: data.reporterName?.trim() || null,
      reporterAddress: data.reporterAddress?.trim() || null,
      reporterMapUrl: data.reporterMapUrl?.trim() || null,
    })
    .returning();

  // Add tags if provided
  if (data.tagIds && data.tagIds.length > 0) {
    await db.insert(ticketTags).values(
      data.tagIds.map((tagId) => ({ ticketId: ticket.id, tagId }))
    );
  }

  // Record initial status
  await db.insert(ticketStatusHistory).values({
    ticketId: ticket.id,
    fromStatus: null,
    toStatus: "open",
    changedById: userId,
    reason: "Ticket created",
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
      title: ticket.title,
      priority: ticket.priority,
    },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent") || undefined,
  });

  return NextResponse.json(ticket, { status: 201 });
}
