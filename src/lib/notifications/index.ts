import { db } from "@/lib/db";
import { notifications, users, tickets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface CreateNotificationInput {
  userId: string;
  type: typeof notifications.$inferInsert["type"];
  title: string;
  message: string;
  ticketId?: string;
  data?: Record<string, any>;
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    ticketId: input.ticketId,
    data: input.data,
  });
}

/**
 * Create notifications for ticket assignment
 */
export async function notifyTicketAssigned(
  ticketId: string,
  ticketNumber: number,
  ticketTitle: string,
  assigneeId: string
): Promise<void> {
  await createNotification({
    userId: assigneeId,
    type: "ticket_assigned",
    title: `Ticket #${ticketNumber} assigned to you`,
    message: `You have been assigned ticket: "${ticketTitle}"`,
    ticketId,
    data: { ticketNumber, ticketTitle },
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
    ? `New internal note on #${ticketNumber}`
    : `New reply on #${ticketNumber}`;
  const message = isInternalNote
    ? `${authorName} left an internal note on "${ticketTitle}"`
    : `${authorName} replied to "${ticketTitle}"`;

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
    resolved: "Resolved",
    closed: "Closed",
    reopened: "Reopened",
    in_progress: "In Progress",
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
    title: `Ticket #${ticketNumber} is now ${statusLabel}`,
    message: `${changedByName} changed status of "${ticketTitle}" to ${statusLabel}`,
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
    .where(
      eq(notifications.id, notificationId)
    );
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
