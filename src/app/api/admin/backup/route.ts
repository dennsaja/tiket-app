import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth/get-user";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import {
  createFullBackup,
  listServerBackups,
} from "@/lib/backup/manager";
import { getDatabaseSummaryStats } from "@/lib/backup/database";
import { collectAllUploadFiles } from "@/lib/backup/files";

// GET /api/admin/backup — List all server backups and database statistics
export async function GET(req: NextRequest) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  const role = currentUser.role;
  if (!["noc", "owner", "admin"].includes(role)) {
    return errorResponse("Forbidden: Akses khusus NOC, Owner, dan Admin", 403);
  }

  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get("action");

  try {
    if (action === "stats") {
      const dbStats = await getDatabaseSummaryStats();
      const filesInfo = await collectAllUploadFiles();
      return NextResponse.json({
        success: true,
        stats: {
          ...dbStats,
          totalFilesCount: filesInfo.totalFiles,
          totalFilesBytes: filesInfo.totalBytes,
        },
      });
    }

    const backups = await listServerBackups();
    const dbStats = await getDatabaseSummaryStats();
    const filesInfo = await collectAllUploadFiles();

    return NextResponse.json({
      success: true,
      backups,
      stats: {
        ...dbStats,
        totalFilesCount: filesInfo.totalFiles,
        totalFilesBytes: filesInfo.totalBytes,
      },
    });
  } catch (err: any) {
    return errorResponse(`Gagal memuat daftar backup: ${err.message}`, 500);
  }
}

// POST /api/admin/backup — Create a new backup
export async function POST(req: NextRequest) {
  const currentUser = await getAuthUser(req);
  if (!currentUser) return errorResponse("Unauthorized", 401);

  const role = currentUser.role;
  if (!["noc", "owner", "admin"].includes(role)) {
    return errorResponse("Forbidden: Akses khusus NOC, Owner, dan Admin", 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const includeFiles = body.includeFiles !== false;
    const note = body.note ? String(body.note).trim() : "Cadangan Data Aplikasi";

    const result = await createFullBackup({
      includeFiles,
      note,
      actorEmail: currentUser.email,
    });

    await createAuditLog({
      actorId: currentUser.id,
      actorEmail: currentUser.email,
      action: "settings_updated",
      targetType: "backup",
      targetId: result.filename,
      metadata: {
        action: "backup_created",
        filename: result.filename,
        sizeBytes: result.sizeBytes,
        counts: result.manifest.counts,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: "Cadangan data aplikasi berhasil dibuat",
      backup: {
        filename: result.filename,
        sizeBytes: result.sizeBytes,
        createdAt: result.manifest.createdAt,
        manifest: result.manifest,
        downloadUrl: `/api/admin/backup/${result.filename}`,
      },
    });
  } catch (err: any) {
    return errorResponse(`Gagal membuat cadangan: ${err.message}`, 500);
  }
}
