import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachments, tickets } from "@/lib/db/schema";
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
  const session = await auth();
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

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": String(fileBuffer.length),
        // Prevent browsers from executing the file
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
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
