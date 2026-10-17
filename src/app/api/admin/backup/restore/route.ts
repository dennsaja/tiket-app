import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { getBackupBuffer, restoreFromBackup } from "@/lib/backup/manager";

// POST /api/admin/backup/restore — Restore application data from a backup
export async function POST(req: NextRequest) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  const role = currentUser.role;
  if (!["noc", "owner", "admin"].includes(role)) {
    return errorResponse("Forbidden: Akses khusus NOC, Owner, dan Admin", 403);
  }

  const contentType = req.headers.get("content-type") || "";

  try {
    let buffer: Buffer | null = null;
    let mode: "overwrite" | "merge" = "overwrite";
    let sourceName = "Uploaded File";

    if (contentType.includes("multipart/form-data")) {
      // Restore from uploaded file
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const requestedMode = formData.get("mode") as string | null;

      if (!file) {
        return errorResponse("Pilih berkas cadangan (.zip atau .json) untuk dipulihkan", 400);
      }

      mode = requestedMode === "merge" ? "merge" : "overwrite";
      sourceName = file.name;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      // Restore from a file already on the server
      const body = await req.json().catch(() => ({}));
      const filename = body.filename;
      mode = body.mode === "merge" ? "merge" : "overwrite";

      if (!filename || typeof filename !== "string") {
        return errorResponse("Nama berkas cadangan diperlukan", 400);
      }

      sourceName = filename;
      buffer = await getBackupBuffer(filename);
      if (!buffer) {
        return errorResponse(`Berkas cadangan "${filename}" tidak ditemukan di server`, 404);
      }
    }

    if (!buffer || buffer.length === 0) {
      return errorResponse("Berkas cadangan kosong atau tidak dapat dibaca", 400);
    }

    // Execute restore
    const result = await restoreFromBackup(buffer, mode);

    await createAuditLog({
      actorId: currentUser.id,
      actorEmail: currentUser.email,
      action: "settings_updated",
      targetType: "backup_restore",
      targetId: sourceName,
      metadata: {
        action: "backup_restored",
        sourceName,
        mode,
        manifest: result.manifest,
        restoredCounts: result.restoredCounts,
        restoredFilesCount: result.restoredFilesCount,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Data aplikasi berhasil dipulihkan (${
        mode === "merge" ? "Mode Gabung / Append" : "Mode Pemulihan Penuh / Timpa"
      })`,
      sourceName,
      mode,
      manifest: result.manifest,
      restoredCounts: result.restoredCounts,
      restoredFilesCount: result.restoredFilesCount,
      warnings: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err: any) {
    return errorResponse(`Gagal memulihkan data: ${err.message}`, 500);
  }
}
