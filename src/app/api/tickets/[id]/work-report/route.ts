import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import {
  tickets,
  ticketWorkReports,
  ticketStatusHistory,
  attachments,
  ticketAssignees,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notifications";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs/promises";
import { lookup } from "mime-types";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = currentUser.role;
  const userId = currentUser.id;

  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, id), isNull(tickets.deletedAt)),
  });

  if (!ticket) return errorResponse("Ticket not found", 404);

  // Check permission: Staff (NOC, Owner, Admin) or assigned technician
  let hasPermission = ["noc", "owner", "admin"].includes(userRole);
  if (!hasPermission && userRole === "agent") {
    if (ticket.assigneeId === userId) {
      hasPermission = true;
    } else {
      const assigned = await db.query.ticketAssignees.findFirst({
        where: and(
          eq(ticketAssignees.ticketId, id),
          eq(ticketAssignees.userId, userId)
        ),
      });
      if (assigned) hasPermission = true;
    }
  }

  if (!hasPermission) {
    return errorResponse(
      "Forbidden: Hanya teknisi yang ditugaskan atau admin yang dapat mengirimkan laporan kerja",
      403
    );
  }

  const contentType = req.headers.get("content-type") || "";
  let summary = "";
  let actionTaken = "";
  let materialsUsed = "";
  let finalResult = "";
  let beforePhotoUrls: string[] = [];
  let afterPhotoUrls: string[] = [];

  const uploadDirResolved = path.resolve(process.cwd(), UPLOAD_DIR);
  await fs.mkdir(uploadDirResolved, { recursive: true });

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    summary = (formData.get("summary") as string) || "";
    actionTaken = (formData.get("actionTaken") as string) || "";
    materialsUsed = (formData.get("materialsUsed") as string) || "";
    finalResult = (formData.get("finalResult") as string) || "";

    // Existing URLs passed as json array string (if any)
    const existingBefore = formData.get("existingBeforePhotos");
    if (existingBefore && typeof existingBefore === "string") {
      try {
        const parsed = JSON.parse(existingBefore);
        if (Array.isArray(parsed)) beforePhotoUrls.push(...parsed);
      } catch {}
    }
    const existingAfter = formData.get("existingAfterPhotos");
    if (existingAfter && typeof existingAfter === "string") {
      try {
        const parsed = JSON.parse(existingAfter);
        if (Array.isArray(parsed)) afterPhotoUrls.push(...parsed);
      } catch {}
    }

    // Process file entries
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        if (value.size > MAX_FILE_SIZE_BYTES) {
          return errorResponse(`Ukuran file "${value.name}" melebihi batas 15MB`, 400);
        }

        const originalName = value.name;
        const ext = path.extname(originalName).replace(".", "").toLowerCase() || "jpg";
        if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
          return errorResponse(`Format file .${ext} tidak didukung. Harap unggah foto (JPG/PNG/WebP).`, 400);
        }

        const buffer = Buffer.from(await value.arrayBuffer());
        const detectedMime = lookup(ext) || "image/jpeg";
        const storedName = `report_${nanoid()}.${ext}`;
        const storagePath = path.join(uploadDirResolved, storedName);

        await fs.writeFile(storagePath, buffer);

        const [attachment] = await db
          .insert(attachments)
          .values({
            ticketId: id,
            uploadedById: userId,
            originalName: path.basename(originalName),
            storedName,
            mimeType: detectedMime,
            size: value.size,
            storagePath,
          })
          .returning();

        const fileUrl = `/api/attachments/${attachment.id}`;
        if (key.toLowerCase().startsWith("before") || key.includes("Before")) {
          beforePhotoUrls.push(fileUrl);
        } else {
          afterPhotoUrls.push(fileUrl);
        }
      }
    }
  } else {
    // JSON Payload
    const body = await req.json().catch(() => ({}));
    summary = body.summary || "";
    actionTaken = body.actionTaken || "";
    materialsUsed = body.materialsUsed || "";
    finalResult = body.finalResult || "";
    if (Array.isArray(body.beforePhotos)) beforePhotoUrls = body.beforePhotos;
    if (Array.isArray(body.afterPhotos)) afterPhotoUrls = body.afterPhotos;
  }

  if (!summary.trim() || summary.trim().length < 3) {
    return errorResponse("Ringkasan pekerjaan minimal 3 karakter", 422);
  }
  if (!actionTaken.trim() || actionTaken.trim().length < 3) {
    return errorResponse("Tindakan penanganan yang dilakukan minimal 3 karakter", 422);
  }

  // 1. Insert Work Report
  const [workReport] = await db
    .insert(ticketWorkReports)
    .values({
      ticketId: id,
      technicianId: userId,
      summary: summary.trim(),
      actionTaken: actionTaken.trim(),
      materialsUsed: materialsUsed.trim() || null,
      finalResult: finalResult.trim() || null,
      beforePhotos: beforePhotoUrls,
      afterPhotos: afterPhotoUrls,
    })
    .returning();

  // 2. Update Ticket to Resolved
  const resolutionText = `Ringkasan: ${summary.trim()}\nTindakan: ${actionTaken.trim()}${
    materialsUsed.trim() ? `\nMaterial: ${materialsUsed.trim()}` : ""
  }${finalResult.trim() ? `\nHasil Akhir: ${finalResult.trim()}` : ""}`;

  await db
    .update(tickets)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      slaResolvedAt: new Date(),
      resolution: resolutionText,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id));

  // 3. Status History
  await db.insert(ticketStatusHistory).values({
    ticketId: id,
    fromStatus: ticket.status,
    toStatus: "resolved",
    changedById: userId,
    reason: "Laporan kerja teknisi berhasil diserahkan",
  });

  // 4. Notify
  await notifyStatusChange(
    id,
    ticket.ticketNumber,
    ticket.title,
    "resolved",
    ticket.requesterId,
    currentUser.name || "Teknisi"
  ).catch(() => {});

  // 5. Audit Log
  await createAuditLog({
    actorId: userId,
    actorEmail: currentUser.email,
    action: "ticket_resolved",
    targetType: "ticket",
    targetId: id,
    metadata: {
      action: "work_report_submitted",
      reportId: workReport.id,
      beforePhotosCount: beforePhotoUrls.length,
      afterPhotosCount: afterPhotoUrls.length,
    },
    ipAddress: getClientIp(req),
  });

  const fullReport = await db.query.ticketWorkReports.findFirst({
    where: eq(ticketWorkReports.id, workReport.id),
    with: {
      technician: {
        columns: { id: true, name: true, avatarUrl: true, role: true },
      },
    },
  });

  return NextResponse.json(fullReport, { status: 201 });
}
