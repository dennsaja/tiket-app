import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, users } from "@/lib/db/schema";
import { eq, and, isNull, count, lt, sql, desc, gte } from "drizzle-orm";
import { subDays } from "date-fns";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import {
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;
  const userRole = (user as any)?.role || "user";
  const userId = user?.id || "";

  const now = new Date();
  const last7Days = subDays(now, 7);

  // Role filter condition
  const roleFilter = userRole === "user" ? eq(tickets.requesterId, userId) : undefined;
  const baseWhere = and(isNull(tickets.deletedAt), roleFilter);

  let total = 0;
  let openCount = 0;
  let inProgressCount = 0;
  let pendingCount = 0;
  let resolvedCount = 0;
  let overdueCount = 0;
  let assignedToMeCount = 0;
  let recentTickets: any[] = [];

  try {
    // Fetch status counts
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

    total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    openCount = statusMap["open"] || 0;
    inProgressCount = (statusMap["in_progress"] || 0) + (statusMap["assigned"] || 0);
    pendingCount = (statusMap["pending"] || 0) + (statusMap["waiting_for_user"] || 0);
    resolvedCount = (statusMap["resolved"] || 0) + (statusMap["closed"] || 0);

    // Overdue count (SLA breached)
    const overdueRes = await db
      .select({ overdueCount: count() })
      .from(tickets)
      .where(
        and(
          isNull(tickets.deletedAt),
          roleFilter,
          lt(tickets.slaResolutionDue, now),
          sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`
        )
      );
    overdueCount = Number(overdueRes[0]?.overdueCount || 0);

    // Assigned to me (agent/admin/noc/owner)
    if (["noc", "owner", "admin", "agent"].includes(userRole)) {
      const myRes = await db
        .select({ myCount: count() })
        .from(tickets)
        .where(
          and(
            isNull(tickets.deletedAt),
            eq(tickets.assigneeId, userId),
            sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`
          )
        );
      assignedToMeCount = Number(myRes[0]?.myCount || 0);
    }

    // Recent tickets
    recentTickets = await db.query.tickets.findMany({
      where: baseWhere,
      with: {
        requester: { columns: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { columns: { id: true, name: true, avatarUrl: true } },
        department: { columns: { id: true, name: true } },
      },
      orderBy: [desc(tickets.createdAt)],
      limit: 6,
    });
  } catch {
    // Graceful fallback for build-time rendering without live DB connection
  }

  return (
    <div className="space-y-6">
      {/* Top Banner (Vercel Style) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Selamat datang kembali, {user?.name || "User"}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {userRole === "noc"
              ? "Ringkasan Sistem & NOC Administrator Helpdesk"
              : userRole === "owner"
              ? "Ringkasan Manajemen & Operasional Helpdesk"
              : userRole === "admin"
              ? "Ringkasan Pemantauan & Operasional Helpdesk"
              : userRole === "agent"
              ? "Antrean Teknisi & Tiket Ditugaskan"
              : "Daftar Permintaan Bantuan & Tiket Anda"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tickets/new">
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Buat Tiket Baru
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards (Vercel Style) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tiket"
          value={total}
          icon={<Ticket className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />}
          description="Seluruh tiket masuk"
          colorClass="bg-zinc-100 dark:bg-zinc-800"
        />
        <StatCard
          title="Baru / Dikerjakan"
          value={openCount + inProgressCount}
          icon={<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          description={`${openCount} baru, ${inProgressCount} proses`}
          colorClass="bg-amber-50 dark:bg-amber-950/40"
        />
        <StatCard
          title="SLA Terlewat"
          value={Number(overdueCount)}
          icon={<AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />}
          description="Perlu penanganan segera"
          colorClass="bg-red-50 dark:bg-red-950/40"
        />
        <StatCard
          title="Selesai & Ditutup"
          value={resolvedCount}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          description="Berhasil diselesaikan"
          colorClass="bg-emerald-50 dark:bg-emerald-950/40"
        />
      </div>

      {/* Quick Agent Banner */}
      {(userRole === "agent" || userRole === "admin" || userRole === "noc" || userRole === "owner") && assignedToMeCount > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black text-white dark:bg-white dark:text-black shadow-xs shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Anda memiliki {assignedToMeCount} tiket aktif yang ditugaskan kepada Anda
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Periksa antrean tiket untuk memenuhi target SLA respons &amp; resolusi
              </p>
            </div>
          </div>
          <Link href={`/tickets?assigneeId=${userId}`}>
            <Button size="sm" variant="outline" className="text-xs shrink-0">
              Lihat Antrean Saya
            </Button>
          </Link>
        </div>
      )}

      {/* Recent Tickets Table (Vercel Style) */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div>
            <h2 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Tiket Terbaru</h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Daftar tiket bantuan dan aktivitas terkini</p>
          </div>
          <Link
            href="/tickets"
            className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            <span>Lihat semua</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentTickets.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Belum ada tiket ditemukan. Buat tiket pertama Anda untuk memulai.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {recentTickets.map((t) => (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <span className="font-mono text-xs font-medium text-zinc-400 shrink-0">
                    #{t.ticketNumber}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="text-xs font-medium text-zinc-900 hover:text-black dark:text-zinc-100 dark:hover:text-white truncate block max-w-xs sm:max-w-md"
                    >
                      {t.title}
                    </Link>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] text-zinc-400 flex-wrap">
                      <span>{t.requester?.name || "Pelapor"}</span>
                      {t.department && (
                        <>
                          <span>•</span>
                          <span>{t.department.name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-mono">{formatRelativeTime(t.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-start sm:self-auto pl-7 sm:pl-0">
                  <PriorityBadge priority={t.priority} size="sm" />
                  <StatusBadge status={t.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
