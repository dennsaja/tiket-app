import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Clock3, Ticket, UserRoundCheck, Plus, Inbox, Activity, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import { PeriodSelect } from "./period-select";
import { TicketActivityChart, type ActivityPoint } from "./ticket-activity-chart";
import type { DashboardPeriod, summarizeStatuses } from "@/lib/utils/dashboard";

export interface RecentDashboardTicket {
  id: string;
  ticketNumber: number;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
  requester: { name: string; avatarUrl: string | null } | null;
  assignee: { name: string; avatarUrl: string | null } | null;
  department: { name: string } | null;
}
export interface DashboardOverviewProps {
  name: string;
  role: string;
  days: DashboardPeriod;
  dateLabel: string;
  stats: ReturnType<typeof summarizeStatuses>;
  overdue: number;
  assigned: number;
  recentTickets: RecentDashboardTicket[];
  activity: ActivityPoint[];
  dataUnavailable?: boolean;
}

export function DashboardOverview({ name, role, days, dateLabel, stats, overdue, assigned, recentTickets, activity, dataUnavailable }: DashboardOverviewProps) {
  const ticketsHref = "/tickets?days=" + days;
  const canCreate = ["noc", "owner", "admin"].includes(role);
  const staff = ["noc", "owner", "admin", "agent"].includes(role);
  const segments = [
    { label: "Baru & dibuka kembali", count: stats.open, color: "#5d7bff" },
    { label: "Sedang dikerjakan", count: stats.inProgress, color: "#ff996a" },
    { label: "Menunggu respons", count: stats.pending, color: "#f6c64b" },
    { label: "Selesai & ditutup", count: stats.resolved, color: "#40d6a0" },
    { label: "Dibatalkan", count: stats.cancelled, color: "#f27787" },
  ];
  let offset = 0;
  const stops = segments.filter((segment) => segment.count > 0).map((segment) => {
    const start = offset;
    offset += stats.total ? segment.count / stats.total * 100 : 0;
    return segment.color + " " + start + "% " + offset + "%";
  });
  const donut = stops.length ? "conic-gradient(" + stops.join(", ") + ")" : "var(--surface-hover)";

  return <div className="overview-page">
    <section className="overview-heading">
      <div><p className="page-eyebrow"><span /> SUPPORT WORKSPACE</p><h1>Halo, {name.split(" ")[0]}! <span className="greeting-wave" aria-hidden="true">👋</span></h1><p>Pantau tiket dan aktivitas helpdesk kamu dalam satu tempat.</p></div>
      <div className="overview-heading-actions"><PeriodSelect days={days} />{canCreate && <Link className="primary-action" href="/tickets/new"><Plus className="h-4 w-4" />Buat tiket</Link>}</div>
    </section>
    {dataUnavailable && <div role="status" className="data-unavailable"><AlertTriangle className="h-4 w-4 shrink-0" />Data tiket belum dapat dimuat. Coba muat ulang halaman beberapa saat lagi.</div>}
    <section className="overview-primary" aria-label="Statistik dan aktivitas tiket">
      <div className="metrics-grid">
        <StatCard title="Total tiket" value={stats.total} description={"Tiket masuk · " + days + " hari terakhir"} featured href={ticketsHref} icon={<Ticket className="h-3.5 w-3.5" />} badge="Semua status" />
        <StatCard title="Sedang dikerjakan" value={stats.inProgress} description="Ditugaskan hingga penanganan di lokasi" href={ticketsHref + "&view=in-progress"} icon={<Activity className="h-3.5 w-3.5" />} badge="Aktif" tone="warning" />
        <StatCard title="SLA terlewat" value={overdue} description="Tiket periode ini yang melewati SLA" href={ticketsHref + "&view=overdue"} icon={<Clock3 className="h-3.5 w-3.5" />} badge={overdue ? "Perlu perhatian" : "Terkendali"} tone={overdue ? "danger" : "success"} />
        <StatCard title="Tiket selesai" value={stats.resolved} description="Berhasil diselesaikan atau ditutup" href={ticketsHref + "&view=resolved"} icon={<Check className="h-3.5 w-3.5" />} badge={stats.resolutionRate + "% dari total"} tone="success" />
      </div>
      <div className="dashboard-panel activity-panel">
        <div className="panel-heading"><div><h2>Aktivitas tiket <span className="panel-subtitle">Tiket masuk per hari</span></h2><p>{dateLabel} <span className="chart-legend-dot" /> WIB</p></div><Link href={ticketsHref} className="round-arrow" aria-label="Lihat seluruh tiket"><ArrowUpRight className="h-5 w-5" /></Link></div>
        <TicketActivityChart data={activity} />
      </div>
    </section>
    <section className="overview-secondary" aria-label="Antrean dan distribusi tiket">
      <Link href={ticketsHref + "&view=open"} className="dashboard-panel insight-card">
        <span className="insight-icon"><Inbox className="h-5 w-5" /></span><ArrowUpRight className="insight-arrow h-5 w-5" />
        <div className="insight-body"><h2><strong>{stats.open}</strong><span>tiket baru</span></h2><p><span className={stats.open ? "text-[var(--warning)]" : ""}>{stats.open ? "Menunggu penanganan" : "Antrean baru sudah bersih"}</span> pada periode ini.</p></div>
      </Link>
      <Link href={staff ? "/tickets?mine=true&view=active" : ticketsHref + "&view=pending"} className="dashboard-panel insight-card insight-pattern">
        <span className="insight-icon"><UserRoundCheck className="h-5 w-5" /></span><ArrowUpRight className="insight-arrow h-5 w-5" />
        <div className="insight-body"><h2><strong>{staff ? assigned : stats.pending}</strong><span>{staff ? "tugas saya" : "menunggu"}</span></h2><p>{staff ? "Seluruh tiket aktif yang ditugaskan kepada kamu." : "Tiket periode ini yang menunggu tindak lanjut."}</p></div>
      </Link>
      <div className="dashboard-panel distribution-panel">
        <div className="panel-heading"><div><h2>Distribusi status</h2><p>{days} hari terakhir · {stats.total.toLocaleString("id-ID")} tiket</p></div><Link href={ticketsHref} className="round-arrow" aria-label="Lihat tiket berdasarkan status"><ArrowUpRight className="h-5 w-5" /></Link></div>
        <div className="distribution-content">
          <div className="status-donut" style={{ background: donut }} role="img" aria-label={stats.total ? segments.map((segment) => segment.label + ": " + segment.count).join(", ") : "Belum ada tiket pada periode ini"}>
            <div><strong>{stats.resolutionRate}%</strong><span>terselesaikan</span></div>
          </div>
          <ul className="status-legend">{segments.map((segment) => <li key={segment.label}><span className="legend-dot" style={{ background: segment.color }} /><span>{segment.label}</span><strong>{segment.count}</strong></li>)}</ul>
        </div>
      </div>
    </section>
    <section className="dashboard-panel recent-panel">
      <div className="panel-heading"><div><h2>Tiket terbaru</h2><p>Permintaan bantuan terbaru dalam {days} hari terakhir.</p></div><Link href={ticketsHref} className="text-action">Lihat semua <ArrowRight className="h-4 w-4" /></Link></div>
      {recentTickets.length ? <div className="recent-table-wrap"><table className="recent-table"><thead><tr><th scope="col">Tiket</th><th scope="col">Pelapor</th><th scope="col">Prioritas</th><th scope="col">Status</th><th scope="col">Dibuat</th><th scope="col"><span className="sr-only">Buka tiket</span></th></tr></thead>
        <tbody>{recentTickets.map((ticket) => <tr key={ticket.id}>
          <td><Link href={"/tickets/" + ticket.id} className="recent-ticket-title"><span>#{ticket.ticketNumber}</span><strong>{ticket.title}</strong></Link>{ticket.department && <p className="recent-department">{ticket.department.name}</p>}</td>
          <td><span className="flex items-center gap-2"><Avatar name={ticket.requester?.name || "Pelapor"} src={ticket.requester?.avatarUrl} size="sm" /><span>{ticket.requester?.name || "Pelapor"}</span></span></td>
          <td><PriorityBadge priority={ticket.priority} size="sm" /></td><td><StatusBadge status={ticket.status} size="sm" /></td><td className="whitespace-nowrap">{formatRelativeTime(ticket.createdAt)}</td><td><Link href={"/tickets/" + ticket.id} className="recent-open" aria-label={"Buka tiket " + ticket.ticketNumber}><ArrowUpRight className="h-4 w-4" /></Link></td>
        </tr>)}</tbody></table></div> : <div className="recent-empty"><span className="insight-icon"><Ticket className="h-6 w-6" /></span><h3>{dataUnavailable ? "Data belum tersedia" : "Belum ada tiket pada periode ini"}</h3><p>{canCreate ? "Buat tiket baru atau pilih periode lain untuk melihat aktivitas." : "Pilih periode lain untuk melihat aktivitas tiket kamu."}</p>{canCreate && <Link href="/tickets/new" className="text-action">Buat tiket pertama <ArrowRight className="h-4 w-4" /></Link>}</div>}
    </section>
    <footer className="overview-footer"><span>HelpDesk <span className="footer-divider">/</span> Your support, simplified.</span><span><span className="footer-dot" />{dataUnavailable ? "Menunggu koneksi data" : "Semua data diperbarui saat halaman dimuat"}</span></footer>
  </div>;
}
