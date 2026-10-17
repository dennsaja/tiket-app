import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { getBackupBuffer, deleteServerBackup } from "@/lib/backup/manager";

// GET /api/admin/backup/[filename] — Download backup archive
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  const role = currentUser.role;
  if (!["noc", "owner", "admin"].includes(role)) {
    return errorResponse("Forbidden: Akses khusus NOC, Owner, dan Admin", 403);
  }

  const { filename } = await params;
  const safeFilename = filename.replace(/[^\w.-]/g, "_");

  const buffer = await getBackupBuffer(safeFilename);
  if (!buffer) {
    return errorResponse("Berkas cadangan tidak ditemukan di server", 404);
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// DELETE /api/admin/backup/[filename] — Delete backup archive from server
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  const role = currentUser.role;
  if (!["noc", "owner", "admin"].includes(role)) {
    return errorResponse("Forbidden: Akses khusus NOC, Owner, dan Admin", 403);
  }

  const { filename } = await params;
  const safeFilename = filename.replace(/[^\w.-]/g, "_");

  const success = await deleteServerBackup(safeFilename);
  if (!success) {
    return errorResponse("Berkas cadangan tidak ditemukan atau gagal dihapus", 404);
  }

  await createAuditLog({
    actorId: currentUser.id,
    actorEmail: currentUser.email,
    action: "settings_updated",
    targetType: "backup",
    targetId: safeFilename,
    metadata: {
      action: "backup_deleted",
      filename: safeFilename,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    success: true,
    message: `Berkas cadangan ${safeFilename} berhasil dihapus dari server`,
  });
}
