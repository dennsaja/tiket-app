import fs from "fs/promises";
import path from "path";
import { createZipArchive, parseZipArchive, ZipEntry } from "./zip";
import {
  exportDatabaseData,
  restoreDatabaseData,
  getDatabaseSummaryStats,
} from "./database";
import { collectAllUploadFiles, restoreUploadFiles } from "./files";

export const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";

export interface BackupManifest {
  version: string;
  appName: string;
  createdAt: string;
  note?: string;
  includedFiles: boolean;
  counts: {
    users: number;
    tickets: number;
    messages: number;
    workReports: number;
    attachments: number;
    departments: number;
    categories: number;
    filesCount: number;
    filesTotalBytes: number;
    [key: string]: number;
  };
}

export interface BackupFileInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  manifest?: BackupManifest | null;
}

/**
 * Ensures the backup storage directory exists.
 */
async function ensureBackupDirectory(): Promise<string> {
  const dir = path.resolve(process.cwd(), BACKUP_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Creates a complete application data backup (DB JSON + SQL + uploaded photos/attachments)
 * and stores it as a .zip file in the server's backup folder.
 */
export async function createFullBackup(options?: {
  includeFiles?: boolean;
  note?: string;
  actorEmail?: string;
}): Promise<{
  filename: string;
  sizeBytes: number;
  manifest: BackupManifest;
  zipBuffer: Buffer;
}> {
  const includeFiles = options?.includeFiles !== false;
  const note = options?.note || "Backup Data Aplikasi Manual";

  // 1. Export database rows & SQL dump
  const dbResult = await exportDatabaseData();

  // 2. Collect uploaded photos, avatars, and attachments if requested
  const fileResult = includeFiles
    ? await collectAllUploadFiles()
    : { entries: [], totalFiles: 0, totalBytes: 0 };

  const now = new Date();
  const manifest: BackupManifest = {
    version: "1.0.0",
    appName: "HelpDesk Infinity",
    createdAt: now.toISOString(),
    note,
    includedFiles: includeFiles,
    counts: {
      users: dbResult.counts["users"] || 0,
      tickets: dbResult.counts["tickets"] || 0,
      messages: dbResult.counts["ticket_messages"] || 0,
      workReports: dbResult.counts["ticket_work_reports"] || 0,
      attachments: dbResult.counts["attachments"] || 0,
      departments: dbResult.counts["departments"] || 0,
      categories: dbResult.counts["categories"] || 0,
      filesCount: fileResult.totalFiles,
      filesTotalBytes: fileResult.totalBytes,
      ...dbResult.counts,
    },
  };

  // 3. Assemble zip entries
  const zipEntries: ZipEntry[] = [
    {
      path: "manifest.json",
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    },
    {
      path: "database.json",
      data: Buffer.from(JSON.stringify(dbResult.tables, null, 2), "utf8"),
    },
    {
      path: "database.sql",
      data: Buffer.from(dbResult.sqlDump, "utf8"),
    },
    ...fileResult.entries,
  ];

  // 4. Generate ZIP archive
  const zipBuffer = createZipArchive(zipEntries);

  // 5. Generate formatted filename: helpdesk-backup-YYYY-MM-DD-HHmmss.zip
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `helpdesk-data-backup-${timestamp}.zip`;

  // 6. Save to server backup directory
  const backupDir = await ensureBackupDirectory();
  const targetPath = path.join(backupDir, filename);
  await fs.writeFile(targetPath, zipBuffer);

  return {
    filename,
    sizeBytes: zipBuffer.length,
    manifest,
    zipBuffer,
  };
}

/**
 * Lists all existing backup files on the server with their manifests.
 */
export async function listServerBackups(): Promise<BackupFileInfo[]> {
  const backupDir = await ensureBackupDirectory();
  const results: BackupFileInfo[] = [];

  try {
    const items = await fs.readdir(backupDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isFile() && item.name.endsWith(".zip")) {
        const fullPath = path.join(backupDir, item.name);
        const stats = await fs.stat(fullPath);

        let manifest: BackupManifest | null = null;
        try {
          const zipBuffer = await fs.readFile(fullPath);
          const entries = parseZipArchive(zipBuffer);
          const manifestEntry = entries.find((e) => e.path === "manifest.json");
          if (manifestEntry) {
            manifest = JSON.parse(manifestEntry.data.toString("utf8"));
          }
        } catch {
          // If manifest cannot be parsed, still list the file
        }

        results.push({
          filename: item.name,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString() || stats.mtime.toISOString(),
          manifest,
        });
      }
    }
  } catch {
    // Return empty list if folder cannot be read
  }

  // Sort newest first
  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Retrieves a backup file from the server by filename.
 */
export async function getBackupBuffer(filename: string): Promise<Buffer | null> {
  const backupDir = await ensureBackupDirectory();
  const safeFilename = path.basename(filename);
  const filePath = path.join(backupDir, safeFilename);

  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Deletes a backup file from the server.
 */
export async function deleteServerBackup(filename: string): Promise<boolean> {
  const backupDir = await ensureBackupDirectory();
  const safeFilename = path.basename(filename);
  const filePath = path.join(backupDir, safeFilename);

  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Restores application data from a backup ZIP buffer or JSON string.
 */
export async function restoreFromBackup(
  buffer: Buffer,
  mode: "overwrite" | "merge" = "overwrite"
): Promise<{
  success: boolean;
  manifest: BackupManifest | null;
  restoredCounts: Record<string, number>;
  restoredFilesCount: number;
  errors: string[];
}> {
  let manifest: BackupManifest | null = null;
  let databaseTables: Record<string, any[]> | null = null;
  let fileEntries: ZipEntry[] = [];

  // Check if buffer is a raw JSON file or a ZIP archive
  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (isZip) {
    const entries = parseZipArchive(buffer);
    const manifestEntry = entries.find((e) => e.path === "manifest.json");
    if (manifestEntry) {
      try {
        manifest = JSON.parse(manifestEntry.data.toString("utf8"));
      } catch {}
    }

    const dbEntry = entries.find((e) => e.path === "database.json");
    if (dbEntry) {
      databaseTables = JSON.parse(dbEntry.data.toString("utf8"));
    }

    fileEntries = entries.filter((e) => e.path.startsWith("uploads/"));
  } else {
    // Try parsing as raw JSON
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      if (parsed.manifest && parsed.tables) {
        manifest = parsed.manifest;
        databaseTables = parsed.tables;
      } else {
        databaseTables = parsed;
      }
    } catch {
      throw new Error(
        "Format berkas cadangan tidak valid. Harap unggah berkas .zip atau .json cadangan HelpDesk."
      );
    }
  }

  if (!databaseTables || typeof databaseTables !== "object") {
    throw new Error(
      "Berkas cadangan tidak berisi data tabel aplikasi ('database.json' tidak ditemukan)."
    );
  }

  // 1. Restore database tables
  const dbRestore = await restoreDatabaseData(databaseTables, mode);

  // 2. Restore uploaded files if any
  const filesRestore = await restoreUploadFiles(fileEntries);

  return {
    success: true,
    manifest,
    restoredCounts: dbRestore.restoredCounts,
    restoredFilesCount: filesRestore.restoredCount,
    errors: dbRestore.errors,
  };
}
