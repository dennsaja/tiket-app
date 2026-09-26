import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, users, departments, categories } from "@/lib/db/schema";
import { eq, desc, count, sql, and, isNull, gte, lte, lt } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { subDays, startOfDay, endOfDay } from "date-fns";

// GET /api/dashboard/stats — dashboard statistics
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  const now = new Date();
  const today = startOfDay(now);
  const last7Days = subDays(now, 7);
  const last30Days = subDays(now, 30);

  // Role-based base filter
  const userFilter = userRole === "user" ? eq(tickets.requesterId, userId) : undefined;
  const baseWhere = and(isNull(tickets.deletedAt), userFilter);

  // Status counts
  const statusCounts = await db
    .select({
      status: tickets.status,
      count: count(),
    })
    .from(tickets)
    .where(baseWhere)
    .groupBy(tickets.status);

  const statusMap: Record<string, number> = {};
  statusCounts.forEach(({ status, count: c }) => {
    statusMap[status] = Number(c);
  });

  // Total
  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

  // Overdue tickets (SLA resolution past due, not resolved/closed)
  const [{ overdueCount }] = await db
    .select({ overdueCount: count() })
    .from(tickets)
    .where(
      and(
        isNull(tickets.deletedAt),
        userFilter,
        lt(tickets.slaResolutionDue, now),
        sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`
      )
    );

  // Recent tickets (last 7 days)
  const recentTickets = await db.query.tickets.findMany({
    where: and(
      baseWhere,
      gte(tickets.createdAt, last7Days)
    ),
    columns: {
      id: true, ticketNumber: true, title: true, status: true,
      priority: true, createdAt: true,
    },
    with: {
      requester: { columns: { id: true, name: true, avatarUrl: true } },
      assignee: { columns: { id: true, name: true } },
    },
    orderBy: [desc(tickets.createdAt)],
    limit: 10,
  });

  // Daily ticket trend (last 7 days)
  const dailyTrend = await db
    .select({
      date: sql<string>`DATE(${tickets.createdAt})`,
      count: count(),
    })
    .from(tickets)
    .where(and(baseWhere, gte(tickets.createdAt, last7Days)))
    .groupBy(sql`DATE(${tickets.createdAt})`)
    .orderBy(sql`DATE(${tickets.createdAt})`);

  // Agent-specific stats
  let agentStats = null;
  if (["noc", "owner", "admin", "agent"].includes(userRole)) {
    const assignedToMe = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(
        isNull(tickets.deletedAt),
        eq(tickets.assigneeId, userId),
        sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`
      ));
    agentStats = { assignedToMe: Number(assignedToMe[0].count) };
  }

  // Department stats (admin / noc / owner)
  let departmentStats = null;
  if (["noc", "owner", "admin"].includes(userRole)) {
    departmentStats = await db
      .select({
        departmentId: tickets.departmentId,
        count: count(),
      })
      .from(tickets)
      .where(and(baseWhere, gte(tickets.createdAt, last30Days)))
      .groupBy(tickets.departmentId)
      .limit(10);
  }

  // Priority breakdown
  const priorityBreakdown = await db
    .select({
      priority: tickets.priority,
      count: count(),
    })
    .from(tickets)
    .where(and(baseWhere, sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`))
    .groupBy(tickets.priority);

  return NextResponse.json({
    stats: {
      total,
      open: statusMap["open"] || 0,
      assigned: statusMap["assigned"] || 0,
      inProgress: statusMap["in_progress"] || 0,
      pending: statusMap["pending"] || 0,
      waitingForUser: statusMap["waiting_for_user"] || 0,
      resolved: statusMap["resolved"] || 0,
      closed: statusMap["closed"] || 0,
      reopened: statusMap["reopened"] || 0,
      overdue: Number(overdueCount),
    },
    recentTickets,
    dailyTrend,
    priorityBreakdown,
    agentStats,
    departmentStats,
  });
}
