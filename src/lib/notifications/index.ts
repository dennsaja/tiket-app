import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notificationBus } from "./bus";

interface CreateNotificationInput {
  userId: string;
  type: typeof notifications.$inferInsert["type"];
  title: string;
  message: string;
  ticketId?: string;
  data?: Record<string, any>;
}

export interface TicketAssignedDetails {
  ticketType?: string;
  priority?: string;
  reporterName?: string | null;
  reporterPhone?: string | null;
  reporterAddress?: string | null;
  isLead?: boolean;
}

/**
 * Create a notification for a user (DB + Realtime Bus)
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  const [created] = await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    ticketId: input.ticketId,
    data: input.data,
  }).returning();

  // Push to realtime event bus
  notificationBus.emitNotification({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    ticketId: input.ticketId,
    data: input.data,
    createdAt: (created?.createdAt || new Date()).toISOString(),
  });
}

/**
 * Create notification for ticket assignment with rich metadata
 */
export async function notifyTicketAssigned(
  ticketId: string,
  ticketNumber: number,
  ticketTitle: string,
  assigneeId: string,
  details?: TicketAssignedDetails
): Promise<void> {
  const typeLabelMap: Record<string, string> = {
    psb: "PSB (Pasang Baru)",
    perbaikan_infrastruktur: "Perbaikan Jaringan",
    pemasangan_cctv: "Pasang CCTV",
    perbaikan_cctv: "Perbaikan CCTV",
    maintenance: "Maintenance",
  };

  const typeName = details?.ticketType ? (typeLabelMap[details.ticketType] || details.ticketType) : "Penugasan";
  const title = `🚨 Penugasan Baru #${ticketNumber} [${typeName}]`;
  const reporterInfo = details?.reporterName ? ` | Pelapor: ${details.reporterName}` : "";
  const addressInfo = details?.reporterAddress ? ` (${details.reporterAddress})` : "";
  const message = `Tiket baru ditugaskan ke Anda: "${ticketTitle}"${reporterInfo}${addressInfo}`;

  await createNotification({
    userId: assigneeId,
    type: "ticket_assigned",
    title,
    message,
    ticketId,
    data: {
      ticketNumber,
      ticketTitle,
      ticketType: details?.ticketType,
      priority: details?.priority,
      reporterName: details?.reporterName,
      reporterPhone: details?.reporterPhone,
      reporterAddress: details?.reporterAddress,
      isLead: details?.isLead,
    },
  });
}

/**
 * Create notifications for new ticket reply
 */
export async function notifyNewMessage(
  ticketId: string,
  ticketNumber: number,
  ticketTitle: string,
  authorName: string,
  recipientIds: string[],
  isInternalNote: boolean = false
): Promise<void> {
  const title = isInternalNote
    ? `💬 Catatan Internal baru pada #${ticketNumber}`
    : `💬 Balasan baru pada #${ticketNumber}`;
  const message = isInternalNote
    ? `${authorName} menambahkan catatan internal pada "${ticketTitle}"`
    : `${authorName} membalas tiket "${ticketTitle}"`;

  for (const userId of recipientIds) {
    await createNotification({
      userId,
      type: isInternalNote ? "new_internal_note" : "new_message",
      title,
      message,
      ticketId,
      data: { ticketNumber, ticketTitle, authorName },
    });
  }
}

/**
 * Create notifications for status change
 */
export async function notifyStatusChange(
  ticketId: string,
  ticketNumber: number,
  ticketTitle: string,
  newStatus: string,
  requesterId: string,
  changedByName: string
): Promise<void> {
  const statusLabels: Record<string, string> = {
    accepted: "Diterima Teknisi",
    on_site: "Teknisi di Lokasi",
    in_progress: "Sedang Dikerjakan",
    resolved: "Selesai (Menunggu Verifikasi)",
    closed: "Ditutup",
    reopened: "Dibuka Kembali",
    pending: "Pending",
  };

  const statusLabel = statusLabels[newStatus] || newStatus;

  await createNotification({
    userId: requesterId,
    type:
      newStatus === "resolved"
        ? "ticket_resolved"
        : newStatus === "closed"
        ? "ticket_closed"
        : newStatus === "reopened"
        ? "ticket_reopened"
        : "ticket_updated",
    title: `Tiket #${ticketNumber} status: ${statusLabel}`,
    message: `${changedByName} mengubah status "${ticketTitle}" menjadi ${statusLabel}`,
    ticketId,
    data: { ticketNumber, ticketTitle, newStatus, changedByName },
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, notificationId));
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.userId, userId));
}
