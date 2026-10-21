import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { attachments, tickets, ticketAssignees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { canAccessTicket } from "@/lib/auth/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import path from "path";
import fs from "fs/promises";

// GET /api/attachments/[id] — download attachment
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthUser(req);
  const session = actor ? { user: actor } : null;
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  const attachment = await db.query.attachments.findFirst({
    where: and(eq(attachments.id, id), eq(attachments.isDeleted, false)),
    with: {
      ticket: true,
    },
  });

  if (!attachment) return errorResponse("Attachment not found", 404);
  if (attachment.ticket?.deletedAt) return errorResponse("Attachment not found",404);
  if (!["noc","owner","admin"].includes(userRole)) {
    const membership = attachment.ticket ? await db.query.ticketAssignees.findFirst({where:and(eq(ticketAssignees.ticketId,attachment.ticket.id),eq(ticketAssignees.userId,userId))}) : null;
    if (attachment.ticket ? !(attachment.ticket.requesterId===userId || attachment.ticket.assigneeId===userId || membership) : attachment.uploadedById!==userId) return errorResponse("Forbidden",403);
  }

  // Authorization: check ticket access
  if (attachment.ticket) {
    if (
      !canAccessTicket(
        userRole,
        userId,
        attachment.ticket.requesterId,
        attachment.ticket.assigneeId
      )
    ) {
      return errorResponse("Forbidden", 403);
    }
  }

  try {
    const fileBuffer = await fs.readFile(attachment.storagePath);
    
    // Safe content disposition — sanitize filename
    const safeFilename = attachment.originalName.replace(/[^\w.-]/g, "_");
    const isImage = attachment.mimeType.startsWith("image/");
    const isPdf = attachment.mimeType === "application/pdf";
    const dispositionType = isImage || isPdf ? "inline" : "attachment";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `${dispositionType}; filename="${safeFilename}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return errorResponse("File not found on disk", 404);
  }
}

// DELETE /api/attachments/[id] — soft delete attachment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  const attachment = await db.query.attachments.findFirst({
    where: and(eq(attachments.id, id), eq(attachments.isDeleted, false)),
    with: { ticket: true },
  });

  if (!attachment) return errorResponse("Attachment not found", 404);

  // Authorization: uploader or admin can delete
  if (userRole !== "admin" && attachment.uploadedById !== userId) {
    return errorResponse("Forbidden", 403);
  }

  await db
    .update(attachments)
    .set({ isDeleted: true })
    .where(eq(attachments.id, id));

  await createAuditLog({
    actorId: userId,
    actorEmail: session.user.email,
    action: "attachment_deleted",
    targetType: "attachment",
    targetId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
