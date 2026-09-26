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

    // Assigned to me (agent/admin)
    if (userRole === "agent" || userRole === "admin") {
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
      {/* Top Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Selamat datang kembali, {user?.name || "User"}
          </h1>
          <p className="text-xs text-gray-500">
            {userRole === "admin"
              ? "Ringkasan Sistem & Operasional Helpdesk"
              : userRole === "agent"
              ? "Antrean Teknisi & Tiket Ditugaskan"
              : "Daftar Permintaan Bantuan & Tiket Anda"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tickets/new">
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              Buat Tiket Baru
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tiket"
          value={total}
          icon={<Ticket className="h-4 w-4 text-indigo-600" />}
          description="Seluruh tiket masuk"
        />
        <StatCard
          title="Baru / Dikerjakan"
          value={openCount + inProgressCount}
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          description={`${openCount} baru, ${inProgressCount} proses`}
        />
        <StatCard
          title="SLA Terlewat"
          value={Number(overdueCount)}
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          description="Perlu penanganan"
        />
        <StatCard
          title="Selesai & Ditutup"
          value={resolvedCount}
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
          description="Berhasil diselesaikan"
        />
      </div>

      {/* Quick Agent Banner */}
      {(userRole === "agent" || userRole === "admin") && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-600 text-white shadow-xs">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-indigo-950">
                Anda memiliki {assignedToMeCount} tiket aktif yang ditugaskan kepada Anda
              </h3>
              <p className="text-xs text-indigo-700">
                Periksa antrean tiket untuk memenuhi target SLA respons &amp; resolusi
              </p>
            </div>
          </div>
          <Link href={`/tickets?assigneeId=${userId}`}>
            <Button size="sm" variant="outline" className="bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50">
              Lihat Antrean Saya
            </Button>
          </Link>
        </div>
      )}

      {/* Recent Tickets Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Tiket Terbaru</h2>
            <p className="text-xs text-gray-500">Daftar tiket bantuan dan aktivitas terkini</p>
          </div>
          <Link
            href="/tickets"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            <span>Lihat semua</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentTickets.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            Belum ada tiket ditemukan. Buat tiket pertama Anda untuk memulai.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentTickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-medium text-gray-400">
                    #{t.ticketNumber}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="text-xs font-medium text-gray-900 hover:text-indigo-600 truncate block max-w-md"
                    >
                      {t.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                      <span>{t.requester?.name || "Pelapor"}</span>
                      {t.department && (
                        <>
                          <span>•</span>
                          <span>{t.department.name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatRelativeTime(t.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
