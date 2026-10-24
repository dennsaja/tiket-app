import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, ticketAssignees } from "@/lib/db/schema";
import { eq, and, or, inArray, isNull, count, lt, sql, desc, gte } from "drizzle-orm";
import { DashboardOverview, type RecentDashboardTicket } from "@/components/dashboard/dashboard-overview";
import { dashboardDateRange, getDashboardPeriod, summarizeStatuses } from "@/lib/utils/dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ringkasan" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string | string[] }> }) {
  const session = await auth();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role || "user";
  const userId = user?.id || "";
  const days = getDashboardPeriod((await searchParams).days);
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
  return <DashboardOverview activeCount={activeCount} name={user?.name || "User"} role={role} days={days} dateLabel={dateLabel} stats={stats} overdue={overdue} assigned={assigned} recentTickets={recentTickets} activity={activity} dataUnavailable={dataUnavailable} />;
}
