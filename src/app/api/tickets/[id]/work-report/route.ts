import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import {
  tickets,
  ticketWorkReports,
  ticketStatusHistory,
  attachments,
  ticketAssignees,
  systemSettings,
} from "@/lib/db/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notifications";
import { notificationBus } from "@/lib/notifications/bus";
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

  const requestKey = req.headers.get("idempotency-key");
  if (requestKey && !/^[a-zA-Z0-9_-]{16,128}$/.test(requestKey)) return errorResponse("Idempotency-Key tidak valid", 422);
  const receiptKey = requestKey ? "work_report:" + createHash("sha256").update(userId + ":" + id + ":" + requestKey).digest("hex") : null;
  const writtenFiles: string[] = [];
  const effects: { run?: () => Promise<void> } = {};
  try {
  const response = await db.transaction(async tx => {
  // Serialize all submissions for a ticket across processes, including older APKs.
  await tx.execute(sql`SELECT id FROM tickets WHERE id = ${id} FOR UPDATE`);
  const lockedTicket = await tx.query.tickets.findFirst({ where: and(eq(tickets.id, id), isNull(tickets.deletedAt)) });
  if (!lockedTicket) throw new ReportError("Ticket not found", 404);
  if (userRole === "agent" && lockedTicket.assigneeId !== userId) {
    const assigned = await tx.query.ticketAssignees.findFirst({ where: and(eq(ticketAssignees.ticketId, id), eq(ticketAssignees.userId, userId)) });
    if (!assigned) throw new ReportError("Penugasan tiket telah berubah.", 403);
  }
  const receipt = receiptKey ? await tx.query.systemSettings.findFirst({ where: eq(systemSettings.key, receiptKey) }) : null;
  if (receipt?.value) {
    const report = await tx.query.ticketWorkReports.findFirst({ where: eq(ticketWorkReports.id, receipt.value) });
    if (report) return NextResponse.json(report, { headers: { "Idempotency-Replayed": "true" } });
  }
  if (["resolved", "closed"].includes(lockedTicket.status)) {
    const report = await tx.query.ticketWorkReports.findFirst({ where: eq(ticketWorkReports.ticketId, id), orderBy: [desc(ticketWorkReports.createdAt)] });
    if (report) return NextResponse.json(report, { headers: { "Idempotency-Replayed": "true" } });
    throw new ReportError("Tiket sudah selesai. Buka kembali tiket sebelum mengirim laporan baru.", 409);
  }
  if (lockedTicket.status === "cancelled") throw new ReportError("Tiket telah dibatalkan.", 409);
  const contentType = req.headers.get("content-type") || "";
  let summary = "";
  let actionTaken = "";
  let materialsUsed = "";
  let finalResult = "";
  let technicalDataJson = "";
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
    technicalDataJson = (formData.get("technicalDataJson") as string) || "";

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
          throw new ReportError(`Ukuran file "${value.name}" melebihi batas 15MB`, 400);
        }

        const originalName = value.name;
        const ext = path.extname(originalName).replace(".", "").toLowerCase() || "jpg";
        if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
          throw new ReportError(`Format file .${ext} tidak didukung. Harap unggah foto (JPG/PNG/WebP).`, 400);
        }

        const buffer = Buffer.from(await value.arrayBuffer());
        const detectedMime = lookup(ext) || "image/jpeg";
        const storedName = `report_${nanoid()}.${ext}`;
        const storagePath = path.join(uploadDirResolved, storedName);

        writtenFiles.push(storagePath);
        await fs.writeFile(storagePath, buffer);

        const [attachment] = await tx
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
    if (body.technicalDataJson) {
      technicalDataJson =
        typeof body.technicalDataJson === "string"
          ? body.technicalDataJson
          : JSON.stringify(body.technicalDataJson);
    }
    if (Array.isArray(body.beforePhotos)) beforePhotoUrls = body.beforePhotos;
    if (Array.isArray(body.afterPhotos)) afterPhotoUrls = body.afterPhotos;
  }

  if (!summary.trim() || summary.trim().length < 3) {
    throw new ReportError("Ringkasan pekerjaan minimal 3 karakter", 422);
  }
  if (!actionTaken.trim() || actionTaken.trim().length < 3) {
    throw new ReportError("Tindakan penanganan yang dilakukan minimal 3 karakter", 422);
  }

  let parsedTechData: Record<string, any> | null = null;
  if (technicalDataJson) {
    try {
      parsedTechData = JSON.parse(technicalDataJson);
    } catch {}
  }

  // 1. Insert Work Report
  const [workReport] = await tx
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

  // 2. Update Ticket to Resolved & persist structured technical field report into specData
  const resolutionText = `Ringkasan: ${summary.trim()}\nTindakan: ${actionTaken.trim()}${
    materialsUsed.trim() ? `\nMaterial: ${materialsUsed.trim()}` : ""
  }${finalResult.trim() ? `\nHasil Akhir: ${finalResult.trim()}` : ""}`;

  const updatedSpecData =
    lockedTicket.specData && typeof lockedTicket.specData === "object"
      ? { ...(lockedTicket.specData as Record<string, any>) }
      : {};
  if (parsedTechData) {
    updatedSpecData.fieldReport = {
      ...parsedTechData,
      submittedBy: currentUser.name || "Teknisi",
      submittedAt: new Date().toISOString(),
    };
  }

  await tx
    .update(tickets)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      slaResolvedAt: new Date(),
      resolution: resolutionText,
      specData: updatedSpecData,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id));

  // 3. Status History
  await tx.insert(ticketStatusHistory).values({
    ticketId: id,
    fromStatus: lockedTicket.status,
    toStatus: "resolved",
    changedById: userId,
    reason: "Laporan kerja teknisi berhasil diserahkan",
  });

  const fullReport = await tx.query.ticketWorkReports.findFirst({
    where: eq(ticketWorkReports.id, workReport.id),
    with: {
      technician: {
        columns: { id: true, name: true, avatarUrl: true, role: true },
      },
    },
  });

  if (receiptKey) await tx.insert(systemSettings).values({ key: receiptKey, value: workReport.id, description: "Work report idempotency receipt" });
  effects.run = async () => {
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

  notificationBus.emitSystemEvent({
    action: "work_report_submitted",
    ticketId: id,
    ticketNumber: ticket.ticketNumber,
    status: "resolved",
    actorId: userId,
    actorName: currentUser.name || "Teknisi",
    timestamp: new Date().toISOString(),
  });

  };
  return NextResponse.json(fullReport, { status: 201 });
  });
  if (effects.run) await effects.run().catch(error => console.error("[work-report] Post-commit notification failed", error));
  return response;
  } catch (error) {
    await Promise.all(writtenFiles.map(file => fs.unlink(file).catch(() => {})));
    if (error instanceof ReportError) return errorResponse(error.message, error.status);
    console.error("[work-report] Submission failed", error);
    return errorResponse("Laporan belum tersimpan. Coba ulang dengan permintaan yang sama.", 503);
  }
}

class ReportError extends Error { constructor(message: string, public status: number) { super(message); } }
