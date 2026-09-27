import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, departments, categories, users } from "@/lib/db/schema";
import { eq, and, isNull, inArray, ilike, or, count, sql, asc, desc } from "drizzle-orm";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { TicketRow } from "@/components/tickets/ticket-row";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Plus, Ticket as TicketIcon } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tickets",
};

interface TicketsPageProps {
  searchParams: Promise<{
    page?: string;
    perPage?: string;
    search?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    departmentId?: string;
    categoryId?: string;
    sortBy?: string;
    sortOrder?: string;
    mine?: string;
  }>;
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const session = await auth();
  const user = session?.user;
  const userRole = (user as any)?.role || "user";
  const userId = user?.id || "";

  const params = await searchParams;
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

  return (
    <div className="space-y-4">
      {/* Header (Vercel Style) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {params.mine === "true" ? "Tiket Ditugaskan ke Saya" : "Semua Tiket"}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Menampilkan {ticketList.length} dari {totalCount} total tiket
          </p>
        </div>
        {canCreate && (
          <Link href="/tickets/new">
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Buat Tiket Baru
            </Button>
          </Link>
        )}
      </div>

      {/* Filter Component */}
      <TicketFilters
        departments={deptList}
        categories={catList}
        agents={agentList}
      />

      {/* Table Card (Vercel Style) */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-black">
        {ticketList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-400 mb-3">
              <TicketIcon className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Tidak ada tiket ditemukan</h3>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 max-w-sm">
              Tidak ada tiket yang sesuai dengan kriteria filter atau kata kunci pencarian Anda.
            </p>
            <div className="mt-4">
              <Link href="/tickets/new">
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                  Buat Tiket Baru
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/50 border-b border-zinc-200 dark:bg-zinc-950/50 dark:border-zinc-800">
                <TableRow>
                  <TableHead className="w-20 text-[11px] font-medium text-zinc-500">ID</TableHead>
                  <TableHead className="min-w-[240px] text-[11px] font-medium text-zinc-500">Subjek / Judul</TableHead>
                  <TableHead className="w-28 text-[11px] font-medium text-zinc-500">Status</TableHead>
                  <TableHead className="w-24 text-[11px] font-medium text-zinc-500">Prioritas</TableHead>
                  <TableHead className="w-36 text-[11px] font-medium text-zinc-500">Pelapor</TableHead>
                  <TableHead className="w-36 text-[11px] font-medium text-zinc-500">Teknisi</TableHead>
                  <TableHead className="w-32 text-[11px] font-medium text-zinc-500">Batas SLA</TableHead>
                  <TableHead className="w-28 text-[11px] font-medium text-zinc-500">Dibuat</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketList.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalCount}
              itemsPerPage={perPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
