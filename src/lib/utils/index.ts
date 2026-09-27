import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format, parseISO, differenceInMinutes } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "d MMM yyyy", { locale: idLocale });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "d MMM yyyy HH:mm", { locale: idLocale });
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: idLocale });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}j ${m}m` : `${h}j`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h > 0 ? `${d}h ${h}j` : `${d}h`;
}

export function getTicketStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Baru",
    assigned: "Ditugaskan",
    accepted: "Tugas Diterima",
    on_site: "Tiba di Lokasi",
    in_progress: "Sedang Dikerjakan",
    pending: "Tertunda",
    waiting_for_user: "Menunggu Respons User",
    waiting_for_third_party: "Menunggu Pihak Ketiga",
    resolved: "Laporan Selesai",
    closed: "Ditutup",
    reopened: "Dibuka Kembali",
    cancelled: "Dibatalkan",
  };
  return labels[status] || status;
}

export function getTicketTypeLabel(type: string | null | undefined): string {
  if (!type) return "PSB";
  const labels: Record<string, string> = {
    psb: "PSB (Pemasangan Baru)",
    perbaikan_infrastruktur: "Perbaikan Jaringan Internet",
    pemasangan_cctv: "Pemasangan CCTV",
    perbaikan_cctv: "Perbaikan CCTV",
    maintenance: "Maintenance Berkala",
  };
  return labels[type] || type;
}

export function getTicketTypeShortLabel(type: string | null | undefined): string {
  if (!type) return "PSB";
  const labels: Record<string, string> = {
    psb: "PSB",
    perbaikan_infrastruktur: "Perbaikan FO",
    pemasangan_cctv: "Pasang CCTV",
    perbaikan_cctv: "Perbaikan CCTV",
    maintenance: "Maintenance",
  };
  return labels[type] || type.toUpperCase();
}

export function getTicketPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    critical: "Kritis",
    high: "Tinggi",
    medium: "Sedang",
    low: "Rendah",
  };
  return labels[priority] || priority;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open: "status-open",
    assigned: "status-assigned",
    in_progress: "status-in-progress",
    pending: "status-pending",
    waiting_for_user: "status-waiting",
    waiting_for_third_party: "status-waiting",
    resolved: "status-resolved",
    closed: "status-closed",
    reopened: "status-reopened",
    cancelled: "status-cancelled",
  };
  return colors[status] || "status-default";
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    critical: "priority-critical",
    high: "priority-high",
    medium: "priority-medium",
    low: "priority-low",
  };
  return colors[priority] || "priority-medium";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function generateTicketNumber(): string {
  return `TKT-${Date.now().toString(36).toUpperCase()}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function isOverdue(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date() > new Date(dueDate);
}

export function getSlaStatus(
  dueDate: Date | null | undefined,
  warningThresholdPercent: number = 80,
  startDate?: Date | null
): "ok" | "warning" | "breached" | "none" {
  if (!dueDate) return "none";
  const now = new Date();
  const due = new Date(dueDate);

  if (now > due) return "breached";

  if (startDate) {
    const start = new Date(startDate);
    const totalMinutes = differenceInMinutes(due, start);
    const elapsedMinutes = differenceInMinutes(now, start);
    const percentElapsed = (elapsedMinutes / totalMinutes) * 100;
    if (percentElapsed >= warningThresholdPercent) return "warning";
  }

  return "ok";
}

export function buildApiUrl(path: string, params?: Record<string, any>): string {
  const url = new URL(path, "http://localhost");
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
  }
  return url.pathname + url.search;
}
