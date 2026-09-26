import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachments, tickets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { canAccessTicket } from "@/lib/auth/helpers";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs/promises";
import { lookup } from "mime-types";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(
  (process.env.ALLOWED_EXTENSIONS || "jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,txt,zip,csv")
    .split(",")
    .map((ext) => ext.trim().toLowerCase())
);

const DANGEROUS_MIME_TYPES = new Set([
  "application/x-executable",
  "application/x-msdownload",
  "application/x-msdos-program",
  "text/html",
  "application/javascript",
  "text/javascript",
  "application/x-php",
  "application/x-sh",
  "application/x-csh",
]);

// POST /api/tickets/[id]/attachments — upload file
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = (session.user as any).role;
  const userId = session.user.id!;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, id),
  });

  if (!ticket || ticket.deletedAt) return errorResponse("Ticket not found", 404);

  if (!canAccessTicket(userRole, userId, ticket.requesterId, ticket.assigneeId)) {
    return errorResponse("Forbidden", 403);
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("Invalid form data", 400);
  }

  const file = formData.get("file") as File | null;
  const messageId = formData.get("messageId") as string | null;

  if (!file) return errorResponse("No file provided", 400);

  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`, 400);
  }

  // Validate file extension
  const originalName = file.name;
  const ext = path.extname(originalName).replace(".", "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return errorResponse(`File type .${ext} is not allowed`, 400);
  }

  // Validate MIME type (don't trust client-provided value)
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = lookup(ext) || "application/octet-stream";

  if (DANGEROUS_MIME_TYPES.has(detectedMime)) {
    return errorResponse("File type is not allowed for security reasons", 400);
  }

  // Generate secure filename
  const storedName = `${nanoid()}.${ext}`;
  const uploadDirResolved = path.resolve(process.cwd(), UPLOAD_DIR);
  const storagePath = path.join(uploadDirResolved, storedName);

  // Ensure upload directory exists
  await fs.mkdir(uploadDirResolved, { recursive: true });

  // Write file
  await fs.writeFile(storagePath, buffer);

  // Save to database
  const [attachment] = await db
    .insert(attachments)
    .values({
      ticketId: id,
      messageId: messageId || null,
      uploadedById: userId,
      originalName: path.basename(originalName),
      storedName,
      mimeType: detectedMime,
      size: file.size,
      storagePath,
    })
    .returning();

  await createAuditLog({
    actorId: userId,
    actorEmail: session.user.email,
    action: "attachment_uploaded",
    targetType: "ticket",
    targetId: id,
    metadata: { attachmentId: attachment.id, originalName, size: file.size },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(attachment, { status: 201 });
}
