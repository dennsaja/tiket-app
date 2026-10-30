import { db } from "@/lib/db";
import { tickets, ticketAssignees, departments, categories, users, kbArticles } from "@/lib/db/schema";
import { eq, and, or, inArray, isNull, count, lt, sql, desc, gte, asc, ilike, notInArray } from "drizzle-orm";
import { dashboardDateRange, getDashboardPeriod, summarizeStatuses } from "@/lib/utils/dashboard";
import type { RecentDashboardTicket } from "@/components/dashboard/dashboard-overview";
export interface WebActor { id: string; role?: string; name?: string | null }
export async function dashboardData(user: WebActor, params: { days?: string | string[] }) {
  const role = (user as { role?: string } | undefined)?.role || "user";
  const userId = user?.id || "";
  const days = getDashboardPeriod(params.days);
  const now = new Date();
  const range = dashboardDateRange(days, now);
  const roleFilter = role === "user" ? eq(tickets.requesterId, userId) : undefined;
  const baseWhere = and(isNull(tickets.deletedAt), roleFilter, gte(tickets.createdAt, range.start), lt(tickets.createdAt, range.end));
  const myAssignment = or(
    eq(tickets.assigneeId, userId),
    inArray(tickets.id, db.select({ ticketId: ticketAssignees.ticketId }).from(ticketAssignees).where(eq(ticketAssignees.userId, userId)))
  );
  // created_at is a UTC timestamp without timezone; group by its Jakarta calendar day.
  const dayExpression = sql<string>`to_char(${tickets.createdAt} + interval '7 hours', 'YYYY-MM-DD')`;
  let stats = summarizeStatuses([]);
  let activeCount = 0;
  let overdue = 0;
  let assigned = 0;
  let recentTickets: RecentDashboardTicket[] = [];
  let dailyCounts: { date: string; count: number }[] = [];
  let dataUnavailable = false;

  try {
    const [statusRows, overdueRows, assignedRows, recentRows, dailyRows, activeRows] = await Promise.all([
      db.select({ status: tickets.status, count: count() }).from(tickets).where(baseWhere).groupBy(tickets.status),
      db.select({ count: count() }).from(tickets).where(and(baseWhere, lt(tickets.slaResolutionDue, now), sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`)),
      ["noc", "owner", "admin", "agent"].includes(role)
        ? db.select({ count: count() }).from(tickets).where(and(isNull(tickets.deletedAt), myAssignment, sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`))
        : Promise.resolve([{ count: 0 }]),
      db.query.tickets.findMany({
        where: baseWhere,
        with: {
          requester: { columns: { name: true, avatarUrl: true } },
          assignee: { columns: { name: true, avatarUrl: true } },
          department: { columns: { name: true } },
        },
        orderBy: [desc(tickets.createdAt)],
        limit: 5,
      }),
      db.select({ date: dayExpression, count: count() }).from(tickets).where(baseWhere).groupBy(dayExpression).orderBy(dayExpression),
      db.select({ count: count() }).from(tickets).where(and(isNull(tickets.deletedAt), roleFilter, role === "agent" ? myAssignment : undefined, sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`)),
    ]);
    activeCount = Number(activeRows[0]?.count || 0);
    stats = summarizeStatuses(statusRows);
    overdue = Number(overdueRows[0]?.count || 0);
    assigned = Number(assignedRows[0]?.count || 0);
    recentTickets = recentRows;
    dailyCounts = dailyRows;
  } catch (error) {
    console.error("[Dashboard] Unable to load ticket overview:", error instanceof Error ? error.message : "Unknown error");
    dataUnavailable = true;
  }

  const activity = range.dates.map((date) => ({
    date,
    label: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(date + "T00:00:00+07:00")),
    count: Number(dailyCounts.find((row) => row.date === date)?.count || 0),
  }));
  const dateFormatter = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
  const dateLabel = dateFormatter.format(range.start) + " – " + dateFormatter.format(now);

  return { activeCount, name: user.name || "User", role, days, dateLabel, stats, overdue, assigned, recentTickets, activity, dataUnavailable };
}
export async function ticketPageData(user: WebActor, params: Record<string, string>) {
  const userRole = (user as any)?.role || "user";
  const userId = user?.id || "";

  const page = Math.max(1, parseInt(params.page || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(params.perPage || "20", 10)));
  const offset = (page - 1) * perPage;

  // Build filters
  const conditions: any[] = [isNull(tickets.deletedAt)];

  // Role filtering
  if (userRole === "user") {
    conditions.push(eq(tickets.requesterId, userId));
  } else if (params.mine === "true") {
    const { ticketAssignees } = await import("@/lib/db/schema");
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

  // Dashboard links keep the selected period and full operational status group.
  if (params.days) {
    const range = dashboardDateRange(getDashboardPeriod(params.days));
    conditions.push(gte(tickets.createdAt, range.start), lt(tickets.createdAt, range.end));
  }
  if (params.view === "active") {
    conditions.push(notInArray(tickets.status, ["resolved", "closed", "cancelled"]));
  } else if (params.view === "in-progress") {
    conditions.push(inArray(tickets.status, ["assigned", "accepted", "on_site", "in_progress"]));
  } else if (params.view === "open") {
    conditions.push(inArray(tickets.status, ["open", "reopened"]));
  } else if (params.view === "resolved") {
    conditions.push(inArray(tickets.status, ["resolved", "closed"]));
  } else if (params.view === "pending") {
    conditions.push(inArray(tickets.status, ["pending", "waiting_for_user", "waiting_for_third_party"]));
  } else if (params.view === "overdue") {
    conditions.push(lt(tickets.slaResolutionDue, new Date()), notInArray(tickets.status, ["resolved", "closed", "cancelled"]));
  }

  // Search filter
  if (params.search) {
    conditions.push(
      or(
        ilike(tickets.title, `%${params.search}%`),
        ilike(tickets.description, `%${params.search}%`),
        ilike(tickets.reporterName, `%${params.search}%`),
        sql`${tickets.ticketNumber}::text ILIKE ${`%${params.search}%`}`
      )
    );
  }

  // Status filter
  if (params.status && params.status !== "all") {
    conditions.push(eq(tickets.status, params.status as any));
  }

  // Priority filter
  if (params.priority && params.priority !== "all") {
    conditions.push(eq(tickets.priority, params.priority as any));
  }

  // Assignee filter
  if (params.assigneeId && params.assigneeId !== "all") {
    if (params.assigneeId === "unassigned") {
      conditions.push(isNull(tickets.assigneeId));
    } else {
      conditions.push(eq(tickets.assigneeId, params.assigneeId));
    }
  }

  // Department filter
  if (params.departmentId && params.departmentId !== "all") {
    conditions.push(eq(tickets.departmentId, params.departmentId));
  }

  // Category filter
  if (params.categoryId && params.categoryId !== "all") {
    conditions.push(eq(tickets.categoryId, params.categoryId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Sorting
  const sortColumn: Record<string, any> = {
    createdAt: tickets.createdAt,
    updatedAt: tickets.updatedAt,
    priority: tickets.priority,
    status: tickets.status,
    ticketNumber: tickets.ticketNumber,
  };
  const sortField = params.sortBy || "createdAt";
  const sortDir = params.sortOrder === "asc" ? "asc" : "desc";
  const orderBy = sortDir === "asc" ? asc(sortColumn[sortField] || tickets.createdAt) : desc(sortColumn[sortField] || tickets.createdAt);

  let ticketList: any[] = [];
  let totalCount = 0;
  let deptList: any[] = [];
  let catList: any[] = [];
  let agentList: any[] = [];

  try {
    const [ticketsRes, totalRes, depts, cats, agents] = await Promise.all([
      db.query.tickets.findMany({
        where,
        with: {
          requester: { columns: { id: true, name: true, email: true, avatarUrl: true } },
          assignee: { columns: { id: true, name: true, avatarUrl: true } },
          assignees: {
            with: {
              user: { columns: { id: true, name: true, avatarUrl: true, role: true } },
            },
          },
          department: { columns: { id: true, name: true } },
          category: { columns: { id: true, name: true } },
        },
        orderBy: [orderBy],
        limit: perPage,
        offset,
      }),
      db.select({ total: count() }).from(tickets).where(where),
      db.query.departments.findMany({ where: eq(departments.isActive, true) }),
      db.query.categories.findMany({ where: eq(categories.isActive, true) }),
      userRole !== "user"
        ? db.query.users.findMany({
            where: and(eq(users.isActive, true), inArray(users.role, ["admin", "agent"])),
            columns: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    ticketList = ticketsRes || [];
    totalCount = Number(totalRes[0]?.total || 0);
    deptList = depts || [];
    catList = cats || [];
    agentList = agents || [];
  } catch {
    // Fallback for prerendering without active DB
  }

  const totalPages = Math.ceil(totalCount / perPage);
  const canCreate = ["noc", "owner", "admin"].includes(userRole);


  return { ticketList, totalCount, deptList, catList, agentList, totalPages, page, perPage, canCreate, userRole };
}
export async function knowledgeData() {
  let articles: any[] = [];
  let categoriesList: any[] = [];

  try {
    [articles, categoriesList] = await Promise.all([
      db.query.kbArticles.findMany({
        where: eq(kbArticles.status, "published"),
        with: {
          category: { columns: { id: true, name: true } },
          author: { columns: { id: true, name: true } },
        },
        orderBy: [desc(kbArticles.views)],
        limit: 20,
      }),
      db.query.categories.findMany({
        where: eq(categories.isActive, true),
      }),
    ]);
  } catch {
    // Graceful fallback during build or when database is empty
  }


  return { articles, categoriesList };
}
