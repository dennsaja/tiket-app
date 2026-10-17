import { db } from "@/lib/db";
import { notifications, tickets, ticketAssignees } from "@/lib/db/schema";
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
 * Helper to get all user IDs involved in a ticket (requester + primary assignee + team assignees),
 * optionally excluding the actor who triggered the event.
 */
export async function getTicketParticipantIds(
  ticketId: string,
  excludeUserId?: string
): Promise<string[]> {
  const recipientSet = new Set<string>();
  const assignedTechSet = new Set<string>();

  try {
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      columns: { requesterId: true, assigneeId: true },
    });

    if (ticket?.requesterId) recipientSet.add(ticket.requesterId);
    if (ticket?.assigneeId) {
      recipientSet.add(ticket.assigneeId);
      assignedTechSet.add(ticket.assigneeId);
    }

    const teamRows = await db
      .select({ userId: ticketAssignees.userId })
      .from(ticketAssignees)
      .where(eq(ticketAssignees.ticketId, ticketId));

    for (const row of teamRows) {
      if (row.userId) {
        recipientSet.add(row.userId);
        assignedTechSet.add(row.userId);
      }
    }
  } catch (e) {
    console.warn("[getTicketParticipantIds] Error:", e);
  }

  // Only exclude the actor if they are not an assigned technician (or if there are other recipients),
  // so testing or self-assigned ticket updates from web still notify the technician's Android device.
  if (excludeUserId && !assignedTechSet.has(excludeUserId) && recipientSet.size > 1) {
    recipientSet.delete(excludeUserId);
  }

  return Array.from(recipientSet);
}

/**
 * Create a notification for a user (DB + Realtime Bus)
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  const [created] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      ticketId: input.ticketId,
      data: input.data,
    })
    .returning();

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

  const typeName = details?.ticketType
    ? typeLabelMap[details.ticketType] || details.ticketType
    : "Penugasan";
  const title = `Penugasan Baru #${ticketNumber} [${typeName}]`;
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
 * Create notifications for new ticket reply or Team Chat message
 */
export async function notifyNewMessage(
  ticketId: string,
  ticketNumber: number,
  ticketTitle: string,
  authorName: string,
  recipientIds: string[],
  isInternalNote: boolean = false,
  messageContent?: string
): Promise<void> {
  const snippet = messageContent
    ? messageContent.length > 90
      ? messageContent.substring(0, 90) + "..."
      : messageContent
    : "";

  const title = isInternalNote
    ? `Chat Tim #${ticketNumber} - ${authorName}`
    : `Pesan Baru #${ticketNumber} - ${authorName}`;

  const message = snippet
    ? `${authorName}: "${snippet}" (${ticketTitle})`
    : isInternalNote
    ? `${authorName} mengirim pesan di ruang Chat Tim "${ticketTitle}"`
    : `${authorName} membalas tiket "${ticketTitle}"`;

  const uniqueRecipients = Array.from(new Set(recipientIds));
  for (const userId of uniqueRecipients) {
    await createNotification({
      userId,
      type: isInternalNote ? "new_internal_note" : "new_message",
      title,
      message,
      ticketId,
      data: {
        ticketNumber,
        ticketTitle,
        authorName,
        isChat: true,
        content: snippet,
      },
    });
  }
}

/**
 * Create notifications for status change (notifies requester AND all assigned technicians except actor)
 */
export async function notifyStatusChange(
  ticketId: string,
  ticketNumber: number,
  ticketTitle: string,
  newStatus: string,
  requesterId: string,
  changedByName: string,
  actorId?: string
): Promise<void> {
  const statusLabels: Record<string, string> = {
    open: "Open",
    assigned: "Ditugaskan",
    accepted: "Diterima Teknisi",
    on_site: "Teknisi di Lokasi (On-Site)",
    in_progress: "Sedang Dikerjakan (In-Progress)",
    resolved: "Selesai (Menunggu Verifikasi)",
    closed: "Ditutup",
    reopened: "Dibuka Kembali",
    pending: "Pending",
  };

  const statusLabel = statusLabels[newStatus] || newStatus;
  const participants = await getTicketParticipantIds(ticketId, actorId);
  if (requesterId && requesterId !== actorId && !participants.includes(requesterId)) {
    participants.push(requesterId);
  }

  const notifType =
    newStatus === "resolved"
      ? "ticket_resolved"
      : newStatus === "closed"
      ? "ticket_closed"
      : newStatus === "reopened"
      ? "ticket_reopened"
      : "ticket_updated";

  for (const recipientId of participants) {
    await createNotification({
      userId: recipientId,
      type: notifType,
      title: `Status Tiket #${ticketNumber}: ${statusLabel}`,
      message: `${changedByName} memperbarui status "${ticketTitle}" menjadi ${statusLabel}`,
      ticketId,
      data: { ticketNumber, ticketTitle, newStatus, changedByName },
    });
  }
}

/**
 * Create notifications when ticket details (title, description, priority, address, map URL, etc.) are updated
 */
export async function notifyTicketDetailsUpdated(
  ticketId: string,
  ticketNumber: number,
  ticketTitle: string,
  updatedByName: string,
  actorId: string,
  summaryText?: string
): Promise<void> {
  const participants = await getTicketParticipantIds(ticketId, actorId);
  const detailDesc = summaryText || "Detail informasi tiket telah diperbarui";

  for (const recipientId of participants) {
    await createNotification({
      userId: recipientId,
      type: "ticket_updated",
      title: `Pembaruan Detail Tiket #${ticketNumber}`,
      message: `${updatedByName}: ${detailDesc} pada "${ticketTitle}"`,
      ticketId,
      data: { ticketNumber, ticketTitle, updatedByName, summaryText: detailDesc },
    });
  }
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
